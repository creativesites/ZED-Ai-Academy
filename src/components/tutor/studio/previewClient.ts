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
import type { TutorEvent } from "@/lib/tutor/events";
import type { TutorReportContent } from "@/lib/tutor/report-model";
import {
  PREVIEW_MAX_HISTORY,
  PREVIEW_MAX_TUTOR_CHARS,
  type PreviewFlowPayload,
  type PreviewHistoryEntry,
} from "@/lib/tutor/authoring/preview";

const PREVIEW_TURN_URL = "/api/ai/teacher/preview/turn";
const PREVIEW_REPORT_URL = "/api/ai/teacher/preview/report";

async function sendPreview<T>(url: string, init: RequestInit): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, credentials: "same-origin" });
  } catch {
    return { ok: false, failure: { kind: "network" } satisfies TutorFailure };
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    return {
      ok: false,
      failure: { kind: "http", status: res.status, ...parseTutorErrorBody(body) },
    };
  }
  return { ok: true, data: body as T };
}

function sayText(events: readonly TutorEvent[]): string {
  return events
    .flatMap((e) => (e.type === "say" ? [e.text] : []))
    .join(" ")
    .slice(0, PREVIEW_MAX_TUTOR_CHARS);
}

/**
 * Stateless TutorApiClient for "Test as student" preview sessions.
 * Keeps transcript in memory, saves no learner session or report, and logs AI usage against the teacher.
 */
export function createTeacherPreviewClient(getFlow: () => PreviewFlowPayload): TutorApiClient {
  let history: PreviewHistoryEntry[] = [];
  let startedAt = 0;

  const recentHistory = () => history.slice(-PREVIEW_MAX_HISTORY);

  async function exchange(
    input: TutorTurnRequest | null,
    mode: "voice" | "text",
  ): Promise<Result<TurnResponse & { persona?: StartResponse["persona"] }>> {
    const flow = getFlow();
    const elapsedMs = Math.max(0, Date.now() - startedAt);

    let res: Result<TurnResponse & { persona?: StartResponse["persona"] }>;
    if (input === null || input.kind !== "audio") {
      res = await sendPreview(PREVIEW_TURN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flow,
          history: recentHistory(),
          elapsedMs,
          mode,
          ...(input?.kind === "text"
            ? { text: input.text }
            : input?.kind === "image"
              ? { text: input.text || "Please review my work." }
              : {}),
        }),
      });
    } else {
      const form = new FormData();
      const type = input.mimeType.split(";")[0] || "audio/webm";
      const ext = type.split("/")[1] ?? "webm";
      form.append("audio", new File([input.blob], `preview.${ext}`, { type }));
      form.append("flow", JSON.stringify(flow));
      form.append("history", JSON.stringify(recentHistory()));
      form.append("elapsedMs", String(elapsedMs));
      res = await sendPreview(PREVIEW_TURN_URL, { method: "POST", body: form });
    }

    if (!res.ok) return res;

    if (res.data.learnerText) {
      history.push({ role: "learner", text: res.data.learnerText });
    }
    const reply = sayText(res.data.events);
    if (reply) {
      history.push({ role: "tutor", text: reply });
    }
    return res;
  }

  return {
    async start(input: TutorStartRequest): Promise<Result<StartResponse>> {
      history = [];
      startedAt = Date.now();
      const mode = input.preferMode === "text" ? "text" : "voice";
      const flow = getFlow();
      const opening = await exchange(null, mode);
      if (!opening.ok) return opening;

      return {
        ok: true,
        data: {
          sessionId: `preview-${startedAt}`,
          mode,
          persona: opening.data.persona ?? {
            id: flow.personaId ?? "preview-default",
            name: "AI Teacher",
            displayName: "AI Teacher",
            languages: ["en"],
          },
          scenario: {
            id: flow.scenarioId ?? `draft-${startedAt}`,
            title: flow.title,
            goal: flow.goal,
            maxMinutes: flow.maxMinutes,
          },
          openingEvents: opening.data.events,
        },
      };
    },

    async turn(_sessionId: string, input: TutorTurnRequest): Promise<Result<TurnResponse>> {
      return exchange(input, "voice");
    },

    async complete(): Promise<Result<CompleteResponse>> {
      const flow = getFlow();
      const res = await sendPreview<{ report: TutorReportContent }>(PREVIEW_REPORT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flow, history: recentHistory() }),
      });
      if (!res.ok) return res;
      return { ok: true, data: { report: res.data.report, created: true } };
    },
  };
}
