import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveJoinAssignments } from "./join-decision.ts";

describe("resolveJoinAssignments", () => {
  it("ignores invites when publicMetadata is missing", () => {
    const res = resolveJoinAssignments("comp-1", undefined);
    assert.deepEqual(res, {
      courseId: null,
      cohortId: null,
      shouldClearInviteMetadata: false,
    });
  });

  it("ignores invites for a different company", () => {
    const res = resolveJoinAssignments("comp-1", {
      invitedCompanyId: "comp-2",
      invitedCourseId: "paid-course-1",
      invitedCohortId: "cohort-1",
    });
    assert.deepEqual(res, {
      courseId: null,
      cohortId: null,
      shouldClearInviteMetadata: false,
    });
  });

  it("honours invitedCourseId and invitedCohortId only when invitedCompanyId matches", () => {
    const res = resolveJoinAssignments("comp-1", {
      invitedCompanyId: "comp-1",
      invitedCourseId: "paid-course-1",
      invitedCohortId: "cohort-1",
    });
    assert.deepEqual(res, {
      courseId: "paid-course-1",
      cohortId: "cohort-1",
      shouldClearInviteMetadata: true,
    });
  });

  it("clears metadata even when only invitedCompanyId is set", () => {
    const res = resolveJoinAssignments("comp-1", {
      invitedCompanyId: "comp-1",
    });
    assert.deepEqual(res, {
      courseId: null,
      cohortId: null,
      shouldClearInviteMetadata: true,
    });
  });
});
