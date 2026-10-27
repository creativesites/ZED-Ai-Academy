import { test } from "node:test";
import assert from "node:assert/strict";
import { applyModePreference } from "./mode-policy.ts";

test("an allowed preference overrides the policy's live choice", () => {
  assert.equal(
    applyModePreference({ chosen: "live", allowedModes: ["live", "voice", "text"], preferMode: "voice" }),
    "voice",
  );
});

test("a preference for a mode the scenario does not allow is ignored", () => {
  assert.equal(
    applyModePreference({ chosen: "live", allowedModes: ["live", "text"], preferMode: "voice" }),
    "live",
  );
});

test("without a preference the policy's choice stands", () => {
  assert.equal(applyModePreference({ chosen: "text", allowedModes: ["voice", "text"] }), "text");
});

test("text can be preferred when the mic is unavailable", () => {
  assert.equal(
    applyModePreference({ chosen: "voice", allowedModes: ["voice", "text"], preferMode: "text" }),
    "text",
  );
});
