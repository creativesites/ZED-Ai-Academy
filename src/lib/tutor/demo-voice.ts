import { demoScenario, type DemoScenario } from "./demo-scenarios.ts";

// Voice for the scripted "Watch the demo" lines: GET /api/tutor/demo/voice renders one fixed line
// with Gemini TTS, and the CDN caches it. Only lines from the script can be requested, and the URL
// carries a hash of the line, so the set of cacheable URLs is fixed and small. Pure, so node:test
// can run it and the browser can build the same URLs.

export const DEMO_VOICE_PATH = "/api/tutor/demo/voice";

/** FNV-1a, 32 bit, as 8 hex characters. A cache key, not a security check. */
export function lineHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** The text of say line `index` in scripted turn `turn`, or null when there is none. */
export function scriptedSayText(scenario: DemoScenario, turn: number, index: number): string | null {
  const events = scenario.scripted.turns[turn];
  if (!events) return null;
  const says = events.flatMap((e) => (e.type === "say" ? [e.text] : []));
  return says[index] ?? null;
}

export function demoVoiceUrl(scenario: DemoScenario, turn: number, index: number, text: string): string {
  const v = lineHash(`${scenario.persona.voiceName}\n${text}`);
  return `${DEMO_VOICE_PATH}?s=${encodeURIComponent(scenario.key)}&t=${turn}&i=${index}&v=${v}`;
}

export type DemoVoiceRequest = { scenario: DemoScenario; text: string; voice: string };

/**
 * Validates a voice request. Only the four expected parameters are allowed, and the hash must match
 * the current line, so junk parameters cannot multiply the cache misses.
 */
export function parseDemoVoiceQuery(params: URLSearchParams): { ok: true; value: DemoVoiceRequest } | { ok: false; error: string } {
  const keys = [...params.keys()];
  if (keys.length !== 4 || !["s", "t", "i", "v"].every((k) => params.has(k))) {
    return { ok: false, error: "Expected s, t, i and v" };
  }
  const scenario = demoScenario(params.get("s") ?? "");
  if (!scenario) return { ok: false, error: "Unknown scenario" };
  const turn = Number(params.get("t"));
  const index = Number(params.get("i"));
  if (!Number.isInteger(turn) || !Number.isInteger(index) || turn < 0 || index < 0) {
    return { ok: false, error: "Bad line" };
  }
  const text = scriptedSayText(scenario, turn, index);
  if (!text) return { ok: false, error: "Unknown line" };
  const voice = scenario.persona.voiceName;
  if (params.get("v") !== lineHash(`${voice}\n${text}`)) return { ok: false, error: "Stale line" };
  return { ok: true, value: { scenario, text, voice } };
}

/** Every voice URL in a scenario's script, for warming the cache when the demo starts. */
export function scriptedVoiceUrls(scenario: DemoScenario): string[] {
  return scenario.scripted.turns.flatMap((events, turn) =>
    events
      .flatMap((e) => (e.type === "say" ? [e.text] : []))
      .map((text, index) => demoVoiceUrl(scenario, turn, index, text)),
  );
}

