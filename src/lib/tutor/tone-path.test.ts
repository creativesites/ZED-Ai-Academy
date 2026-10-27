import { test } from "node:test";
import assert from "node:assert/strict";
import { samplePolyline, toneBoxPath, toneBoxPoint, tonePoints } from "./tone-path.ts";

const BOX = { x: 10, y: 20, w: 100, h: 200 };

test("samplePolyline hits both ends of a contour", () => {
  const start = samplePolyline(tonePoints("t2"), 0);
  const end = samplePolyline(tonePoints("t2"), 1);
  assert.ok(Math.abs(start[0] - 0) < 1e-9 && Math.abs(start[1] - 0.5) < 1e-9);
  assert.ok(Math.abs(end[0] - 1) < 1e-9 && Math.abs(end[1] - 0.03) < 1e-9);
});

test("a flat contour is sampled at constant speed", () => {
  const p = (u: number) => samplePolyline(tonePoints("t1"), u);
  const first = p(0.2)[0] - p(0.1)[0];
  const second = p(0.7)[0] - p(0.6)[0];
  assert.ok(Math.abs(first - second) < 1e-9);
  assert.ok(Math.abs(p(0.5)[0] - 0.5) < 1e-9);
});

test("a rising contour ends higher on the page than it starts", () => {
  const start = toneBoxPoint("t2", 0, BOX);
  const end = toneBoxPoint("t2", 1, BOX);
  assert.ok(end.y < start.y);
});

test("a dip-then-rise contour bottoms out in the middle", () => {
  const mid = toneBoxPoint("t3", 0.45, BOX);
  const start = toneBoxPoint("t3", 0, BOX);
  assert.ok(mid.y > start.y);
});

test("toneBoxPoint maps unit coordinates into the box", () => {
  const p = toneBoxPoint("t3", 0, BOX);
  assert.equal(p.x, 10);
  assert.ok(Math.abs(p.y - (20 + 0.75 * 200)) < 1e-9);
});

test("toneBoxPath emits one move and the right number of segments", () => {
  const d = toneBoxPath("t4", BOX, 10);
  assert.ok(d.startsWith("M"));
  assert.equal(d.split("L").length - 1, 10);
});
