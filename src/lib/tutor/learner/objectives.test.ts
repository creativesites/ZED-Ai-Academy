import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatObjectivePromptLines,
  isUuid,
  nextObjectiveCode,
  normalizeObjectiveText,
  objectiveKeyForId,
  parseRegisteredObjectiveRow,
  planObjectiveUpsert,
  resolveObjectiveRef,
  type RegisteredObjective,
} from "./objectives.ts";

const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const LESSON = "33333333-3333-4333-8333-333333333333";
const OTHER_LESSON = "44444444-4444-4444-8444-444444444444";

const reg = (over: Partial<RegisteredObjective>): RegisteredObjective => ({
  id: ID1,
  code: "O1",
  text: "Learner can add fractions",
  evidenceCriteria: null,
  lessonId: LESSON,
  status: "active",
  source: "extracted",
  ...over,
});

describe("learner/objectives", () => {
  it("normalises text in any script without collapsing different objectives", () => {
    const zh1 = normalizeObjectiveText("学习者能够用中文问候");
    const zh2 = normalizeObjectiveText("学习者能够数到十");
    const ar = normalizeObjectiveText("يستطيع المتعلم إلقاء التحية");
    assert.notEqual(zh1, "");
    assert.notEqual(zh1, zh2);
    assert.notEqual(ar, "");
    assert.equal(normalizeObjectiveText("  Learner CAN add, fractions! "), "learner can add fractions");
    assert.equal(normalizeObjectiveText("Ｃａｆé"), normalizeObjectiveText("café"));
  });

  it("keys registered objectives by id", () => {
    assert.equal(objectiveKeyForId(` ${ID1.toUpperCase()} `), ID1);
    assert.equal(isUuid(ID1), true);
    assert.equal(isUuid("obj-1"), false);
    assert.equal(isUuid(42), false);
  });

  it("allocates the next free code", () => {
    assert.equal(nextObjectiveCode([]), "O1");
    assert.equal(nextObjectiveCode(["O1", "O7", "custom"]), "O8");
    assert.equal(nextObjectiveCode(["O2"], 2), "O5");
  });

  it("plans inserts for new objectives and reuses matching ones (accept all, no duplicates)", () => {
    const plan = planObjectiveUpsert({
      existing: [reg({}), reg({ id: ID2, code: "O2", text: "Learner can compare fractions", lessonId: OTHER_LESSON })],
      allCourseCodes: ["O1", "O2"],
      lessonId: LESSON,
      incoming: [
        { text: "learner can ADD fractions.", evidence: "Adds 1/2 + 1/4" },
        { text: "Learner can compare fractions", evidence: "Orders three fractions" },
        { text: "   " },
        { text: "Learner can compare fractions" },
      ],
    });
    // The first matches O1 (same lesson); the second is new for this lesson (O2 belongs to another lesson).
    assert.deepEqual(plan.resolved, [{ existingId: ID1 }, { insertIndex: 0 }]);
    assert.equal(plan.inserts.length, 1);
    assert.equal(plan.inserts[0].code, "O3");
    assert.equal(plan.updates.length, 1);
    assert.equal(plan.updates[0].id, ID1);
    assert.equal(plan.updates[0].text, "learner can ADD fractions.");
    assert.equal(plan.updates[0].evidenceCriteria, "Adds 1/2 + 1/4");
  });

  it("reactivates retired matches and skips unchanged ones", () => {
    const unchanged = planObjectiveUpsert({
      existing: [reg({})],
      allCourseCodes: ["O1"],
      lessonId: LESSON,
      incoming: [{ text: "Learner can add fractions" }],
    });
    assert.deepEqual(unchanged.updates, []);
    assert.deepEqual(unchanged.inserts, []);

    const retired = planObjectiveUpsert({
      existing: [reg({ status: "retired" })],
      allCourseCodes: ["O1"],
      lessonId: LESSON,
      incoming: [{ text: "Learner can add fractions" }],
    });
    assert.equal(retired.updates[0].reactivate, true);
  });

  it("keeps distinct non-Latin objectives distinct", () => {
    const plan = planObjectiveUpsert({
      existing: [],
      allCourseCodes: [],
      lessonId: LESSON,
      incoming: [{ text: "学习者能够用中文问候" }, { text: "学习者能够数到十" }],
    });
    assert.equal(plan.inserts.length, 2);
    assert.deepEqual(
      plan.inserts.map((i) => i.code),
      ["O1", "O2"],
    );
  });

  it("resolves note_evidence objective values by id, code, then text; unknown → null", () => {
    const objs = [
      { id: ID1, code: "O1", text: "Learner can add fractions" },
      { id: ID2, code: "O2", text: "学习者能够数到十" },
    ];
    assert.equal(resolveObjectiveRef(ID1.toUpperCase(), objs)?.id, ID1);
    assert.equal(resolveObjectiveRef(`${ID2}: 学习者能够数到十`, objs)?.id, ID2);
    assert.equal(resolveObjectiveRef("o2", objs)?.id, ID2);
    assert.equal(resolveObjectiveRef("learner can add fractions!", objs)?.id, ID1);
    assert.equal(resolveObjectiveRef("学习者能够数到十", objs)?.id, ID2);
    assert.equal(resolveObjectiveRef("99999999-9999-4999-8999-999999999999", objs), null);
    assert.equal(resolveObjectiveRef("something else", objs), null);
    assert.equal(resolveObjectiveRef("", objs), null);
    assert.equal(resolveObjectiveRef(undefined, objs), null);
    assert.equal(resolveObjectiveRef(ID1, []), null);
  });

  it("formats prompt lines as id: text", () => {
    const lines = formatObjectivePromptLines([
      { id: ID1, text: "Learner can  add\nfractions" },
      { id: ID2, text: "   " },
    ]);
    assert.deepEqual(lines, [`${ID1}: Learner can add fractions`]);
  });

  it("parses registry rows defensively", () => {
    assert.equal(parseRegisteredObjectiveRow({ id: 1 }), null);
    const row = parseRegisteredObjectiveRow({ id: ID1, text: "t", code: "O1", status: "weird", source: "authored" });
    assert.equal(row?.status, "active");
    assert.equal(row?.source, "authored");
    assert.equal(row?.lessonId, null);
  });
});
