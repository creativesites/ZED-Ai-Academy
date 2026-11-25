import { MAX_EVENTS_PER_TURN, tutorEventSchema, type TutorEvent } from "../contract/index.ts";

// Incremental parser for a streamed Voice/Text turn `{"events": [ {...}, {...} ], ...}` (P1-05, Architecture §3.2,
// D-04). Feed it the model's text chunks as they arrive; it returns each event as soon as that event's object closes,
// validated with the contract schema. Pure: no I/O, so node:test runs it on chunked fixtures.
//
// It is a scanner, not a JSON parser: it tracks strings (with escapes), nesting and the `events` key of the root
// object, and hands each complete event object to JSON.parse. Per-event handling matches `parseTutorTurn` exactly
// (invalid events dropped and counted, at most MAX_EVENTS_PER_TURN kept), so a clean stream yields the same events
// as the non-stream parse of the full text. Anything it cannot follow marks the parse incomplete; the caller then
// falls back to the non-stream parse of the whole text (turn-stream.ts).

export type TurnStreamParseResult = {
  /** True when the root object and its `events` array both closed and nothing was malformed. */
  complete: boolean;
  /** Valid events, in order (at most MAX_EVENTS_PER_TURN). */
  events: TutorEvent[];
  /** Elements of `events` that were not valid events, or past the cap. */
  dropped: number;
  /** Set when the scanner hit something it cannot follow. Scanning stops there. */
  error?: string;
};

export type TurnStreamParser = {
  /** Scans a chunk; returns the events that closed in it, in order. Never throws. */
  push(chunk: string): TutorEvent[];
  /** Current state. `complete` is final only once the stream has ended. */
  result(): TurnStreamParseResult;
};

const WHITESPACE = new Set([" ", "\t", "\n", "\r"]);

export function createTurnStreamParser(opts: { maxEvents?: number } = {}): TurnStreamParser {
  const maxEvents = opts.maxEvents ?? MAX_EVENTS_PER_TURN;
  let buf = "";
  let pos = 0;

  // Structure.
  const stack: ("{" | "[")[] = [];
  let rootStarted = false;
  let rootClosed = false;
  let inString = false;
  let escape = false;
  let stringStart = -1;
  let error: string | undefined;

  // Root-object keys (depth 1).
  let expectKey = false;
  let pendingKey: string | null = null;
  let currentKey: string | null = null;

  // The events array (depth 2 inside it).
  let eventsSeen = false;
  let inEvents = false;
  let eventsClosed = false;
  let elementStart = -1;
  let primitivePending = false;

  const events: TutorEvent[] = [];
  let dropped = 0;

  function takeElement(text: string, out: TutorEvent[]): void {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      dropped++;
      return;
    }
    if (events.length >= maxEvents) {
      dropped++;
      return;
    }
    const parsed = tutorEventSchema.safeParse(value);
    if (parsed.success) {
      events.push(parsed.data);
      out.push(parsed.data);
    } else {
      dropped++;
    }
  }

  function fail(message: string): void {
    error = message;
  }

  function push(chunk: string): TutorEvent[] {
    const out: TutorEvent[] = [];
    if (error || typeof chunk !== "string" || chunk.length === 0) return out;
    buf += chunk;

    for (; pos < buf.length; pos++) {
      if (error) break;
      const ch = buf[pos];

      if (inString) {
        if (escape) {
          escape = false;
        } else if (ch === "\\") {
          escape = true;
        } else if (ch === '"') {
          inString = false;
          // A string that is a root-object key.
          if (stack.length === 1 && expectKey) {
            try {
              pendingKey = JSON.parse(buf.slice(stringStart, pos + 1)) as string;
            } catch {
              pendingKey = null;
            }
            expectKey = false;
          }
        }
        continue;
      }

      if (!rootStarted) {
        // Skip anything before the root object (a stray fence or prose).
        if (ch === "{") {
          rootStarted = true;
          stack.push("{");
          expectKey = true;
        }
        continue;
      }
      if (rootClosed) continue; // trailing text is ignored

      if (ch === '"') {
        inString = true;
        stringStart = pos;
        if (inEvents && stack.length === 2) primitivePending = true; // a bare string element
        continue;
      }

      if (ch === "{" || ch === "[") {
        if (inEvents && stack.length === 2) {
          elementStart = pos;
          primitivePending = false;
        }
        if (ch === "[" && stack.length === 1 && currentKey === "events" && !eventsSeen) {
          eventsSeen = true;
          inEvents = true;
        }
        stack.push(ch);
        continue;
      }

      if (ch === "}" || ch === "]") {
        const open = stack.pop();
        if (open === undefined || (ch === "}" ? open !== "{" : open !== "[")) {
          fail(`unbalanced '${ch}' at ${pos}`);
          break;
        }
        if (inEvents && stack.length === 2 && elementStart >= 0) {
          // An element of the events array just closed.
          takeElement(buf.slice(elementStart, pos + 1), out);
          elementStart = -1;
        } else if (inEvents && stack.length === 1 && ch === "]") {
          if (primitivePending) dropped++;
          primitivePending = false;
          inEvents = false;
          eventsClosed = true;
        } else if (stack.length === 0) {
          rootClosed = true;
        }
        continue;
      }

      if (stack.length === 1) {
        if (ch === ",") {
          expectKey = true;
          currentKey = null;
        } else if (ch === ":") {
          currentKey = pendingKey;
          pendingKey = null;
        }
        continue;
      }

      if (inEvents && stack.length === 2) {
        if (ch === ",") {
          if (primitivePending) dropped++;
          primitivePending = false;
        } else if (!WHITESPACE.has(ch)) {
          primitivePending = true; // number, true/false/null element
        }
      }
    }

    return out;
  }

  function result(): TurnStreamParseResult {
    return {
      complete: !error && rootClosed && eventsSeen && eventsClosed,
      events: [...events],
      dropped,
      ...(error ? { error } : {}),
    };
  }

  return { push, result };
}
