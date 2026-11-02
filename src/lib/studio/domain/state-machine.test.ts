import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { InvalidTransitionError, canTransition, nextStatus } from "./state-machine.ts";

describe("live session state machine", () => {
  it("allows the normal lifecycle", () => {
    assert.equal(nextStatus("draft", "scheduled"), "scheduled");
    assert.equal(nextStatus("scheduled", "live"), "live");
    assert.equal(nextStatus("live", "ended"), "ended");
  });

  it("rejects skipping or reversing states", () => {
    assert.throws(() => nextStatus("draft", "live"), InvalidTransitionError);
    assert.throws(() => nextStatus("ended", "live"), InvalidTransitionError);
    assert.throws(() => nextStatus("live", "scheduled"), InvalidTransitionError);
  });

  it("is idempotent for the same state (double clicks, retries)", () => {
    assert.equal(nextStatus("live", "live"), "live");
    assert.equal(nextStatus("ended", "ended"), "ended");
  });

  it("treats ended and cancelled as terminal", () => {
    assert.equal(canTransition("ended", "scheduled"), false);
    assert.equal(canTransition("cancelled", "scheduled"), false);
  });

  it("lets a failed start be retried or cancelled", () => {
    assert.equal(canTransition("failed", "scheduled"), true);
    assert.equal(canTransition("failed", "cancelled"), true);
    assert.equal(canTransition("failed", "live"), false);
  });
});
