import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CARD_WAIT_MAX_MS,
  cardWaitMs,
  sayDurationMs,
  scheduleVisemes,
  toneDurationMs,
  toneTimeoutMs,
  visemeAt,
} from "./event-timing.ts";
import { visemeTimelineFromText } from "./visemes.ts";

test("cardWaitMs waits only after a point_card with no peak yet", () => {
  assert.equal(cardWaitMs({ previousIsPointCard: false, peakSeen: false, elapsedMs: 0 }), 0);
  assert.equal(cardWaitMs({ previousIsPointCard: true, peakSeen: true, elapsedMs: 0 }), 0);
  assert.equal(cardWaitMs({ previousIsPointCard: true, peakSeen: false, elapsedMs: 0 }), 700);
  assert.equal(cardWaitMs({ previousIsPointCard: true, peakSeen: false, elapsedMs: 300 }), 400);
  assert.equal(cardWaitMs({ previousIsPointCard: true, peakSeen: false, elapsedMs: 900 }), 0);
});

test("cardWaitMs never exceeds the maximum", () => {
  const wait = cardWaitMs({ previousIsPointCard: true, peakSeen: false, elapsedMs: -5000 });
  assert.ok(wait <= CARD_WAIT_MAX_MS);
});

test("scheduleVisemes turns 你好 into timed steps", () => {
  const schedule = scheduleVisemes(visemeTimelineFromText("你好"));
  assert.equal(schedule.totalMs, 500);
  assert.deepEqual(schedule.steps, [
    { atMs: 0, viseme: 1 },
    { atMs: 120, viseme: 2 },
    { atMs: 210, viseme: 0 },
    { atMs: 250, viseme: 1 },
    { atMs: 370, viseme: 2 },
    { atMs: 460, viseme: 0 },
  ]);
});

test("scheduleVisemes drops zero-length segments and empty input is silent", () => {
  const schedule = scheduleVisemes([
    { viseme: 1, ms: 0 },
    { viseme: 3, ms: 50 },
  ]);
  assert.deepEqual(schedule, { steps: [{ atMs: 0, viseme: 3 }], totalMs: 50 });
  assert.deepEqual(scheduleVisemes([]), { steps: [], totalMs: 0 });
});

test("visemeAt reads the viseme in force and rests outside the timeline", () => {
  const schedule = scheduleVisemes(visemeTimelineFromText("你好"));
  assert.equal(visemeAt(schedule, 0), 1);
  assert.equal(visemeAt(schedule, 119), 1);
  assert.equal(visemeAt(schedule, 120), 2);
  assert.equal(visemeAt(schedule, 215), 0);
  assert.equal(visemeAt(schedule, 499), 0);
  assert.equal(visemeAt(schedule, 500), 0);
  assert.equal(visemeAt(schedule, -1), 0);
});

test("sayDurationMs sums segment durations", () => {
  assert.equal(sayDurationMs(visemeTimelineFromText("Hola")), 60 + 100 + 60 + 100);
});

test("tone durations come from the contract and timeouts add slack", () => {
  assert.equal(toneDurationMs("t3"), 1100);
  assert.equal(toneTimeoutMs("t3"), 1100 + 1200);
  assert.equal(toneDurationMs("neutral"), 400);
});
