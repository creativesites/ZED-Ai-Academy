import { test } from "node:test";
import assert from "node:assert/strict";
import { describeGeminiError, worthTryingAnotherModel } from "./gemini-errors.ts";

function apiError(status: number, message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

test("an invalid key is an auth error, and the key never appears in the detail", () => {
  const info = describeGeminiError(
    apiError(400, 'got status: 400 Bad Request. {"error":{"message":"API key not valid. Please pass a valid API key. AIzaSyAbcdefghijklmnopqrstuvwxyz012345"}}'),
  );
  assert.equal(info.code, "auth");
  assert.equal(info.status, 400);
  assert.ok(!info.detail.includes("AIza"));
});

test("a missing key before any request is no_key", () => {
  const info = describeGeminiError(new Error("API key must be set when using the Gemini API."));
  assert.equal(info.code, "no_key");
});

test("model, quota, bad request and outage errors are told apart", () => {
  assert.equal(describeGeminiError(apiError(404, "models/gemini-x is not found for API version v1beta")).code, "model");
  assert.equal(describeGeminiError(apiError(429, "RESOURCE_EXHAUSTED: quota exceeded")).code, "quota");
  assert.equal(describeGeminiError(apiError(400, "INVALID_ARGUMENT: thinking_level is not supported")).code, "bad_request");
  assert.equal(describeGeminiError(apiError(503, "UNAVAILABLE: overloaded")).code, "unavailable");
  assert.equal(describeGeminiError(apiError(403, "PERMISSION_DENIED")).code, "auth");
});

test("only model, request and outage errors are worth another model", () => {
  assert.equal(worthTryingAnotherModel(describeGeminiError(apiError(404, "not found"))), true);
  assert.equal(worthTryingAnotherModel(describeGeminiError(apiError(400, "INVALID_ARGUMENT"))), true);
  assert.equal(worthTryingAnotherModel(describeGeminiError(apiError(429, "quota"))), false);
  assert.equal(worthTryingAnotherModel(describeGeminiError(apiError(403, "PERMISSION_DENIED"))), false);
});
