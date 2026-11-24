import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { synthesizeCachedSpeech } from "@/lib/tutor/server/gemini-calls";
import { recordUsage } from "@/lib/tutor/server/usage";
import { normalizeTtsVoice, TtsRateLimiter } from "@/lib/tutor/tts-guard";
import { ZEDAI_TENANT_ID } from "@/lib/tenants/constants";

export const runtime = "nodejs";
export const maxDuration = 30;

const ttsLimiter = new TtsRateLimiter({ limit: 80, windowMs: 10 * 60_000 });

const ttsSchema = z.object({
  text: z.string().trim().min(1).max(600),
  voice: z.string().trim().min(1).max(40).optional(),
  sessionId: z.string().uuid().optional(),
  companyId: z.string().trim().min(1).max(120).optional(),
});

/**
 * POST /api/tutor/tts
 * Synthesizes (or serves from Supabase Storage cache) WAV audio for a single teacher line.
 * Guarded by Clerk auth, voice allowlist, per-user sliding-window rate limit, and usage metering.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = ttsLimiter.check(userId);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many audio requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = ttsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid TTS request" }, { status: 400 });
  }

  const voice = normalizeTtsVoice(parsed.data.voice);

  try {
    const speech = await synthesizeCachedSpeech(parsed.data.text, voice);
    if (!speech.cached) {
      void recordUsage({
        companyId: parsed.data.companyId ?? ZEDAI_TENANT_ID,
        userId,
        sessionId: parsed.data.sessionId ?? null,
        model: speech.model,
        kind: "tts",
        units: speech.totalTokens ?? parsed.data.text.length,
        unit: speech.totalTokens ? "tokens" : "characters",
      }).catch((err) => console.warn("[tutor/tts] usage log failed:", err));
    }
    return NextResponse.json({ url: speech.url, cached: speech.cached });
  } catch (err) {
    console.warn("[tutor/tts] synthesis unavailable:", err);
    return NextResponse.json({ url: null }, { status: 200 });
  }
}
