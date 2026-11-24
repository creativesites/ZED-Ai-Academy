import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveCourseCreateCompany } from "./course-create.ts";
import { ZEDAI_TENANT_ID } from "../tenants/constants.ts";

describe("resolveCourseCreateCompany", () => {
  it("authorizes academy owner via companies.admin_id even without company_members row", () => {
    const res = resolveCourseCreateCompany({
      userId: "user_owner",
      explicitCompanyId: "org_acme",
      profileRole: "company_admin",
      explicitCompanyAdminId: "user_owner",
      memberships: [],
      ownedCompanyIds: ["org_acme"],
    });
    assert.deepEqual(res, { ok: true, companyId: "org_acme" });
  });

  it("denies learner attempting to create in an explicit academy", () => {
    const res = resolveCourseCreateCompany({
      userId: "user_learner",
      explicitCompanyId: "org_acme",
      profileRole: "learner",
      explicitCompanyAdminId: "user_other",
      memberships: [{ company_id: "org_acme", role: "learner", status: "active" }],
      ownedCompanyIds: [],
    });
    assert.equal(res.ok, false);
  });

  it("falls back to owned academy or ZEDAI_TENANT_ID for platform instructors without explicit company", () => {
    const ownerFallback = resolveCourseCreateCompany({
      userId: "user_owner",
      profileRole: "company_admin",
      memberships: [],
      ownedCompanyIds: ["org_owned"],
    });
    assert.deepEqual(ownerFallback, { ok: true, companyId: "org_owned" });

    const instructorFallback = resolveCourseCreateCompany({
      userId: "user_inst",
      profileRole: "instructor",
      memberships: [],
      ownedCompanyIds: [],
    });
    assert.deepEqual(instructorFallback, { ok: true, companyId: ZEDAI_TENANT_ID });
  });

  it("rejects learners with no academy staff rights when no company is specified", () => {
    const res = resolveCourseCreateCompany({
      userId: "user_learner",
      profileRole: "learner",
      memberships: [{ company_id: "org_acme", role: "learner", status: "active" }],
      ownedCompanyIds: [],
    });
    assert.equal(res.ok, false);
  });
});
