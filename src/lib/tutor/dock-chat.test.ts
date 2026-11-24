import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDockContents, stripDockMarkupForSpeech } from "./dock-chat.ts";

test("buildDockContents builds alternating multi-turn contents and drops leading greeting", () => {
  const history = [
    { role: "assistant", content: "Hi, I'm Tinashe, your teacher." },
    { role: "user", content: "Quiz me on prompt clarity" },
    { role: "assistant", content: "Sure! Which option is clearer: A or B?" },
  ];
  const contents = buildDockContents(history, "I pick B");
  assert.equal(contents.length, 3);
  assert.deepEqual(contents[0], { role: "user", parts: [{ text: "Quiz me on prompt clarity" }] });
  assert.deepEqual(contents[1], { role: "model", parts: [{ text: "Sure! Which option is clearer: A or B?" }] });
  assert.deepEqual(contents[2], { role: "user", parts: [{ text: "I pick B" }] });
});

test("buildDockContents merges consecutive same-role turns and caps history length", () => {
  const longHistory = Array.from({ length: 20 }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `turn ${i}`,
  }));
  const contents = buildDockContents(longHistory, "latest question");
  assert.ok(contents.length <= 13);
  assert.equal(contents[0].role, "user");
  assert.equal(contents[contents.length - 1].parts[0].text, "latest question");

  const merged = buildDockContents([{ role: "user", content: "first" }], "second");
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].parts, [{ text: "first" }, { text: "second" }]);
});

test("stripDockMarkupForSpeech removes custom :::components:::, code fences, and markdown", () => {
  const text = `
Great question! Here is how **Kwacha margin** works:
:::board { "title": "Margin", "kind": "bullets", "items": ["Revenue - Cost"] } :::
Check \`margin = profit / revenue\` and try this:
\`\`\`js
const m = 0.25;
\`\`\`
Does that make sense?
`;
  const spoken = stripDockMarkupForSpeech(text);
  assert.doesNotMatch(spoken, /:::board/);
  assert.doesNotMatch(spoken, /const m = 0\.25/);
  assert.match(spoken, /Great question! Here is how Kwacha margin works:/);
  assert.match(spoken, /Does that make sense\?/);
});
