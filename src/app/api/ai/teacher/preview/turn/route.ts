import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { authorizeFlowPreview } from "@/lib/authz/context-server";
import { blocksToText } from "@/lib/course-blocks/block-to-text";
import { DEFAULT_TEACHER_NAME } from "@/lib/tutor/course-teacher";
import { describeGeminiError } from "@/lib/tutor/gemini-errors";
import { LEARNER_AUDIO_TYPES } from "@/lib/tutor/recording";
import { skillPackLanguage } from "@/lib/tutor/skill-packs";
import { generateTurnJson, synthesizeCachedSpeech, transcribeLearnerAudio } from "@/lib/tutor/server/gemini-calls";
import { buildSystemPrompt } from "@/lib/tutor/server/prompt";
import { fallbackLanguageFor, runTutorTurn } from "@/lib/tutor/server/turn-pipeline";
import { recordUsage } from "@/lib/tutor/server/usage";
import { assertTenantRefs, tenantRefErrorResponse } from "@/lib/authz/refs-server";
import {
  PREVIEW_MAX_LEARNER_CHARS,
  previewHistoryToTurns,
  previewLimitReason,
  previewTurnJsonSchema,
  toPromptScenarioFromDraft,
  type PreviewFlowPayload,
} from "@/lib/tutor/authoring/preview";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set(LEARNER_AUDIO_TYPES);

const OPENING_INSTRUCTION =
  "The teacher is previewing this flow as a student. Open the session now in character, greet briefly, and begin the first step.";

type ParsedTurnBody =
  | {
      ok: true;
      flow: PreviewFlowPayload;
      history: { role: "tutor" | "learner"; text: string }[];
      text: string | null;
      elapsedMs: number;
      mode: "voice" | "text";
      audio?: { bytes: Buffer; mimeType: string };
    }
  | { ok: false; status: number; error: string };

