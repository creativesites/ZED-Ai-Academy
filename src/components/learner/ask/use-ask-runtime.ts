"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TutorEvent } from "@/lib/tutor/events";
import { expandLegacyDirectives, type AskClientTurn } from "@/lib/tutor/runtime/ask";
import { streamTutorText } from "@/components/tutor/practice/stream-api";

// The lesson Ask dock on the Teacher Runtime (P1-06): finds or creates the learner's `ask` session for the lesson,
// loads the conversation from the server (nothing is kept in localStorage), and sends turns through the streaming
// turn endpoint. When the runtime is off or unavailable (flag off, guest, not enrolled, schema not applied) the status
// is "legacy" and the dock keeps its /api/ai/tutor path unchanged.

export type AskMessage =
  | { key: string; role: "user"; text: string }
  | { key: string; role: "assistant"; events: TutorEvent[]; pending?: boolean; failed?: string };

export type AskRuntimeStatus = "checking" | "ready" | "legacy";

export type AskRuntimeHooks = {
  /** A turn was sent (thinking gesture). */
  onTurnStart?: () => void;
  /** One event arrived while the teacher was still writing. */
  onStreamEvent?: (event: TutorEvent) => void;
  /** The turn finished. `streamed` is how many events already arrived through onStreamEvent. */
  onTurnDone?: (events: TutorEvent[], streamed: number) => void;
  onTurnFailed?: () => void;
};

let keySeq = 0;
const nextKey = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(keySeq++).toString(36)}`;

function messagesFromTurns(turns: AskClientTurn[]): AskMessage[] {
  const out: AskMessage[] = [];
  for (const turn of turns) {
    if (turn.learnerText && turn.learnerText.trim()) {
      out.push({ key: `t${turn.idx}-u`, role: "user", text: turn.learnerText });
    }
    out.push({ key: `t${turn.idx}-a`, role: "assistant", events: expandLegacyDirectives(turn.events) });
  }
  return out;
}

type EnsureResponse = { sessionId: string; turns: AskClientTurn[] };

async function ensureAskSession(lessonId: string, restart: boolean): Promise<EnsureResponse | null> {
  try {
    const res = await fetch("/api/tutor/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ lessonId, ...(restart ? { restart: true } : {}) }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<EnsureResponse>;
    if (typeof body.sessionId !== "string" || !Array.isArray(body.turns)) return null;
    return { sessionId: body.sessionId, turns: body.turns };
  } catch {
    return null;
  }
}

export function useAskRuntime(input: { lessonId: string; enabled: boolean } & AskRuntimeHooks) {
  const { lessonId, enabled } = input;
  // The outcome of the find-or-create call for a lesson. Status is derived, so a lesson change shows "checking"
  // until that lesson's conversation has loaded.
  const [loaded, setLoaded] = useState<{ lessonId: string; ok: boolean } | null>(null);
  const status: AskRuntimeStatus = !enabled
    ? "legacy"
    : loaded?.lessonId !== lessonId
      ? "checking"
      : loaded.ok
        ? "ready"
        : "legacy";
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const endedRef = useRef(false);
  const busyRef = useRef(false);
  const hooksRef = useRef<AskRuntimeHooks>(input);
  useEffect(() => {
    hooksRef.current = {
      onTurnStart: input.onTurnStart,
      onStreamEvent: input.onStreamEvent,
      onTurnDone: input.onTurnDone,
      onTurnFailed: input.onTurnFailed,
    };
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    sessionIdRef.current = null;
    endedRef.current = false;
    void ensureAskSession(lessonId, false).then((res) => {
      if (cancelled) return;
      if (res) {
        sessionIdRef.current = res.sessionId;
        setMessages(messagesFromTurns(res.turns));
      }
      setLoaded({ lessonId, ok: res !== null });
    });
    return () => {
      cancelled = true;
    };
  }, [lessonId, enabled]);

  const patchAssistant = useCallback((key: string, patch: (m: Extract<AskMessage, { role: "assistant" }>) => AskMessage) => {
    setMessages((prev) => prev.map((m) => (m.key === key && m.role === "assistant" ? patch(m) : m)));
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        // The last conversation hit its limit (or was closed elsewhere): continue in a fresh one.
        if (endedRef.current || !sessionIdRef.current) {
          const fresh = await ensureAskSession(lessonId, false);
          if (fresh) {
            sessionIdRef.current = fresh.sessionId;
            endedRef.current = false;
          }
        }
        const sessionId = sessionIdRef.current;
        const assistantKey = nextKey("a");
        setMessages((prev) => [
          ...prev,
          { key: nextKey("u"), role: "user", text: trimmed },
          { key: assistantKey, role: "assistant", events: [], pending: true },
        ]);
        if (!sessionId) {
          patchAssistant(assistantKey, (m) => ({ ...m, pending: false, failed: "Something went wrong. Please try again." }));
          hooksRef.current.onTurnFailed?.();
          return;
        }

        hooksRef.current.onTurnStart?.();
        let streamed = 0;
        const result = await streamTutorText(sessionId, trimmed, {
          onEvent: (event) => {
            streamed++;
            const expanded = expandLegacyDirectives([event]);
            patchAssistant(assistantKey, (m) => ({ ...m, events: [...m.events, ...expanded] }));
            for (const e of expanded) hooksRef.current.onStreamEvent?.(e);
          },
        });

        if (result.ok) {
          const events = expandLegacyDirectives(result.data.events ?? []);
          patchAssistant(assistantKey, (m) => ({ ...m, events, pending: false }));
          if (result.data.ended) endedRef.current = true;
          hooksRef.current.onTurnDone?.(events, streamed);
          return;
        }

        const notActive = result.failure.kind === "http" && result.failure.status === 409 && /not active/i.test(result.failure.error ?? "");
        if (notActive) endedRef.current = true;
        patchAssistant(assistantKey, (m) => ({
          ...m,
          pending: false,
          failed: notActive
            ? "This conversation has ended. Send your question again to start a new one."
            : result.failure.kind === "http" && result.failure.status === 409
              ? "Another reply was saved at the same time. Try again."
              : "Something went wrong. Please try again.",
        }));
        hooksRef.current.onTurnFailed?.();
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [lessonId, patchAssistant],
  );

  /** Closes the current conversation and starts a new one. False when the server could not. */
  const restart = useCallback(async (): Promise<boolean> => {
    if (busyRef.current) return false;
    const res = await ensureAskSession(lessonId, true);
    if (!res) return false;
    sessionIdRef.current = res.sessionId;
    endedRef.current = false;
    setMessages(messagesFromTurns(res.turns));
    return true;
  }, [lessonId]);

  return { status, messages, busy, send, restart };
}
