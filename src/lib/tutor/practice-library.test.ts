import { test } from "node:test";
import assert from "node:assert/strict";
import { groupByLanguage, levelRank, skillPackLabel, startableModes, type PracticeLibraryItem } from "./practice-library.ts";

function item(overrides: Partial<PracticeLibraryItem>): PracticeLibraryItem {
  return {
    id: overrides.id ?? "x",
    title: overrides.title ?? "Title",
    goal: "Goal",
    skillPack: overrides.skillPack ?? "language-zh",
    level: overrides.level ?? null,
    maxMinutes: 8,
    allowedModes: ["live", "voice", "text"],
    visibility: "tenant_library",
    personaName: null,
  };
}

test("CEFR levels sort in order, unknown levels after them, no level last", () => {
  assert.ok(levelRank("A1") < levelRank("B2"));
  assert.ok(levelRank("B2") < levelRank("HSK 3"));
  assert.ok(levelRank("HSK 3") < levelRank(null));
  assert.equal(levelRank(" b1 "), levelRank("B1"));
});

test("scenarios group by language with levels sorted inside each group", () => {
  const groups = groupByLanguage([
    item({ id: "1", skillPack: "language-fr", level: "B1", title: "Market" }),
    item({ id: "2", skillPack: "language-zh", level: "A2", title: "Tea house" }),
    item({ id: "3", skillPack: "language-zh", level: "A1", title: "Greetings" }),
    item({ id: "4", skillPack: "language-zh", level: "A1", title: "Airport" }),
  ]);
  assert.deepEqual(
    groups.map((g) => g.label),
    ["French", "Mandarin Chinese"],
  );
  assert.deepEqual(
    groups[1].items.map((i) => i.id),
    ["4", "3", "2"],
  );
});

test("empty input gives no groups", () => {
  assert.deepEqual(groupByLanguage([]), []);
});

test("skill pack labels fall back to the raw key", () => {
  assert.equal(skillPackLabel("language-es"), "Spanish");
  assert.equal(skillPackLabel("future-pack"), "future-pack");
});

test("live is removed from the modes a session can start with", () => {
  assert.deepEqual(startableModes(["live", "voice", "text"]), ["voice", "text"]);
  assert.deepEqual(startableModes(["live"]), []);
});
