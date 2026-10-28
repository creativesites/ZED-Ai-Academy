// The "Watch the demo" client. It plays a scenario's hard-coded turns with no model calls. The
// learner's lines are the scripted ones, shown as what the learner said. Delays are short and
// realistic so the session feels live. The teacher's voice comes from the cached Gemini voice
// route, downloaded ahead by VoiceLoader; a line that is not ready is read by the browser voice.

import type { CompleteResponse, Result, StartResponse, TurnResponse, TutorApiClient } from "@/components/tutor/practice/api";
import { demoScenario, type DemoScenario } from "@/lib/tutor/demo-scenarios";
import { demoVoiceUrl, scriptedVoiceUrls } from "@/lib/tutor/demo-voice";
import type { TutorEvent } from "@/lib/tutor/events";
import { VoiceLoader } from "./voice-loader";

const START_DELAY_MS = 500;
const TURN_DELAY_MS = 900;
const REPORT_DELAY_MS = 700;
/** The first line is rendered by Gemini on the first visit after a deploy, which takes a few seconds. */
const FIRST_LINE_WAIT_MS = 12_000;
/** Later lines download while earlier ones play. Past this, the browser voice reads the line. */
const LINE_WAIT_MS = 5_000;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
/** A copy of one scripted turn. Each say line gets its downloaded voice, when it is ready in time. */
async function voiced(scenario: DemoScenario, turn: number, loader: VoiceLoader, waitMs: number): Promise<TutorEvent[]> {
  let sayIndex = 0;
  const events = scenario.scripted.turns[turn].map((e) =>
    e.type === "say" ? { event: e, url: demoVoiceUrl(scenario, turn, sayIndex++, e.text) } : { event: e, url: null },
  );
  return Promise.all(
    events.map(async ({ event, url }): Promise<TutorEvent> => {
      if (!url || event.type !== "say") return { ...event } as TutorEvent;
      const audioUrl = await loader.get(url, waitMs);
      return audioUrl ? { ...event, audioUrl } : { ...event };
    }),
  );
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
  let loader: VoiceLoader | null = null;

  return {
    async start(): Promise<Result<StartResponse>> {
      index = 0;
      loader?.dispose();
      loader = new VoiceLoader(scriptedVoiceUrls(scenario));
      const [openingEvents] = await Promise.all([voiced(scenario, 0, loader, FIRST_LINE_WAIT_MS), wait(START_DELAY_MS)]);
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
          openingEvents,
        },
      };
    },

    async turn(): Promise<Result<TurnResponse>> {
      index += 1;
      const voiceLoader = loader ?? new VoiceLoader([]);
      // The script ends with end_session, so the session never asks for a turn past it.
      if (index >= script.turns.length) {
        return {
          ok: true,
          data: { turnIdx: index, learnerText: null, events: [{ type: "end_session" }], ended: true, endReason: "model_end" },
        };
      }
      const [events] = await Promise.all([voiced(scenario, index, voiceLoader, LINE_WAIT_MS), wait(TURN_DELAY_MS)]);
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
