import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canOnCourse,
  canOnTenant,
  COURSE_POLICY,
  courseRole,
  isTenantStaffRole,
  TENANT_POLICY,
  tenantRole,
  type CourseFacts,
  type TenantAction,
  type TenantFacts,
} from "./policy.ts";

const ME = "user_me";

/** Named callers, each described by the facts the server would load for tenant "orgA". */
const TENANT_CALLERS: Record<string, TenantFacts> = {
  superAdmin: { userId: ME, profileRole: "super_admin" },
  owner: { userId: ME, profileRole: "learner", tenantOwnerId: ME },
  companyAdmin: { userId: ME, profileRole: "learner", membership: { role: "company_admin", status: "active" } },
  teacher: { userId: ME, profileRole: "learner", membership: { role: "teacher", status: "active" } },
  instructor: { userId: ME, profileRole: "instructor", membership: { role: "instructor", status: "active" } },
  learnerMember: { userId: ME, profileRole: "learner", membership: { role: "learner", status: "active" } },
  invitedTeacher: { userId: ME, profileRole: "learner", membership: { role: "teacher", status: "invited" } },
  deactivatedAdmin: { userId: ME, profileRole: "learner", membership: { role: "company_admin", status: "deactivated" } },
  outsider: { userId: ME, profileRole: "learner" },
  // A profile role of instructor/company_admin is not tenant membership: it grants nothing in this tenant.
  profileInstructorOnly: { userId: ME, profileRole: "instructor", membership: null },
  profileCompanyAdminOnly: { userId: ME, profileRole: "company_admin" },
  someoneElseOwns: { userId: ME, profileRole: "learner", tenantOwnerId: "user_other" },
  anonymous: { userId: "", profileRole: "super_admin", tenantOwnerId: "" },
};

const STAFF = ["superAdmin", "owner", "companyAdmin", "teacher", "instructor"];

describe("tenant role × action matrix", () => {
  const actions = Object.keys(TENANT_POLICY) as TenantAction[];
  for (const [name, facts] of Object.entries(TENANT_CALLERS)) {
    for (const action of actions) {
      const expected = STAFF.includes(name);
      it(`${name} ${expected ? "may" : "may not"} ${action}`, () => {
        assert.equal(canOnTenant(action, facts), expected);
      });
    }
  }
});

describe("tenantRole", () => {
  it("resolves each caller to the expected role", () => {
    const expected: Record<string, string> = {
      superAdmin: "super_admin",
      owner: "owner",
      companyAdmin: "company_admin",
      teacher: "teacher",
      instructor: "instructor",
      learnerMember: "member",
      invitedTeacher: "none",
      deactivatedAdmin: "none",
      outsider: "none",
      profileInstructorOnly: "none",
      profileCompanyAdminOnly: "none",
      someoneElseOwns: "none",
      anonymous: "none",
    };
    for (const [name, facts] of Object.entries(TENANT_CALLERS)) {
      assert.equal(tenantRole(facts), expected[name], name);
    }
  });

  it("treats only staff roles as staff", () => {
    assert.equal(isTenantStaffRole("member"), false);
    assert.equal(isTenantStaffRole("none"), false);
    assert.equal(isTenantStaffRole("teacher"), true);
  });
});

describe("course role × action matrix", () => {
  const tenantCourse = { courseInstructorId: "user_author", courseCompanyId: "orgA" };
  const platformCourse = { courseInstructorId: "user_author", courseCompanyId: null };

  const cases: { name: string; facts: CourseFacts; role: string; manage: boolean }[] = [
    { name: "course owner (tenant course)", facts: { ...tenantCourse, userId: "user_author", profileRole: "learner" }, role: "course_owner", manage: true },
    { name: "course owner (platform course)", facts: { ...platformCourse, userId: "user_author", profileRole: "instructor" }, role: "course_owner", manage: true },
    { name: "super admin", facts: { ...platformCourse, userId: ME, profileRole: "super_admin" }, role: "super_admin", manage: true },
    { name: "tenant owner", facts: { ...tenantCourse, ...TENANT_CALLERS.owner }, role: "owner", manage: true },
    { name: "tenant teacher", facts: { ...tenantCourse, ...TENANT_CALLERS.teacher }, role: "teacher", manage: true },
    { name: "tenant company admin", facts: { ...tenantCourse, ...TENANT_CALLERS.companyAdmin }, role: "company_admin", manage: true },
    { name: "tenant instructor", facts: { ...tenantCourse, ...TENANT_CALLERS.instructor }, role: "instructor", manage: true },
    { name: "tenant learner", facts: { ...tenantCourse, ...TENANT_CALLERS.learnerMember }, role: "member", manage: false },
    { name: "invited teacher", facts: { ...tenantCourse, ...TENANT_CALLERS.invitedTeacher }, role: "none", manage: false },
    { name: "outsider", facts: { ...tenantCourse, ...TENANT_CALLERS.outsider }, role: "none", manage: false },
    // Platform courses (company_id null) are managed by their instructor and super admins only.
    { name: "teacher facts on a platform course", facts: { ...platformCourse, ...TENANT_CALLERS.teacher }, role: "none", manage: false },
    { name: "owner facts on a platform course", facts: { ...platformCourse, ...TENANT_CALLERS.owner }, role: "none", manage: false },
    { name: "anonymous", facts: { ...tenantCourse, userId: "", profileRole: "super_admin" }, role: "none", manage: false },
    { name: "missing instructor never matches empty user", facts: { courseInstructorId: null, courseCompanyId: "orgA", userId: "", profileRole: null }, role: "none", manage: false },
  ];

  for (const c of cases) {
    it(`${c.name} → ${c.role}, manage=${c.manage}`, () => {
      assert.equal(courseRole(c.facts), c.role);
      assert.equal(canOnCourse("course.manage", c.facts), c.manage);
    });
  }

  it("lists every course action in the policy", () => {
    assert.deepEqual(Object.keys(COURSE_POLICY), ["course.manage"]);
  });
});
