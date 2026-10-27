import { test } from "node:test";
import assert from "node:assert/strict";
import { canViewTutorSession, type TutorSessionVisibilityFacts } from "./visibility.ts";

const practice: TutorSessionVisibilityFacts = {
  userId: "user_1",
  origin: "practice",
  sharedWithTeacher: false,
  status: "completed",
};

test("the learner can always read their own session", () => {
  assert.equal(canViewTutorSession("user_1", practice, { isTenantStaff: false }), true);
});

test("other learners never can", () => {
  assert.equal(canViewTutorSession("user_2", { ...practice, origin: "lesson" }, { isTenantStaff: false }), false);
});

test("staff can read lesson and assignment sessions", () => {
  assert.equal(canViewTutorSession("staff", { ...practice, origin: "lesson" }, { isTenantStaff: true }), true);
  assert.equal(canViewTutorSession("staff", { ...practice, origin: "assignment" }, { isTenantStaff: true }), true);
});

test("staff can read private practice sessions only when shared or flagged", () => {
  assert.equal(canViewTutorSession("staff", practice, { isTenantStaff: true }), false);
  assert.equal(canViewTutorSession("staff", { ...practice, sharedWithTeacher: true }, { isTenantStaff: true }), true);
  assert.equal(canViewTutorSession("staff", { ...practice, status: "flagged" }, { isTenantStaff: true }), true);
});
