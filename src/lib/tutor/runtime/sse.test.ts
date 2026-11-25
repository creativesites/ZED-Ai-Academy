import { test } from "node:test";
import assert from "node:assert/strict";
import { createSseParser, formatSse, sseComment } from "./sse.ts";

test("formatSse round-trips through the parser in any chunking", () => {
  const payloads = [
    { type: "say", text: 'Line with "quotes", unicode é 你好 and \\n escapes' },
    { turnIdx: 3, events: [], ended: false, endReason: null },
  ];
  const wire = sseComment("open") + formatSse("event", payloads[0]) + formatSse("done", payloads[1]);
  for (const size of [1, 2, 5, 13, wire.length]) {
    const parser = createSseParser();
    const messages = [];
    for (let i = 0; i < wire.length; i += size) messages.push(...parser.push(wire.slice(i, i + size)));
    messages.push(...parser.flush());
    assert.equal(messages.length, 2, `size ${size}`);
    assert.equal(messages[0].event, "event");
    assert.deepEqual(JSON.parse(messages[0].data), payloads[0]);
    assert.equal(messages[1].event, "done");
    assert.deepEqual(JSON.parse(messages[1].data), payloads[1]);
  }
});

test("CRLF line endings, split CR/LF and multi-line data", () => {
  const parser = createSseParser();
  const out = [
    ...parser.push("event: x\r"),
    ...parser.push("\ndata: a\r\ndata: b\r\n"),
    ...parser.push("\r\n"),
  ];
  assert.deepEqual(out, [{ event: "x", data: "a\nb" }]);
});

test("messages without an event name are 'message'; comments and unknown fields are ignored", () => {
  const parser = createSseParser();
  const out = parser.push(": ping\nid: 1\nretry: 5\ndata:no-space\n\n");
  assert.deepEqual(out, [{ event: "message", data: "no-space" }]);
});

test("flush dispatches a final message with no trailing blank line", () => {
  const parser = createSseParser();
  assert.deepEqual(parser.push("event: done\ndata: {}"), []);
  assert.deepEqual(parser.flush(), [{ event: "done", data: "{}" }]);
});

test("formatSse never emits raw newlines inside a data line", () => {
  const wire = formatSse("event", "a\nb");
  assert.equal(wire, 'event: event\ndata: "a\\nb"\n\n');
  assert.equal(sseComment("x\ny"), ": x y\n\n");
});
