import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FpsGuard,
  SceneVmController,
  TeacherVmController,
  ambienceOn,
  parseHexColor,
  toAvatarEvent,
  type VmPort,
} from "./rive-driver.ts";

type Write = [kind: string, name: string, value?: unknown];

function recordingPort(): { port: VmPort; writes: Write[] } {
  const writes: Write[] = [];
  const port: VmPort = {
    setEnum: (name, value) => writes.push(["enum", name, value]),
    setNumber: (name, value) => writes.push(["number", name, value]),
    setBoolean: (name, value) => writes.push(["boolean", name, value]),
    setColor: (name, rgb) => writes.push(["color", name, rgb]),
    fireTrigger: (name) => writes.push(["trigger", name]),
  };
  return { port, writes };
}

const last = (writes: Write[], name: string) => writes.filter((w) => w[1] === name).at(-1)?.[2];

test("parseHexColor accepts #rrggbb and #rgb, rejects anything else", () => {
  assert.deepEqual(parseHexColor("#E8B48F"), [0xe8, 0xb4, 0x8f]);
  assert.deepEqual(parseHexColor("2fa37f"), [0x2f, 0xa3, 0x7f]);
  assert.deepEqual(parseHexColor("#fff"), [255, 255, 255]);
  assert.equal(parseHexColor("#12345"), null);
  assert.equal(parseHexColor("red"), null);
  assert.equal(parseHexColor(""), null);
});

test("calls made before attach are kept and written on attach, with one playGesture trigger", () => {
  const c = new TeacherVmController();
  c.playGesture("wave");
  c.setMood("happy", 90);
  c.setViseme(3);
  const { port, writes } = recordingPort();
  c.attach(port);
  assert.equal(last(writes, "gesture"), "wave");
  assert.equal(last(writes, "mood"), "happy");
  assert.equal(last(writes, "moodIntensity"), 90);
  assert.equal(last(writes, "viseme"), 3);
  assert.equal(writes.filter((w) => w[0] === "trigger" && w[1] === "playGesture").length, 1);
});

test("playGesture sets the enum before the trigger, and count/trace fields only when relevant", () => {
  const c = new TeacherVmController();
  const { port, writes } = recordingPort();
  c.attach(port);
  writes.length = 0;
  c.playGesture("count", { countTo: 4 });
  const idx = writes.findIndex((w) => w[0] === "trigger");
  assert.equal(idx, writes.length - 1, "trigger is last");
  assert.deepEqual(writes[0], ["enum", "gesture", "count"]);
  assert.deepEqual(last(writes, "countTo"), 4);

  writes.length = 0;
  c.playGesture("trace_tone", { toneShape: "t3" });
  assert.deepEqual(last(writes, "toneShape"), "t3");
  writes.length = 0;
  c.playGesture("trace_tone");
  assert.deepEqual(last(writes, "toneShape"), "t1", "trace_tone without a shape defaults to t1");
});

test("countTo is clamped to 1..5 and rounded", () => {
  const c = new TeacherVmController();
  const { port, writes } = recordingPort();
  c.attach(port);
  c.playGesture("count", { countTo: 9 });
  assert.equal(last(writes, "countTo"), 5);
  c.playGesture("count", { countTo: 0 });
  assert.equal(last(writes, "countTo"), 1);
});

test("viseme is clamped to 0..8, and speaking off closes the mouth", () => {
  const c = new TeacherVmController();
  const { port, writes } = recordingPort();
  c.attach(port);
  c.setViseme(12 as never);
  assert.equal(last(writes, "viseme"), 8);
  c.setSpeaking(true);
  c.setViseme(4);
  c.setSpeaking(false);
  assert.equal(last(writes, "speaking"), false);
  assert.equal(last(writes, "viseme"), 0);
});

test("listening sets voiceLevel only when a level is given; look is clamped", () => {
  const c = new TeacherVmController();
  const { port, writes } = recordingPort();
  c.attach(port);
  writes.length = 0;
  c.setListening(true);
  assert.equal(writes.some((w) => w[1] === "voiceLevel"), false);
  c.setListening(true, 140);
  assert.equal(last(writes, "voiceLevel"), 100);
  c.lookAt(-300, 50.6);
  assert.equal(last(writes, "lookX"), -100);
  assert.equal(last(writes, "lookY"), 51);
});

test("persona colours go to the runtime as RGB; invalid colours are ignored", () => {
  const c = new TeacherVmController();
  const { port, writes } = recordingPort();
  c.attach(port);
  writes.length = 0;
  c.setLook({ skinColor: "#7A4A30", hairColor: "not-a-colour", faceStyle: "tinashe", hairStyle: "short" });
  assert.deepEqual(last(writes, "skinColor"), [0x7a, 0x4a, 0x30]);
  assert.equal(writes.some((w) => w[1] === "hairColor"), false);
  assert.equal(last(writes, "faceStyle"), "tinashe");
  assert.equal(last(writes, "hairStyle"), "short");
  assert.equal(c.snapshot().look.hairColor, "#2A2230", "the previous hair colour stays");
});

test("reduced motion is written and kept across attach", () => {
  const c = new TeacherVmController();
  c.setReducedMotion(true);
  const { port, writes } = recordingPort();
  c.attach(port);
  assert.equal(last(writes, "reducedMotion"), true);
});

