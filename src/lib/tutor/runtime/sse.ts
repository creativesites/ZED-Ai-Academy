// Server-Sent Events framing for streamed tutor turns (P1-05). Pure: used by the route (formatSse) and the browser
// helper (createSseParser), tested with node:test.
//
// Wire protocol of POST /api/tutor/sessions/:id/turn?stream=1:
//   event: event   data: <one TutorEvent, client-safe>         (0..n, as each closes)
//   event: done    data: <same JSON as the non-stream response> (exactly once on success)
//   event: error   data: { error, status }                     (instead of done on failure)

export type SseMessage = { event: string; data: string };

export const TURN_STREAM_EVENTS = { event: "event", done: "done", error: "error" } as const;

/** One SSE message. `data` is JSON-encoded; newlines inside are split into several data lines per the spec. */
export function formatSse(event: string, data: unknown): string {
  const json = JSON.stringify(data) ?? "null";
  const lines = json.split(/\r\n|\r|\n/).map((line) => `data: ${line}`);
  return `event: ${event}\n${lines.join("\n")}\n\n`;
}

/** An SSE comment line (ignored by parsers), used to flush headers before the first event. */
export function sseComment(text: string): string {
  return `: ${text.replace(/[\r\n]+/g, " ")}\n\n`;
}

/**
 * Incremental SSE parser: push decoded text as it arrives, get complete messages back. Handles CRLF, multi-line
 * data, comments and messages split across chunks. Messages without an `event:` field are named "message".
 */
export function createSseParser(): { push(text: string): SseMessage[]; flush(): SseMessage[] } {
  let buffer = "";
  let event = "";
  let data: string[] = [];

  function dispatchLine(line: string, out: SseMessage[]): void {
    if (line === "") {
      if (data.length > 0) out.push({ event: event || "message", data: data.join("\n") });
      event = "";
      data = [];
      return;
    }
    if (line.startsWith(":")) return;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
  }

  function push(text: string): SseMessage[] {
    const out: SseMessage[] = [];
    buffer += text;
    // Keep a trailing "\r" in the buffer: it may be the first half of a CRLF split across chunks.
    let match: RegExpExecArray | null;
    const lineEnd = /\r\n|\n|\r(?!$)/g;
    let consumed = 0;
    while ((match = lineEnd.exec(buffer)) !== null) {
      dispatchLine(buffer.slice(consumed, match.index), out);
      consumed = match.index + match[0].length;
    }
    buffer = buffer.slice(consumed);
    return out;
  }

  function flush(): SseMessage[] {
    const out: SseMessage[] = [];
    if (buffer) {
      dispatchLine(buffer.replace(/\r$/, ""), out);
      buffer = "";
    }
    dispatchLine("", out);
    return out;
  }

  return { push, flush };
}
