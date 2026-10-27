import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseStartMode, MODE_THRESHOLDS, shouldDowngrade } from "./mode-policy.ts";

test("mic denied with text allowed starts in text", () => {
  assert.equal(
    chooseStartMode({ allowedModes: ["live", "voice", "text"], micPermission: "denied", rttMs: 50 }),
    "text",
  );
});

test("live is preferred when allowed, mic ok, RTT good and minutes left", () => {
  assert.equal(
    chooseStartMode({ allowedModes: ["live", "voice", "text"], micPermission: "granted", rttMs: 120, liveMinutesLeft: 5 }),
    "live",
  );
});

test("unknown RTT and unknown live minutes still allow live", () => {
  assert.equal(chooseStartMode({ allowedModes: ["live", "text"], micPermission: "prompt" }), "live");
});

test("RTT exactly at the threshold allows live, one above does not", () => {
  const at = chooseStartMode({
    allowedModes: ["live", "voice"],
    micPermission: "granted",
    rttMs: MODE_THRESHOLDS.liveStartRttMs,
  });
  const above = chooseStartMode({
    allowedModes: ["live", "voice"],
    micPermission: "granted",
    rttMs: MODE_THRESHOLDS.liveStartRttMs + 1,
  });
  assert.equal(at, "live");
  assert.equal(above, "voice");
});

test("no live minutes left falls back to voice", () => {
  assert.equal(
    chooseStartMode({ allowedModes: ["live", "voice", "text"], micPermission: "granted", liveMinutesLeft: 0 }),
    "voice",
  );
});

test("live not allowed falls back to voice, then to the first allowed mode", () => {
  assert.equal(chooseStartMode({ allowedModes: ["voice", "text"], micPermission: "granted" }), "voice");
  assert.equal(chooseStartMode({ allowedModes: ["text"], micPermission: "granted" }), "text");
});

test("mic denied and text not allowed returns the first allowed mode", () => {
  assert.equal(chooseStartMode({ allowedModes: ["voice"], micPermission: "denied" }), "voice");
});

test("empty allowedModes throws a clear error", () => {
  assert.throws(
    () => chooseStartMode({ allowedModes: [], micPermission: "granted" }),
    /allowedModes is empty/,
  );
});

test("live downgrades to voice on RTT, packet loss or consecutive errors past threshold", () => {
  const base = { mode: "live" as const, rttMs: 100, packetLoss: 0, consecutiveErrors: 0 };
  assert.equal(shouldDowngrade({ ...base }), null);
  assert.equal(shouldDowngrade({ ...base, rttMs: 600 }), null, "600 is not above 600");
  assert.equal(shouldDowngrade({ ...base, rttMs: 601 }), "voice");
  assert.equal(shouldDowngrade({ ...base, packetLoss: 0.08 }), null, "0.08 is not above 0.08");
  assert.equal(shouldDowngrade({ ...base, packetLoss: 0.09 }), "voice");
  assert.equal(shouldDowngrade({ ...base, consecutiveErrors: 1 }), null);
  assert.equal(shouldDowngrade({ ...base, consecutiveErrors: 2 }), "voice");
});

test("voice downgrades to text only after three consecutive errors", () => {
  const base = { mode: "voice" as const, rttMs: 9999, packetLoss: 1, consecutiveErrors: 2 };
  assert.equal(shouldDowngrade({ ...base }), null, "RTT and loss do not move voice");
  assert.equal(shouldDowngrade({ ...base, consecutiveErrors: 3 }), "text");
});

test("text never downgrades", () => {
  assert.equal(
    shouldDowngrade({ mode: "text", rttMs: 9999, packetLoss: 1, consecutiveErrors: 99 }),
    null,
  );
});
