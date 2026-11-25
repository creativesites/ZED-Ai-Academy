import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isContentAuthor } from "./content-author.ts";

describe("isContentAuthor", () => {
  it("rejects plain learners", () => {
    assert.equal(isContentAuthor({ profileRole: "learner", activeMemberRoles: ["learner"], ownsAcademy: false }), false);
    assert.equal(isContentAuthor({ profileRole: null, activeMemberRoles: [], ownsAcademy: false }), false);
  });

  it("accepts staff profile roles", () => {
    for (const role of ["teacher", "instructor", "company_admin", "super_admin"]) {
      assert.equal(isContentAuthor({ profileRole: role, activeMemberRoles: [], ownsAcademy: false }), true);
    }
  });

  it("accepts active staff members of any academy", () => {
    assert.equal(isContentAuthor({ profileRole: "learner", activeMemberRoles: ["learner", "teacher"], ownsAcademy: false }), true);
  });

  it("accepts academy owners", () => {
    assert.equal(isContentAuthor({ profileRole: "learner", activeMemberRoles: [], ownsAcademy: true }), true);
  });
});
