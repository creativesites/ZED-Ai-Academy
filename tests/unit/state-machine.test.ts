import { describe, expect, it } from "vitest";
import { InvalidTransitionError, canTransition, nextStatus } from "@/lib/studio/domain/state-machine";

describe("live session state machine", () => {
  it("allows the normal lifecycle", () => {
    expect(nextStatus("draft", "scheduled")).toBe("scheduled");
    expect(nextStatus("scheduled", "live")).toBe("live");
    expect(nextStatus("live", "ended")).toBe("ended");
  });

  it("rejects skipping or reversing states", () => {
    expect(() => nextStatus("draft", "live")).toThrow(InvalidTransitionError);
    expect(() => nextStatus("ended", "live")).toThrow(InvalidTransitionError);
    expect(() => nextStatus("live", "scheduled")).toThrow(InvalidTransitionError);
  });

  it("is idempotent for the same state (double clicks, retries)", () => {
    expect(nextStatus("live", "live")).toBe("live");
    expect(nextStatus("ended", "ended")).toBe("ended");
  });

  it("treats ended and cancelled as terminal", () => {
    expect(canTransition("ended", "scheduled")).toBe(false);
    expect(canTransition("cancelled", "scheduled")).toBe(false);
  });

  it("lets a failed start be retried or cancelled", () => {
    expect(canTransition("failed", "scheduled")).toBe(true);
    expect(canTransition("failed", "cancelled")).toBe(true);
    expect(canTransition("failed", "live")).toBe(false);
  });
});
