import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRevisionSprintScenario, parseObjectiveIdsParam, revisionSprintHref } from "./sprint.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("mastery/sprint seeded by objective ids (P2-03)", () => {
  it("puts seeded objectives first and asks the teacher to cite their ids", () => {
    const s = buildRevisionSprintScenario({
      personaId: "p",
      teacherName: "Tinashe",
      weakObjectives: [
        { objectiveText: "Learner can add fractions", level: 0 },
        { objectiveText: "Older weak objective", level: 1 },
      ],
      focusObjective: "ignored when seeded",
      seededObjectives: [
        { id: A, text: "Learner can add fractions" },
        { id: B, text: "学习者能够数到十" },
      ],
    });
    assert.equal(s.beats.length, 3);
    assert.ok(s.beats[0].goal.includes(`objective="${A}"`));
    assert.ok(s.beats[1].goal.includes(`objective="${B}"`));
    assert.ok(s.beats[2].goal.includes(`objective="Older weak objective"`), "unseeded objectives keep text");
    assert.ok(!s.goal.includes("ignored when seeded"));
  });

  it("parses and caps the objectives query param", () => {
    assert.equal(parseObjectiveIdsParam(undefined), undefined);
    assert.equal(parseObjectiveIdsParam("nope,also-nope"), undefined);
    assert.equal(parseObjectiveIdsParam(`${A.toUpperCase()}, ${B},${A}`), `${A},${B}`);
    const six = Array.from({ length: 6 }, (_, i) => `0000000${i}-1111-4111-8111-111111111111`);
    assert.equal(parseObjectiveIdsParam(six.join(","))?.split(",").length, 5);
    assert.equal(parseObjectiveIdsParam([A, B]), `${A},${B}`);
  });

  it("builds tenant-aware revision hrefs", () => {
    assert.equal(
      revisionSprintHref({ basePath: "", courseId: "c1", objectiveIds: [A, B] }),
      `/practice/sprint?courseId=c1&objectives=${encodeURIComponent(`${A},${B}`)}`,
    );
    assert.equal(
      revisionSprintHref({ basePath: "/academy/acme/", courseId: "c1", objectiveIds: [] }),
      "/academy/acme/practice/sprint?courseId=c1",
    );
  });
});
