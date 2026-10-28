// The "Talk to her" client for the showcase. It implements TutorApiClient against the stateless demo
// API (/api/tutor/demo/turn and /report). The conversation lives in memory here; each request sends
// the history back, and nothing is stored on the server. Signed-in users only (the API returns 401).

import type {
  CompleteResponse,
  Result,
  StartResponse,
  TurnResponse,
  TutorApiClient,
  TutorStartRequest,
  TutorTurnRequest,
} from "@/components/tutor/practice/api";
import { parseTutorErrorBody, type TutorFailure } from "@/lib/tutor/client-errors";
import { DEMO_MAX_HISTORY, DEMO_MAX_TUTOR_CHARS, type DemoHistoryEntry } from "@/lib/tutor/demo";
import { demoScenario, type DemoScenario } from "@/lib/tutor/demo-scenarios";
import type { TutorEvent } from "@/lib/tutor/events";
import type { TutorReportContent } from "@/lib/tutor/report-model";

const TURN_URL = "/api/tutor/demo/turn";
const REPORT_URL = "/api/tutor/demo/report";

async function send<T>(url: string, init: RequestInit): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, credentials: "same-origin" });
  } catch {
    return { ok: false, failure: { kind: "network" } satisfies TutorFailure };
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = parseTutorErrorBody(body);
    // The server's reason and detail, for whoever has DevTools open during a demo.
    if (parsed.reason || parsed.detail) console.warn("[ZAI Tutor]", res.status, parsed.reason ?? "", parsed.detail ?? "");
    return { ok: false, failure: { kind: "http", status: res.status, ...parsed } };
  }
  return { ok: true, data: body as T };
}

function sayText(events: readonly TutorEvent[]): string {
  return events
    .flatMap((e) => (e.type === "say" ? [e.text] : []))
    .join(" ")
    .slice(0, DEMO_MAX_TUTOR_CHARS);
}

function playerFor(scenario: DemoScenario) {
  return {
    persona: {
      id: scenario.persona.id,
      name: scenario.persona.name,
      displayName: scenario.persona.displayName,
      languages: scenario.persona.languages,
    },
    scenario: { id: scenario.key, title: scenario.title, goal: scenario.goal, maxMinutes: scenario.maxMinutes },
  };
}

const notStarted: Result<never> = {
  ok: false,
  failure: { kind: "http", status: 409, error: "The demo has not started." },
};

/**
 * A fresh demo client per session. The learner's words come back from the server (transcribed
 * audio included), and the teacher's lines are kept as text so the next request can send them.
 */
export function createDemoClient(): TutorApiClient {
  let scenario: DemoScenario | null = null;
  let history: DemoHistoryEntry[] = [];
  let startedAt = 0;

  // Only the last DEMO_MAX_HISTORY entries are sent. The server's learner-turn cap is reached before
  // a trimmed window could hide it, so the limits still hold.
  const recentHistory = () => history.slice(-DEMO_MAX_HISTORY);

  async function exchange(input: TutorTurnRequest | null): Promise<Result<TurnResponse>> {
    if (!scenario) return notStarted;
    const elapsedMs = Math.max(0, Date.now() - startedAt);
    const common = { scenarioKey: scenario.key, history: recentHistory(), elapsedMs };

    const res =
      input === null || input.kind === "text"
        ? await send<TurnResponse>(TURN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...common, ...(input ? { text: input.text } : {}) }),
          })
        : await send<TurnResponse>(TURN_URL, { method: "POST", body: audioForm(input, common) });

    if (!res.ok) return res;

    // Record the exchange only after the server accepted it, so a failed turn can be retried.
    if (res.data.learnerText) history.push({ role: "learner", text: res.data.learnerText });
    const reply = sayText(res.data.events);
    if (reply) history.push({ role: "tutor", text: reply });
    return res;
  }

  return {
    async start(input: TutorStartRequest): Promise<Result<StartResponse>> {
      const next = demoScenario(input.scenarioId ?? "");
      if (!next) return { ok: false, failure: { kind: "http", status: 400, error: "Unknown demo scenario." } };
      scenario = next;
      history = [];
      startedAt = Date.now();

      const opening = await exchange(null);
      if (!opening.ok) return opening;

      return {
        ok: true,
        data: {
          sessionId: `demo-${next.key}-${startedAt}`,
          // Live is not offered in the showcase. Text is used when the mic is blocked, otherwise Voice.
          mode: input.preferMode === "text" ? "text" : "voice",
          ...playerFor(next),
          openingEvents: opening.data.events,
        },
      };
    },

    turn(_sessionId: string, input: TutorTurnRequest): Promise<Result<TurnResponse>> {
      return exchange(input);
    },

    async complete(): Promise<Result<CompleteResponse>> {
      if (!scenario) return notStarted;
      const res = await send<{ report: TutorReportContent }>(REPORT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioKey: scenario.key, history: recentHistory() }),
      });
      if (!res.ok) return res;
      return { ok: true, data: { report: res.data.report, created: true } };
    },
  };
}

function audioForm(
  input: Extract<TutorTurnRequest, { kind: "audio" }>,
  common: { scenarioKey: string; history: DemoHistoryEntry[]; elapsedMs: number },
): FormData {
  const form = new FormData();
  const type = input.mimeType.split(";")[0] || "audio/webm";
  const ext = type.split("/")[1] ?? "webm";
  form.append("audio", new File([input.blob], `turn.${ext}`, { type }));
  form.append("scenarioKey", common.scenarioKey);
  form.append("history", JSON.stringify(common.history));
  form.append("elapsedMs", String(common.elapsedMs));
  return form;
}
