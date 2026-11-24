import { NextRequest, NextResponse } from "next/server";
import {
  createDemoRateLimiter,
  DEMO_AUDIO_MAX_BYTES,
  DEMO_AUDIO_TYPES,
  DEMO_MAX_TEXT_CHARS,
  DEMO_WINDOW_MS,
  demoEndEvent,
  demoLimitReason,
  type DemoHistoryEntry,
} from "@/lib/tutor/demo";
import { describeGeminiError } from "@/lib/tutor/gemini-errors";
import { runDemoReport, runDemoTurn } from "@/lib/tutor/server/demo-runner";
import { transcribeLearnerAudio } from "@/lib/tutor/server/gemini-models";
import { loadPublicTryScenario } from "@/lib/tutor/server/public-try";

export const runtime = "nodejs";
export const maxDuration = 60;

const publicTryRateLimiter = createDemoRateLimiter({ limit: 24, windowMs: DEMO_WINDOW_MS });

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

function sanitizeHistory(raw: unknown): DemoHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: DemoHistoryEntry[] = [];
  for (const item of raw.slice(-16)) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if ((rec.role === "learner" || rec.role === "tutor") && typeof rec.text === "string" && rec.text.trim()) {
      out.push({ role: rec.role, text: rec.text.trim().slice(0, 600) });
    }
  }
  return out;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ scenarioId: string }> },
) {
  const { scenarioId } = await context.params;
  const loaded = await loadPublicTryScenario(scenarioId);
  if (!loaded) {
    return NextResponse.json({ error: "Mini-lesson not found or not publicly shared." }, { status: 404 });
  }

  const ip = clientIp(req);
  const contentType = req.headers.get("content-type") ?? "";

  let action: "turn" | "report" = "turn";
  let history: DemoHistoryEntry[] = [];
  let text: string | null = null;
  let elapsedMs = 0;
  let audio: { bytes: Buffer; mimeType: string } | undefined;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    const hStr = form.get("history");
    if (typeof hStr === "string" && hStr.trim()) {
      try {
        history = sanitizeHistory(JSON.parse(hStr));
      } catch {
        return NextResponse.json({ error: "Invalid history" }, { status: 400 });
      }
    }
    const elapsedVal = Number(form.get("elapsedMs") ?? 0);
    elapsedMs = Number.isFinite(elapsedVal) && elapsedVal > 0 ? elapsedVal : 0;
    const file = form.get("audio");
    if (file instanceof Blob) {
      if (file.size > DEMO_AUDIO_MAX_BYTES) {
        return NextResponse.json({ error: "Audio clip is too large (max 2 MB)." }, { status: 413 });
      }
      const mimeType = file.type.split(";")[0].trim().toLowerCase();
      if (!DEMO_AUDIO_TYPES.includes(mimeType)) {
        return NextResponse.json({ error: "Unsupported audio format." }, { status: 415 });
      }
      audio = { bytes: Buffer.from(await file.arrayBuffer()), mimeType };
    }
  } else {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    if (body.action === "report") action = "report";
    history = sanitizeHistory(body.history);
    if (typeof body.text === "string" && body.text.trim()) {
      text = body.text.trim().slice(0, DEMO_MAX_TEXT_CHARS);
    }
    const elapsedVal = Number(body.elapsedMs ?? 0);
    elapsedMs = Number.isFinite(elapsedVal) && elapsedVal > 0 ? elapsedVal : 0;
  }

  if (action === "report") {
    try {
      const report = await runDemoReport(loaded.scenario, history);
      return NextResponse.json({ report, created: true });
    } catch {
      return NextResponse.json({
        report: {
          scores: { task: 85 },
          strengths: ["Completed the interactive mini-lesson preview!"],
          mistakes: [],
          nextStep: "Join the academy to unlock the full course and personalized Study Deck.",
        },
        created: true,
      });
    }
  }

  const learnerTurn = audio !== undefined || text !== null;
  const reason = demoLimitReason({
    history,
    learnerTurn,
    elapsedMs,
    maxMinutes: loaded.scenario.maxMinutes,
  });
  if (reason) {
    return NextResponse.json({
      learnerText: text,
      events: [demoEndEvent(reason)],
      ended: true,
      endReason: reason,
    });
  }

  const budget = publicTryRateLimiter.take(`try:${ip}`);
  if (!budget.ok) {
    return NextResponse.json(
      { error: "You've reached the preview limit for now. Sign up to continue with unlimited sessions!" },
      { status: 429, headers: { "Retry-After": String(budget.retryAfterSec) } },
    );
  }

  if (audio) {
    try {
      const transcript = await transcribeLearnerAudio(audio);
      if (!transcript.text) {
        return NextResponse.json({ error: "No speech was detected. Try again or type." }, { status: 422 });
      }
      text = transcript.text.slice(0, DEMO_MAX_TEXT_CHARS);
    } catch (err) {
      const info = describeGeminiError(err);
      console.error("[tutor/try] transcription failed:", info.code, info.detail);
      return NextResponse.json({ error: "Could not transcribe audio. Try typing your reply." }, { status: 502 });
    }
  }

  try {
    const result = await runDemoTurn({
      scenario: loaded.scenario,
      history,
      text,
      elapsedMs,
    });
    return NextResponse.json({
      learnerText: text,
      events: result.events,
      ended: result.ended,
      endReason: result.endReason ?? null,
    });
  } catch (err) {
    const info = describeGeminiError(err);
    console.error("[tutor/try] turn failed:", info.code, info.detail);
    return NextResponse.json(
      { error: "The AI teacher could not respond right now. Please try again." },
      { status: 502 },
    );
  }
}
