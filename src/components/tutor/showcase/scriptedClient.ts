// The "Watch the demo" client. It plays a scenario's hard-coded turns with no network at all. The
// learner's lines are the scripted ones, shown as what the learner said. Delays are short and
// realistic so the session feels live.

import type { CompleteResponse, Result, StartResponse, TurnResponse, TutorApiClient } from "@/components/tutor/practice/api";
import { demoScenario, type DemoScenario } from "@/lib/tutor/demo-scenarios";
import type { TutorEvent } from "@/lib/tutor/events";

const START_DELAY_MS = 500;
const TURN_DELAY_MS = 900;
const REPORT_DELAY_MS = 700;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const clone = (events: readonly TutorEvent[]): TutorEvent[] => events.map((e) => ({ ...e }) as TutorEvent);

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
          openingEvents: clone(script.turns[0]),
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
      const events = clone(script.turns[index]);
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
