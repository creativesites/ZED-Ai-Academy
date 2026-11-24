import { test } from "node:test";
import assert from "node:assert/strict";
import {
  float32ToInt16Pcm,
  int16ToBase64,
  LiveTurnAccumulator,
  liveToolCallToTutorEvent,
  pcm16Base64ToFloat32,
  rmsFromFloat32,
} from "./live-session.ts";

test("liveToolCallToTutorEvent converts valid tool calls into TutorEvents and rejects invalid ones", () => {
  const board = liveToolCallToTutorEvent({
    name: "show_board",
    args: { kind: "bullets", title: "Key Points", items: ["One", "Two"] },
  });
  assert.ok(board && board.type === "show_board");
  assert.equal(board.title, "Key Points");

  const gesture = liveToolCallToTutorEvent({ name: "gesture", args: { name: "wave" } });
  assert.deepEqual(gesture, { type: "gesture", name: "wave" });

  // `say` is spoken natively in Live and not a valid tool call
  assert.equal(liveToolCallToTutorEvent({ name: "say", args: { text: "hi" } }), null);
  assert.equal(liveToolCallToTutorEvent({ name: "unknown_tool", args: {} }), null);
  assert.equal(liveToolCallToTutorEvent({ name: "show_board", args: { kind: "bullets" } }), null);
});

test("LiveTurnAccumulator batches transcripts and events with monotonic idx and requeues on failure", () => {
  const acc = new LiveTurnAccumulator();
  acc.addTeacherTranscript("Hello there!", 1000);
  acc.addTeacherTranscript("Ready to start?", 1200);
  acc.addEvent({ type: "gesture", name: "wave" }, 1250);
  const t0 = acc.commitTurn(1500);
  assert.ok(t0);
  assert.equal(t0.idx, 0);
  assert.equal(t0.learnerText, null);
  assert.equal(t0.latencyMs, 500);
  assert.equal(t0.events.length, 2);
  assert.equal(t0.events[0].type, "say");

  acc.addLearnerTranscript("Yes, I am ready", 2000);
  acc.addTeacherTranscript("Great! Look at the board.", 2300);
  acc.addEvent({ type: "advance_step", step: "step_2" }, 2400);
  const t1 = acc.commitTurn(2600);
  assert.ok(t1);
  assert.equal(t1.idx, 1);
  assert.equal(t1.learnerText, "Yes, I am ready");

  const drained = acc.drain(20);
  assert.equal(drained.length, 2);
  assert.equal(acc.pendingCount(), 0);

  acc.requeue(drained);
  assert.equal(acc.pendingCount(), 2);
  assert.equal(acc.drain(1)[0].idx, 0);
});

test("PCM16 round-trip resampling and base64 conversion preserve waveform shape", () => {
  const input = new Float32Array(480);
  for (let i = 0; i < input.length; i += 1) {
    input[i] = Math.sin((2 * Math.PI * i) / 48) * 0.5;
  }
  // Downsample 48 kHz -> 16 kHz (3:1)
  const pcm = float32ToInt16Pcm(input, 48_000, 16_000);
  assert.equal(pcm.length, 160);

  const b64 = int16ToBase64(pcm);
  const decoded = pcm16Base64ToFloat32(b64);
  assert.equal(decoded.length, 160);
  assert.ok(rmsFromFloat32(decoded) > 0.3);
  assert.equal(rmsFromFloat32(new Float32Array(16)), 0);
});