async function parseRequest(req: NextRequest): Promise<ParsedTurnBody> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return { ok: false, status: 400, error: "Malformed multipart body" };
    }

    const rawFlow = form.get("flow");
    const rawHistory = form.get("history");
    let flowJson: unknown;
    let historyJson: unknown = [];
    try {
      flowJson = typeof rawFlow === "string" ? JSON.parse(rawFlow) : null;
      if (typeof rawHistory === "string" && rawHistory.trim()) {
        historyJson = JSON.parse(rawHistory);
      }
    } catch {
      return { ok: false, status: 400, error: "Invalid JSON fields in form" };
    }

    const file = form.get("audio");
    if (!(file instanceof Blob)) {
      return { ok: false, status: 400, error: "Missing audio file" };
    }
    if (file.size > MAX_AUDIO_BYTES) {
      return { ok: false, status: 413, error: "Audio is too large (2 MB maximum)" };
    }
    const mimeType = file.type.split(";")[0].trim().toLowerCase();
    if (!ALLOWED_AUDIO_TYPES.has(mimeType)) {
      return { ok: false, status: 415, error: "Unsupported audio type. Use webm, ogg, wav or mp4." };
    }

    const elapsedRaw = form.get("elapsedMs");
    const elapsedMs = typeof elapsedRaw === "string" && elapsedRaw.trim() ? Number(elapsedRaw) : 0;
    const parsed = previewTurnJsonSchema.safeParse({
      flow: flowJson,
      history: historyJson,
      elapsedMs: Number.isFinite(elapsedMs) ? elapsedMs : 0,
    });
    if (!parsed.success) {
      return { ok: false, status: 400, error: "Invalid preview payload" };
    }

    return {
      ok: true,
      flow: parsed.data.flow,
      history: parsed.data.history,
      text: null,
      elapsedMs: parsed.data.elapsedMs,
      mode: "voice",
      audio: { bytes: Buffer.from(await file.arrayBuffer()), mimeType },
    };
  }

  const json = await req.json().catch(() => null);
  const parsed = previewTurnJsonSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Invalid preview request" };
  }
  const text = parsed.data.text?.trim() ? parsed.data.text.trim().slice(0, PREVIEW_MAX_LEARNER_CHARS) : null;
  const modeField = (json as { mode?: unknown } | null)?.mode;
  return {
    ok: true,
    flow: parsed.data.flow,
    history: parsed.data.history,
    text,
    elapsedMs: parsed.data.elapsedMs,
    mode: modeField === "text" ? "text" : "voice",
  };
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await parseRequest(req);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });

  const authResult = await authorizeFlowPreview(userId, body.flow);
  if (!authResult.allowed) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const companyId = authResult.companyId;
  try {
    // The flow payload comes from the client: its lesson and persona must belong to the authorised tenant
    // (and the lesson to the flow's course), or this route would read another academy's content.
    await assertTenantRefs(companyId, {
      courseId: body.flow.courseId ?? null,
      lessonId: body.flow.lessonId ?? null,
      personaId: body.flow.personaId ?? null,
    });
  } catch (err) {
    const denied = tenantRefErrorResponse(err);
    if (denied) return denied;
    throw err;
  }
  const learnerTurn = body.audio !== undefined || body.text !== null;
  const limitReason = previewLimitReason({
    history: body.history,
    learnerTurn,
    elapsedMs: body.elapsedMs,
    maxMinutes: body.flow.maxMinutes,
  });

  if (limitReason) {
    return NextResponse.json({
      learnerText: body.text,
      events: [{ type: "end_session", summary: "Preview session time or turn limit reached." }],
      ended: true,
      endReason: limitReason,
    });
  }

  let learnerText = body.text;
  if (body.audio) {
    try {
      const transcript = await transcribeLearnerAudio(body.audio);
      await recordUsage({
        companyId,
        userId,
        sessionId: null,
        model: transcript.model,
        kind: "transcribe",
        units: transcript.totalTokens ?? body.audio.bytes.length,
        unit: transcript.totalTokens ? "tokens" : "bytes",
      });
      if (!transcript.text) {
        return NextResponse.json({ error: "No speech was detected. Try again." }, { status: 422 });
      }
      learnerText = transcript.text.slice(0, PREVIEW_MAX_LEARNER_CHARS);
    } catch (err) {
      const info = describeGeminiError(err);
      return NextResponse.json(
        { error: "Could not transcribe audio. Try again.", reason: `gemini_${info.code}`, detail: info.detail },
        { status: 502 },
      );
    }
  }

  const db = createServiceClient();
  const [{ data: personaRow }, { data: blockRows }] = await Promise.all([
    body.flow.personaId
      ? db.from("ai_personas").select("id, name, display_name, languages, personality_prompt, voice").eq("id", body.flow.personaId).maybeSingle()
      : Promise.resolve({ data: null }),
    body.flow.lessonId
      ? db.from("content_blocks").select("type, content").eq("lesson_id", body.flow.lessonId).order("position", { ascending: true })
      : Promise.resolve({ data: [] as { type: string; content: unknown }[] }),
  ]);

  const persona = personaRow ?? {
    id: "preview-default",
    name: DEFAULT_TEACHER_NAME,
    display_name: DEFAULT_TEACHER_NAME,
    languages: ["en"],
    personality_prompt:
      "You are Tinashe, a warm, clear teacher. Teach one idea at a time, use concrete examples, check understanding, and encourage real effort.",
    voice: { voiceName: "Puck" },
  };
  const voiceObj =
    typeof persona.voice === "object" && persona.voice !== null ? (persona.voice as Record<string, unknown>) : {};
  const voiceName = typeof voiceObj.voiceName === "string" && voiceObj.voiceName.trim() ? voiceObj.voiceName.trim() : "Puck";

  const lessonText = blocksToText(blockRows ?? [], { maxChars: 18_000 });
  const turns = previewHistoryToTurns(body.history);
  const skillLang = skillPackLanguage(body.flow.skillPack);
  const systemInstruction = buildSystemPrompt({
    scenario: toPromptScenarioFromDraft(body.flow),
    persona: {
      name: persona.name,
      displayName: persona.display_name,
      languages: persona.languages,
      personalityPrompt: persona.personality_prompt,
    },
    skillPack: body.flow.skillPack,
    learnerProfile: { levelEstimate: body.flow.level ?? null, recentMistakes: [], memoryNotes: [] },
    lessonText,
    mode: body.mode,
  });

  try {
    const result = await runTutorTurn(
      {
        sessionStartedAtMs: Date.now() - body.elapsedMs,
        maxMinutes: body.flow.maxMinutes,
        idx: turns.length,
        learnerText,
        openingInstruction: OPENING_INSTRUCTION,
        fallbackLanguage: fallbackLanguageFor(skillLang ?? "en"),
        systemInstruction,
        voice: voiceName,
        history: turns,
      },
      {
        now: () => Date.now(),
        generate: async (reqTurn) => {
          const out = await generateTurnJson(reqTurn);
          await recordUsage({
            companyId,
            userId,
            sessionId: null,
            model: out.model,
            kind: "llm",
            units: out.totalTokens ?? 0,
            unit: "tokens",
          });
          return out;
        },
        synthesize: async (line, voice) => {
          const speech = await synthesizeCachedSpeech(line, voice);
          if (!speech.cached) {
            await recordUsage({
              companyId,
              userId,
              sessionId: null,
              model: speech.model,
              kind: "tts",
              units: speech.totalTokens ?? line.length,
              unit: speech.totalTokens ? "tokens" : "characters",
            });
          }
          return speech.url;
        },
        saveTurn: async () => undefined, // Preview writes no learner session or turn rows.
      },
    );

    return NextResponse.json({
      turnIdx: result.idx,
      learnerText,
      events: result.events,
      ended: result.ended,
      endReason: result.endReason ?? null,
      persona: {
        id: persona.id,
        name: persona.name,
        displayName: persona.display_name,
        languages: persona.languages,
      },
    });
  } catch (err) {
    const info = describeGeminiError(err);
    return NextResponse.json(
      { error: "Preview turn failed. Try again.", reason: `gemini_${info.code}`, detail: info.detail },
      { status: 502 },
    );
  }
}
