import { NextRequest, NextResponse } from "next/server";
import { createDemoRateLimiter, isDemoEnabled } from "@/lib/tutor/demo";
import { parseDemoVoiceQuery } from "@/lib/tutor/demo-voice";
import { describeGeminiError } from "@/lib/tutor/gemini-errors";
import { synthesizeSpeechWav } from "@/lib/tutor/server/gemini-models";

// GET /api/tutor/demo/voice?s=&t=&i=&v=: the Gemini voice for one line of the scripted "Watch the
// demo". Public, because watching needs no account. Only script lines can be requested (see
// demo-voice.ts), and the response is cached by the CDN for a year, so each line is rendered once.
// When Gemini is not configured or fails, the client falls back to the browser's own voice.

export const runtime = "nodejs";
export const maxDuration = 30;

// Cache misses only: a bound on Gemini calls from one address. Per serverless instance.
const missLimiter = createDemoRateLimiter({ limit: 120, windowMs: 60 * 60 * 1000 });

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  if (!isDemoEnabled(process.env.TUTOR_DEMO_ENABLED)) {
    return NextResponse.json({ error: "The demo voice is paused.", reason: "demo_paused" }, { status: 503, headers: NO_STORE });
  }
  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    return NextResponse.json({ error: "Gemini is not configured.", reason: "gemini_no_key" }, { status: 503, headers: NO_STORE });
  }

  const parsed = parseDemoVoiceQuery(req.nextUrl.searchParams);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const budget = missLimiter.take(ip);
  if (!budget.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(budget.retryAfterSec) } },
    );
  }

  try {
    const { wav, model } = await synthesizeSpeechWav(parsed.value.text, parsed.value.voice);
    return new NextResponse(new Uint8Array(wav), {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(wav.length),
        "X-Tutor-Model": model,
        // The URL carries a hash of the line, so a changed line gets a new URL.
        "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
      },
    });
  } catch (err) {
    const info = describeGeminiError(err);
    console.error("[tutor] demo voice failed:", info.code, info.detail);
    return NextResponse.json(
      { error: "The voice could not be generated.", reason: `gemini_${info.code}`, detail: info.detail },
      { status: 502, headers: NO_STORE },
    );
  }
}
