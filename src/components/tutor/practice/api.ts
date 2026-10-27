// Browser calls to the ZAI Tutor session API (docs/TUTOR_API.md). Each call resolves to a result
// object and never throws, so the UI can show a friendly message for every failure.

import type { TutorEvent } from "@/lib/tutor/events";
import { parseTutorErrorBody, type TutorFailure } from "@/lib/tutor/client-errors";
import type { TutorReportContent } from "@/lib/tutor/report-model";
import type { Mode } from "@/lib/tutor/scenario";
import { uploadMimeType } from "@/lib/tutor/recording";

export type Result<T> = { ok: true; data: T } | { ok: false; failure: TutorFailure };

export type TutorPersona = { id: string; name: string; displayName: string | null; languages: string[] };
export type TutorScenario = { id: string; title: string; goal: string; maxMinutes: number };

export type StartResponse = {
  sessionId: string;
  mode: Mode;
  persona: TutorPersona;
  scenario: TutorScenario;
  openingEvents?: TutorEvent[];
};

export type TurnResponse = {
  turnIdx: number;
  learnerText: string | null;
  events: TutorEvent[];
  ended: boolean;
  endReason: "time_box" | "turn_limit" | "model_end" | null;
};

export type CompleteResponse = { report: TutorReportContent; created: boolean };

export type MicPermission = "granted" | "denied" | "prompt";

async function call<T>(input: string, init: RequestInit): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetch(input, { ...init, credentials: "same-origin" });
  } catch {
    return { ok: false, failure: { kind: "network" } };
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    return { ok: false, failure: { kind: "http", status: res.status, ...parseTutorErrorBody(body) } };
  }
  return { ok: true, data: body as T };
}

/**
 * Round-trip time to our own origin, in whole milliseconds, from a tiny HEAD request. Returns
 * undefined on failure, so the start request simply omits rttMs.
 */
export async function measureRttMs(timeoutMs = 3000): Promise<number | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    await fetch(`/favicon.ico?rtt=${Date.now()}`, { method: "HEAD", cache: "no-store", signal: controller.signal });
    return Math.round(performance.now() - started);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The browser's microphone permission state. "prompt" when the Permissions API is missing or
 * cannot answer, because the browser will ask on the first recording.
 */
export async function detectMicPermission(): Promise<MicPermission> {
  try {
    if (!navigator.permissions?.query) return "prompt";
    const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
    if (status.state === "granted") return "granted";
    if (status.state === "denied") return "denied";
    return "prompt";
  } catch {
    return "prompt";
  }
}

export type SessionOriginInput = "lesson" | "assignment" | "practice";

export function startTutorSession(input: {
  origin: SessionOriginInput;
  scenarioId?: string;
  lessonId?: string;
  assignmentId?: string;
  micPermission: MicPermission;
  rttMs?: number;
  preferMode?: "voice" | "text";
}): Promise<Result<StartResponse>> {
  return call<StartResponse>("/api/tutor/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: input.origin,
      ...(input.scenarioId ? { scenarioId: input.scenarioId } : {}),
      ...(input.lessonId ? { lessonId: input.lessonId } : {}),
      ...(input.assignmentId ? { assignmentId: input.assignmentId } : {}),
      micPermission: input.micPermission,
      ...(input.rttMs !== undefined ? { rttMs: input.rttMs } : {}),
      ...(input.preferMode ? { preferMode: input.preferMode } : {}),
    }),
  });
}

export function sendTutorText(sessionId: string, text: string): Promise<Result<TurnResponse>> {
  return call<TurnResponse>(`/api/tutor/sessions/${sessionId}/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

export function sendTutorAudio(sessionId: string, blob: Blob, recorderMime: string): Promise<Result<TurnResponse>> {
  const form = new FormData();
  const type = uploadMimeType(recorderMime || blob.type);
  form.append("audio", new File([blob], `turn.${type.split("/")[1] ?? "webm"}`, { type }));
  return call<TurnResponse>(`/api/tutor/sessions/${sessionId}/turn`, { method: "POST", body: form });
}

export function completeTutorSession(
  sessionId: string,
  totals: { learnerSpeakingMs: number; teacherSpeakingMs: number },
  status: "completed" | "abandoned",
): Promise<Result<CompleteResponse>> {
  return call<CompleteResponse>(`/api/tutor/sessions/${sessionId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...totals, status }),
  });
}

// The seam between the session UI and its backend. The HTTP client below is the default. The public
// showcase injects a demo client (signed-in, stateless demo API) or a scripted one (no network).
export type TutorStartRequest = {
  origin: SessionOriginInput;
  scenarioId?: string;
  lessonId?: string;
  assignmentId?: string;
  micPermission: MicPermission;
  rttMs?: number;
  preferMode?: "voice" | "text";
};

export type TutorTurnRequest = { kind: "text"; text: string } | { kind: "audio"; blob: Blob; mimeType: string };

export type TutorApiClient = {
  start(input: TutorStartRequest): Promise<Result<StartResponse>>;
  turn(sessionId: string, input: TutorTurnRequest): Promise<Result<TurnResponse>>;
  complete(
    sessionId: string,
    totals: { learnerSpeakingMs: number; teacherSpeakingMs: number },
    status: "completed" | "abandoned",
  ): Promise<Result<CompleteResponse>>;
};

export const httpTutorClient: TutorApiClient = {
  start: startTutorSession,
  turn: (sessionId, input) =>
    input.kind === "text"
      ? sendTutorText(sessionId, input.text)
      : sendTutorAudio(sessionId, input.blob, input.mimeType),
  complete: completeTutorSession,
};
