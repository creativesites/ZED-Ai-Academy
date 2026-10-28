import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTutorErrorBody, tutorErrorMessage } from "./client-errors.ts";

test("entitlement reasons map to their own message", () => {
  assert.match(tutorErrorMessage({ kind: "http", status: 403, reason: "free_minutes_exhausted" }), /free practice minutes/);
  assert.match(tutorErrorMessage({ kind: "http", status: 403, reason: "practice_disabled" }), /turned off/);
});

test("a known reason wins over the status", () => {
  const msg = tutorErrorMessage({ kind: "http", status: 404, reason: "scenario_not_found" }, "start");
  assert.equal(msg, "We could not find that scenario.");
});

test("unknown 403 reasons fall back to the generic access message", () => {
  assert.equal(
    tutorErrorMessage({ kind: "http", status: 403, reason: "something_new" }),
    "You do not have access to this practice session.",
  );
});

test("409 says the session ended only when the server says it is not active", () => {
  const ended = tutorErrorMessage({ kind: "http", status: 409, error: "Session is not active", });
  const collision = tutorErrorMessage({ kind: "http", status: 409, error: "Another turn was saved at the same time." });
  assert.match(ended, /already ended/);
  assert.match(collision, /still catching up/);
});

test("audio and rate-limit statuses have actionable messages", () => {
  assert.match(tutorErrorMessage({ kind: "http", status: 413 }), /30 seconds/);
  assert.match(tutorErrorMessage({ kind: "http", status: 415 }), /text mode/);
  assert.match(tutorErrorMessage({ kind: "http", status: 422 }), /hear any speech/);
  assert.match(tutorErrorMessage({ kind: "http", status: 429 }), /Try again later/);
});

test("502 wording differs for completing a session", () => {
  assert.match(tutorErrorMessage({ kind: "http", status: 502 }, "turn"), /could not respond/);
  assert.match(tutorErrorMessage({ kind: "http", status: 502 }, "complete"), /taking longer/);
});

test("network failures and unknown statuses never expose raw text", () => {
  assert.match(tutorErrorMessage({ kind: "network" }), /offline/);
  assert.equal(
    tutorErrorMessage({ kind: "http", status: 500, error: "relation secret_table does not exist" }),
    "Something went wrong on our side. Try again.",
  );
});

test("parseTutorErrorBody keeps only string fields", () => {
  assert.deepEqual(parseTutorErrorBody({ error: "x", reason: "y", issues: [] }), { error: "x", reason: "y" });
  assert.deepEqual(parseTutorErrorBody({ error: 5, reason: null }), { error: undefined, reason: undefined });
  assert.deepEqual(parseTutorErrorBody("oops"), {});
  assert.deepEqual(parseTutorErrorBody(null), {});
});

test("parseTutorErrorBody keeps the server's detail and the Gemini reasons have messages", () => {
  assert.deepEqual(parseTutorErrorBody({ error: "x", reason: "gemini_auth", detail: "key rejected" }), {
    error: "x",
    reason: "gemini_auth",
    detail: "key rejected",
  });
  assert.match(tutorErrorMessage({ kind: "http", status: 502, reason: "gemini_auth" }), /key was rejected/);
  assert.match(tutorErrorMessage({ kind: "http", status: 502, reason: "gemini_no_key" }), /missing/);
});
