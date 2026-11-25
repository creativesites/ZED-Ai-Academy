import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AiJsonError, parseModelJson } from "./json.ts";

// Fixture replies in the shapes the generation routes have seen from Gemini.
const FIXTURES = {
  cleanObject: '{"modules":[{"title":"Start","lessons":[{"title":"One"}]}]}',
  fencedObject: '```json\n{"blocks":[{"type":"text","content":{"html":"<p>Hi</p>"}}]}\n```',
  proseObject: 'Here is your kit:\n{"tagline":"Learn fast","palette":["#000"]}\nHope it helps!',
  cleanArray: '[{"question":"Q?","options":["a","b","c","d"],"correct_indices":[1],"explanation":"b"}]',
  proseArray: 'Sure! [{"question":"Q?","options":["a","b","c","d"],"correct_indices":[0],"explanation":"a"}]',
  nestedBraces: '{"content":{"html":"<p>{x}</p>"},"note":"a } in a string"}',
};

describe("parseModelJson (fixture snapshots)", () => {
  it("parses a clean object", () => {
    assert.deepEqual(parseModelJson(FIXTURES.cleanObject), { modules: [{ title: "Start", lessons: [{ title: "One" }] }] });
  });
  it("strips markdown fences", () => {
    assert.deepEqual(parseModelJson(FIXTURES.fencedObject), { blocks: [{ type: "text", content: { html: "<p>Hi</p>" } }] });
  });
  it("finds an object inside prose", () => {
    assert.deepEqual(parseModelJson(FIXTURES.proseObject), { tagline: "Learn fast", palette: ["#000"] });
  });
  it("parses arrays when an array is expected", () => {
    assert.equal((parseModelJson(FIXTURES.cleanArray, "array") as unknown[]).length, 1);
    assert.deepEqual((parseModelJson(FIXTURES.proseArray, "array") as { correct_indices: number[] }[])[0].correct_indices, [0]);
  });
  it("keeps braces inside strings", () => {
    assert.deepEqual(parseModelJson(FIXTURES.nestedBraces), { content: { html: "<p>{x}</p>" }, note: "a } in a string" });
  });
});

describe("parseModelJson (deny cases)", () => {
  it("rejects empty replies", () => {
    assert.throws(() => parseModelJson(""), AiJsonError);
    assert.throws(() => parseModelJson(undefined), AiJsonError);
  });
  it("rejects a reply with no JSON", () => {
    assert.throws(() => parseModelJson("I cannot help with that."), AiJsonError);
  });
  it("rejects the wrong shape", () => {
    assert.throws(() => parseModelJson(FIXTURES.cleanArray, "object"), AiJsonError);
    assert.throws(() => parseModelJson(FIXTURES.cleanObject, "array"), AiJsonError);
  });
  it("rejects truncated JSON", () => {
    assert.throws(() => parseModelJson('{"modules":[{"title":"Start"'), AiJsonError);
  });
});
