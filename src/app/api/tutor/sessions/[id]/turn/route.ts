import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { transcribeLearnerAudio } from "@/lib/tutor/server/gemini-calls";
import { loadSessionContext } from "@/lib/tutor/server/session-context";
import { loadOwnedSession, readJson, sessionIdSchema } from "@/lib/tutor/server/session-store";
import { runSessionTurn, TurnConflictError } from "@/lib/tutor/server/turn-runner";
import { sessionLimitReason } from "@/lib/tutor/server/turn-pipeline";
import { recordUsage } from "@/lib/tutor/server/usage";

// POST /api/tutor/sessions/[id]/turn: one Voice or Text exchange.
// Body: JSON { text } or multipart/form-data with an `audio` file (webm, ogg or wav, at most 2 MB).

const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set(["audio/webm", "audio/ogg", "audio/wav", "audio/x-wav", "audio/wave"]);
const MAX_TEXT_CHARS = 1000;

const textSchema = z.object({
  text: z.string().trim().min(1).max(MAX_TEXT_CHARS),
});

type TurnInput =
  | { ok: true; text?: string; audio?: { bytes: Buffer; mimeType: string } }
  | { ok: false; status: number; error: string };

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!sessionIdSchema.safeParse(id).success) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await loadOwnedSession(id, userId);
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.status !== "active") {
    return NextResponse.json({ error: "Session is not active", status: session.status }, { status: 409 });
  }
  if (session.mode === "live") {
    return NextResponse.json({ error: "Live sessions send events to /events, not turns" }, { status: 409 });
  }

  const input = await readTurnInput(req);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: input.status });

  const sessionContext = await loadSessionContext(session);
  const idx = sessionContext.history.length
    ? Math.max(...sessionContext.history.map((t) => t.idx)) + 1
    : 0;

  // When the session is already over, skip transcription and let the pipeline end it.
  const limit = sessionLimitReason({
    idx,
    sessionStartedAtMs: Date.parse(session.started_at),
    maxMinutes: sessionContext.scenario.max_minutes,
    nowMs: Date.now(),
  });

  let learnerText: string | null = null;
  if (!limit) {
    if (input.audio) {
      const transcript = await transcribeLearnerAudio(input.audio);
      await recordUsage({
        companyId: session.company_id,
        userId,
        sessionId: session.id,
        model: transcript.model,
        kind: "transcribe",
        units: transcript.totalTokens ?? input.audio.bytes.length,
        unit: transcript.totalTokens ? "tokens" : "bytes",
      });
      if (!transcript.text) {
        return NextResponse.json({ error: "No speech was detected. Try again." }, { status: 422 });
      }
      learnerText = transcript.text;
    } else {
      learnerText = input.text ?? null;
    }
  }

  try {
    const result = await runSessionTurn({
      ctx: sessionContext,
      idx,
      learnerText,
      openingInstruction: "",
    });
    return NextResponse.json({
      turnIdx: idx,
      learnerText,
      events: result.events,
      ended: result.ended,
      endReason: result.endReason ?? null,
    });
  } catch (err) {
    if (err instanceof TurnConflictError) {
      return NextResponse.json({ error: "Another turn was saved at the same time. Try again." }, { status: 409 });
    }
    console.error("[tutor] turn failed:", err);
    return NextResponse.json({ error: "The teacher could not respond. Try again." }, { status: 502 });
  }
}

async function readTurnInput(req: NextRequest): Promise<TurnInput> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_AUDIO_BYTES + 256 * 1024) {
      return { ok: false, status: 413, error: "Audio is too large (2 MB maximum)" };
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return { ok: false, status: 400, error: "Malformed multipart body" };
    }

    const file = form.get("audio");
    const textField = form.get("text");
    const text = typeof textField === "string" ? textField.trim() : "";

    if (file instanceof Blob) {
      if (text) return { ok: false, status: 400, error: "Send either text or audio, not both" };
      if (file.size > MAX_AUDIO_BYTES) return { ok: false, status: 413, error: "Audio is too large (2 MB maximum)" };
      const mimeType = file.type.split(";")[0].trim().toLowerCase();
      if (!ALLOWED_AUDIO_TYPES.has(mimeType)) {
        return { ok: false, status: 415, error: "Unsupported audio type. Use webm, ogg or wav." };
      }
      const bytes = Buffer.from(await file.arrayBuffer());
      return { ok: true, audio: { bytes, mimeType } };
    }

    if (!text) return { ok: false, status: 400, error: "Send text or an audio file" };
    if (text.length > MAX_TEXT_CHARS) return { ok: false, status: 400, error: "Text is too long" };
    return { ok: true, text };
  }

  const parsed = textSchema.safeParse(await readJson(req));
  if (!parsed.success) return { ok: false, status: 400, error: "Send { text } or multipart audio" };
  return { ok: true, text: parsed.data.text };
}
