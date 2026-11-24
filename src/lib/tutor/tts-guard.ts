// Guardrails for POST /api/tutor/tts: voice allowlist and per-user sliding-window rate limiter.
// Pure: no I/O or "@/" imports so node:test runs it directly.

export const ALLOWED_TTS_VOICES = [
  "Kore",
  "Aoede",
  "Puck",
  "Charon",
  "Fenrir",
  "Leda",
  "Orus",
  "Zephyr",
  "Sulafat",
  "Achird",
  "Sadaltager",
  "Alnilam",
  "Autonoe",
  "Callirrhoe",
  "Despina",
  "Enceladus",
  "Erinome",
  "Gacrux",
  "Iapetus",
  "Laomedeia",
  "Pulcherrima",
  "Rasalgethi",
  "Sadachbia",
  "Schedar",
  "Umbriel",
  "Vindemiatrix",
  "Zubenelgenubi",
] as const;

export const DEFAULT_TTS_VOICE = "Kore";
const VOICE_SET = new Set<string>(ALLOWED_TTS_VOICES);

export function normalizeTtsVoice(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_TTS_VOICE;
  const trimmed = raw.trim();
  return VOICE_SET.has(trimmed) ? trimmed : DEFAULT_TTS_VOICE;
}

export type RateLimitDecision =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSec: number };

/**
 * In-memory per-user sliding-window rate limiter for TTS requests.
 * Keeps memory bounded by evicting stale buckets.
 */
export class TtsRateLimiter {
  private readonly buckets = new Map<string, number[]>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(opts: { limit?: number; windowMs?: number } = {}) {
    this.limit = opts.limit ?? 80;
    this.windowMs = opts.windowMs ?? 10 * 60_000;
  }

  check(userId: string, nowMs = Date.now()): RateLimitDecision {
    const cutoff = nowMs - this.windowMs;
    const prev = this.buckets.get(userId) ?? [];
    const recent = prev.filter((ts) => ts > cutoff);

    if (recent.length >= this.limit) {
      this.buckets.set(userId, recent);
      const oldest = recent[0] ?? nowMs;
      const retryAfterSec = Math.max(1, Math.ceil((oldest + this.windowMs - nowMs) / 1000));
      return { allowed: false, retryAfterSec };
    }

    recent.push(nowMs);
    this.buckets.set(userId, recent);

    if (this.buckets.size > 500) {
      for (const [key, list] of this.buckets.entries()) {
        if (list.length === 0 || list[list.length - 1] <= cutoff) {
          this.buckets.delete(key);
        }
      }
    }

    return { allowed: true, remaining: Math.max(0, this.limit - recent.length) };
  }
}
