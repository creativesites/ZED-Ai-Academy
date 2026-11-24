import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { VadTracker } from "./vad.ts";

describe("tutor/vad", () => {
  it("stays waiting on silence or brief noise spikes", () => {
    const vad = new VadTracker({ speechThreshold: 0.1, silenceThreshold: 0.05, minSpeechMs: 200, silenceHoldMs: 1000 });
    assert.equal(vad.update(0.02, 0), "waiting");
    assert.equal(vad.update(0.15, 100), "waiting"); // brief spike
    assert.equal(vad.update(0.01, 200), "waiting"); // resets
    assert.equal(vad.hasDetectedSpeech, false);
  });

  it("transitions waiting -> speaking -> commit after sustained speech and silence", () => {
    const vad = new VadTracker({ speechThreshold: 0.1, silenceThreshold: 0.05, minSpeechMs: 200, silenceHoldMs: 1000 });
    assert.equal(vad.update(0.14, 0), "waiting");
    assert.equal(vad.update(0.16, 220), "speaking");
    assert.equal(vad.hasDetectedSpeech, true);

    // Brief pause shouldn't commit
    assert.equal(vad.update(0.02, 500), "speaking");
    assert.equal(vad.update(0.02, 1100), "speaking");
    // Resumes talking -> resets silence timer
    assert.equal(vad.update(0.15, 1200), "speaking");
    // Final silence >= 1000ms -> commit
    assert.equal(vad.update(0.02, 1500), "speaking");
    assert.equal(vad.update(0.01, 2500), "commit");
  });

  it("resets cleanly between turns", () => {
    const vad = new VadTracker({ minSpeechMs: 100, silenceHoldMs: 500 });
    vad.update(0.2, 0);
    vad.update(0.2, 150);
    assert.equal(vad.hasDetectedSpeech, true);
    vad.reset();
    assert.equal(vad.hasDetectedSpeech, false);
    assert.equal(vad.update(0.01, 1000), "waiting");
  });
});
