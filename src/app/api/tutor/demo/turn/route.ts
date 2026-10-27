import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  DEMO_AUDIO_MAX_BYTES,
  DEMO_AUDIO_TYPES,
  DEMO_MAX_TEXT_CHARS,
  demoEndEvent,
  demoLimitReason,
  isDemoEnabled,
  parseDemoTurn,
  type DemoTurnRequest,
} from "@/lib/tutor/demo";
import { demoScenario } from "@/lib/tutor/demo-scenarios";
import { runDemoTurn, demoRateLimiter } from "@/lib/tutor/server/demo-runner";
import { transcribeLearnerAudio } from "@/lib/tutor/server/gemini-models";

// POST /api/tutor/demo/turn: one exchange in the showcase demo. Stateless: the client sends the
// history each time and nothing is stored. Body is JSON { scenarioKey, history, text?, elapsedMs? }
// or multipart/form-data with `audio` (webm, ogg, wav or mp4, 2 MB at most) and the same fields as strings.

export const runtime = "nodejs";
// Transcribe, turn JSON and one TTS call per line run in sequence, so allow more than the default.
export const maxDuration = 60;

type Body = { scenarioKey: unknown; history: unknown; text: unknown; elapsedMs: unknown; audio?: { bytes: Buffer; mimeType: string } };

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDemoEnabled(process.env.TUTOR_DEMO_ENABLED)) {
    return NextResponse.json({ error: "The live demo is paused. Try the watch-only demo." }, { status: 503 });
  }

  const read = await readBody(req);
  if (!read.ok) return NextResponse.json({ error: read.error }, { status: read.status });

  const parsed = parseDemoTurn(read.body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const request: DemoTurnRequest = parsed.value;
  const scenario = demoScenario(request.scenarioKey);
  if (!scenario) return NextResponse.json({ error: "Unknown scenario" }, { status: 400 });

  const hasAudio = read.body.audio !== undefined;
  const learnerTurn = hasAudio || request.text !== null;

  // Limits end the demo without a model call and without using the budget.
  const reason = demoLimitReason({
    history: request.history,
    learnerTurn,
    elapsedMs: request.elapsedMs,
    maxMinutes: scenario.maxMinutes,
  });
  if (reason) {
    return NextResponse.json({
      learnerText: request.text,
      events: [demoEndEvent(reason)],
      ended: true,
      endReason: reason,
    });
  }

  const budget = demoRateLimiter.take(userId);
  if (!budget.ok) {
    return NextResponse.json(
      { error: "You have used this hour's demo turns. Try again later, or sign up for a full session." },
      { status: 429, headers: { "Retry-After": String(budget.retryAfterSec) } },
    );
  }

  let text = request.text;
  if (read.body.audio) {
    try {
      const transcript = await transcribeLearnerAudio(read.body.audio);
      if (!transcript.text) return NextResponse.json({ error: "No speech was detected. Try again." }, { status: 422 });
      text = transcript.text.slice(0, DEMO_MAX_TEXT_CHARS);
    } catch (err) {
      console.error("[tutor] demo transcription failed:", err);
      return NextResponse.json({ error: "The teacher could not hear that. Try again." }, { status: 502 });
    }
  }

  try {
    const result = await runDemoTurn({
      scenario,
      history: request.history,
      text,
      elapsedMs: request.elapsedMs,
    });
    if (result.fallback) console.warn("[tutor] demo turn used the fallback line:", result.parseError ?? "no valid events");
    return NextResponse.json({
      learnerText: text,
      events: result.events,
      ended: result.ended,
      endReason: result.endReason ?? null,
    });
  } catch (err) {
    console.error("[tutor] demo turn failed:", err);
    return NextResponse.json({ error: "The teacher could not respond. Try again." }, { status: 502 });
  }
}

type ReadResult =
  | { ok: true; body: Body & { audio?: { bytes: Buffer; mimeType: string } } }
  | { ok: false; status: number; error: string };

async function readBody(req: NextRequest): Promise<ReadResult> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return { ok: false, status: 400, error: "Malformed multipart body" };
    }

    let history: unknown = undefined;
    const historyField = form.get("history");
    if (typeof historyField === "string" && historyField.trim()) {
      try {
        history = JSON.parse(historyField);
      } catch {
        return { ok: false, status: 400, error: "history must be JSON" };
      }
    }

    const file = form.get("audio");
    let audio: { bytes: Buffer; mimeType: string } | undefined;
    if (file instanceof Blob) {
      if (file.size > DEMO_AUDIO_MAX_BYTES) return { ok: false, status: 413, error: "Audio is too large (2 MB maximum)" };
      const mimeType = file.type.split(";")[0].trim().toLowerCase();
      if (!DEMO_AUDIO_TYPES.includes(mimeType)) {
        return { ok: false, status: 415, error: "Unsupported audio type. Use webm, ogg, wav or mp4." };
      }
      audio = { bytes: Buffer.from(await file.arrayBuffer()), mimeType };
    }

    const elapsed = form.get("elapsedMs");
    const textField = form.get("text");
    return {
      ok: true,
      body: {
        scenarioKey: form.get("scenarioKey"),
        history,
        text: typeof textField === "string" && textField.trim() ? textField : undefined,
        elapsedMs: typeof elapsed === "string" && elapsed.trim() !== "" ? Number(elapsed) : undefined,
        audio,
      },
    };
  }

  const json = await req.json().catch(() => null);
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return { ok: false, status: 400, error: "Send a JSON object" };
  }
  const body = json as Record<string, unknown>;
  return {
    ok: true,
    body: { scenarioKey: body.scenarioKey, history: body.history, text: body.text, elapsedMs: body.elapsedMs },
  };
}
