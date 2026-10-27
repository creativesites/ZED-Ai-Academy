// The "Watch the demo" client. It plays a scenario's hard-coded turns with no network at all. The
// learner's lines are the scripted ones, shown as what the learner said. Delays are short and
// realistic so the session feels live.

import type { CompleteResponse, Result, StartResponse, TurnResponse, TutorApiClient } from "@/components/tutor/practice/api";
import { demoScenario, type DemoScenario } from "@/lib/tutor/demo-scenarios";
import { demoVoiceUrl, scriptedVoiceUrls } from "@/lib/tutor/demo-voice";
import type { TutorEvent } from "@/lib/tutor/events";

const START_DELAY_MS = 500;
const TURN_DELAY_MS = 900;
const REPORT_DELAY_MS = 700;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
/** A copy of one scripted turn, with each say line pointing at its cached Gemini voice. */
function voiced(scenario: DemoScenario, turn: number): TutorEvent[] {
  let sayIndex = 0;
  return scenario.scripted.turns[turn].map((e) =>
    e.type === "say" ? { ...e, audioUrl: demoVoiceUrl(scenario, turn, sayIndex++, e.text) } : ({ ...e } as TutorEvent),
  );
}

/**
 * Asks for every line's voice in the background, so later lines are cached by the time they play.
 * The first visitor after a deploy renders them; everyone after gets them from the CDN.
 */
function warmVoices(scenario: DemoScenario): void {
  if (typeof fetch === "undefined") return;
  // One at a time: TTS rate limits are low, and the lines play in this order anyway.
  void (async () => {
    for (const url of scriptedVoiceUrls(scenario).slice(1)) {
      const res = await fetch(url).catch(() => null);
      if (!res || res.status === 503) return; // Gemini not configured: the browser voice is used.
    }
  })();
}

function endsSession(events: readonly TutorEvent[]): boolean {
  return events.some((e) => e.type === "end_session");
}

/** A client for one scenario. Restarting the session (Practise again) resets the script. */
export function createScriptedClient(scenarioKey: string): TutorApiClient {
  const scenario: DemoScenario | undefined = demoScenario(scenarioKey);
  if (!scenario) throw new Error(`createScriptedClient: unknown demo scenario ${scenarioKey}`);
  const script = scenario.scripted;
  let index = 0;

  return {
    async start(): Promise<Result<StartResponse>> {
      index = 0;
      warmVoices(scenario);
      await wait(START_DELAY_MS);
      return {
        ok: true,
        data: {
          sessionId: `scripted-${scenario.key}`,
          // No microphone in the watch-only demo: the typed-reply mode is used.
          mode: "text",
          persona: {
            id: scenario.persona.id,
            name: scenario.persona.name,
            displayName: scenario.persona.displayName,
            languages: scenario.persona.languages,
          },
          scenario: {
            id: scenario.key,
            title: scenario.title,
            goal: scenario.goal,
            maxMinutes: scenario.maxMinutes,
          },
          openingEvents: voiced(scenario, 0),
        },
      };
    },

    async turn(): Promise<Result<TurnResponse>> {
      index += 1;
      await wait(TURN_DELAY_MS);
      // The script ends with end_session, so the session never asks for a turn past it.
      if (index >= script.turns.length) {
        return {
          ok: true,
          data: { turnIdx: index, learnerText: null, events: [{ type: "end_session" }], ended: true, endReason: "model_end" },
        };
      }
      const events = voiced(scenario, index);
      const ended = endsSession(events);
      return {
        ok: true,
        data: {
          turnIdx: index,
          learnerText: script.learnerLines[index] ?? null,
          events,
          ended,
          endReason: ended ? "model_end" : null,
        },
      };
    },

    async complete(): Promise<Result<CompleteResponse>> {
      await wait(REPORT_DELAY_MS);
      return { ok: true, data: { report: scenario.scriptedReport, created: true } };
    },
  };
}