test("detached calls do not throw and do not write", () => {
  const c = new TeacherVmController();
  assert.doesNotThrow(() => {
    c.setMood("curious");
    c.setSpeaking(true);
    c.lookAt(10, 10);
  });
  assert.equal(c.attached, false);
});

test("toAvatarEvent keeps contract events and drops unknown names or values", () => {
  assert.deepEqual(toAvatarEvent("gesturePeak", { gesture: "point_card" }), { type: "gesturePeak", gesture: "point_card" });
  assert.deepEqual(toAvatarEvent("traceEnd", { toneShape: "t2" }), { type: "traceEnd", toneShape: "t2" });
  assert.deepEqual(toAvatarEvent("gestureStart", { gesture: "moonwalk" }), { type: "gestureStart" });
  assert.equal(toAvatarEvent("somethingElse", { gesture: "wave" }), null);
  assert.deepEqual(toAvatarEvent("gestureEnd"), { type: "gestureEnd" });
});

test("FpsGuard: 3 s warm-up, then 2 s windows; fires once after two low windows in a row", () => {
  const windows: number[] = [];
  let low = 0;
  const g = new FpsGuard({ settleMs: 0, onWindow: (f) => windows.push(f), onLowPerformance: () => low++ });
  // 30 fps for 3 s: the warm-up window is low (1 of 2).
  let t = 0;
  for (let i = 0; i <= 90; i++) g.frame((t = i * (1000 / 30)));
  assert.equal(windows.length, 1);
  assert.ok(Math.abs(windows[0] - 30) < 1);
  assert.equal(low, 0);
  // Another 2 s at 30 fps: second low window in a row, so it fires.
  for (let i = 1; i <= 60; i++) g.frame(t + i * (1000 / 30));
  assert.equal(low, 1);
  assert.equal(g.triggered, true);
  // Keeps reporting, but never fires again.
  for (let i = 1; i <= 240; i++) g.frame(t + 2000 + i * (1000 / 30));
  assert.equal(low, 1);
  assert.ok(windows.length > 2);
});

test("FpsGuard: the settle second after reset is not counted, so a slow page load does not trigger", () => {
  let low = 0;
  const windows: number[] = [];
  const g = new FpsGuard({ onWindow: (f) => windows.push(f), onLowPerformance: () => low++ });
  // The first second is a load stall at 10 fps. After it the page runs at 60 fps.
  let t = 0;
  for (let i = 0; i <= 10; i++) g.frame((t = i * 100));
  for (let i = 1; i <= 360; i++) g.frame(t + i * (1000 / 60));
  assert.equal(low, 0);
  assert.ok(windows.length >= 1);
  assert.ok(windows.every((f) => f > 55), `windows: ${windows.map(Math.round).join(", ")}`);
});

test("FpsGuard: a healthy window resets the low run, and 60 fps never fires", () => {
  let low = 0;
  const g = new FpsGuard({ settleMs: 0, onLowPerformance: () => low++ });
  let t = 0;
  for (let i = 0; i <= 180; i++) g.frame((t = i * (1000 / 60)));
  for (let i = 1; i <= 240; i++) g.frame(t + i * (1000 / 60));
  assert.equal(low, 0);
  assert.equal(g.triggered, false);
});

test("FpsGuard: reset discards a hidden gap so it is not counted as slow frames", () => {
  let low = 0;
  const g = new FpsGuard({ onLowPerformance: () => low++ });
  g.frame(0);
  // The tab is hidden for 60 s, then the frames resume at 60 fps.
  g.reset(60_000);
  let t = 60_000;
  for (let i = 1; i <= 180; i++) g.frame((t = 60_000 + i * (1000 / 60)));
  for (let i = 1; i <= 120; i++) g.frame(t + i * (1000 / 60));
  assert.equal(low, 0);
});

test("ambience is off when reduced motion is on or the page is struggling", () => {
  assert.equal(ambienceOn({ ambience: true, reducedMotion: false, lowPerformance: false }), true);
  assert.equal(ambienceOn({ ambience: true, reducedMotion: true, lowPerformance: false }), false);
  assert.equal(ambienceOn({ ambience: true, reducedMotion: false, lowPerformance: true }), false);
  assert.equal(ambienceOn({ ambience: false, reducedMotion: false, lowPerformance: false }), false);
});

test("SceneVmController writes the effective ambience and holds parallax under reduced motion", () => {
  const s = new SceneVmController();
  s.setOptions({ parallaxX: 40, parallaxY: -20 });
  const { port, writes } = recordingPort();
  s.attach(port);
  assert.equal(last(writes, "ambience"), true);
  assert.equal(last(writes, "parallaxX"), 40);

  writes.length = 0;
  s.setOptions({ lowPerformance: true });
  assert.equal(last(writes, "ambience"), false);

  writes.length = 0;
  s.setOptions({ lowPerformance: false, reducedMotion: true });
  assert.equal(last(writes, "ambience"), false);
  assert.equal(last(writes, "parallaxX"), 0);
  assert.equal(last(writes, "parallaxY"), 0);
  assert.equal(last(writes, "reducedMotion"), true);
});

test("SceneVmController celebrate before attach fires once on attach", () => {
  const s = new SceneVmController();
  s.celebrate();
  const { port, writes } = recordingPort();
  s.attach(port);
  assert.equal(writes.filter((w) => w[0] === "trigger" && w[1] === "celebrate").length, 1);
  writes.length = 0;
  s.celebrate();
  assert.equal(writes.filter((w) => w[0] === "trigger" && w[1] === "celebrate").length, 1);
});
