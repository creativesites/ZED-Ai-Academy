import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ACTIONS, canPerform, type AcademyRole } from "./permissions.ts";

const member = (role: AcademyRole) => ({ isSuperAdmin: false, role });
const outsider = { isSuperAdmin: false, role: null };

describe("academy permission matrix", () => {
  it("lets teaching roles start, end and manage classes", () => {
    for (const role of ["company_admin", "instructor", "teacher"] as const) {
      assert.equal(canPerform(member(role), "session.start"), true);
      assert.equal(canPerform(member(role), "session.end"), true);
      assert.equal(canPerform(member(role), "classroom.manage"), true);
    }
  });

  it("never lets learners or TAs start or end sessions", () => {
    for (const role of ["learner", "ta"] as const) {
      assert.equal(canPerform(member(role), "session.start"), false);
      assert.equal(canPerform(member(role), "session.end"), false);
      assert.equal(canPerform(member(role), "classroom.manage"), false);
    }
  });

  it("lets TAs moderate and mark attendance, but not learners", () => {
    assert.equal(canPerform(member("ta"), "session.moderate"), true);
    assert.equal(canPerform(member("ta"), "attendance.mark"), true);
    assert.equal(canPerform(member("learner"), "session.moderate"), false);
    assert.equal(canPerform(member("learner"), "attendance.mark"), false);
  });

  it("lets every member join and view", () => {
    for (const role of ["learner", "ta", "instructor"] as const) {
      assert.equal(canPerform(member(role), "session.join"), true);
      assert.equal(canPerform(member(role), "classroom.view"), true);
    }
  });

  it("gives non-members nothing", () => {
    for (const action of ACTIONS) assert.equal(canPerform(outsider, action), false);
  });

  it("lets a platform super admin do everything in any academy", () => {
    for (const action of ACTIONS) assert.equal(canPerform({ isSuperAdmin: true, role: null }, action), true);
  });
});
