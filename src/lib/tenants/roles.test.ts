import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { higherMemberRole, isTeachingRole, resolveTenantRole, type TenantRoleFacts } from "./roles.ts";

const base: TenantRoleFacts = { companyId: "org_a", row: null, isOwner: false, orgId: null, orgRole: null };

describe("resolveTenantRole", () => {
  it("uses an active membership row as the source of truth", () => {
    assert.equal(resolveTenantRole({ ...base, row: { status: "active", role: "teacher" } }), "teacher");
    // Even when Clerk says org:admin for this academy.
    assert.equal(
      resolveTenantRole({ ...base, row: { status: "active", role: "learner" }, orgId: "org_a", orgRole: "org:admin" }),
      "learner"
    );
  });

  it("never overrides a deactivated or invited row", () => {
    for (const status of ["deactivated", "invited"] as const) {
      assert.equal(
        resolveTenantRole({ ...base, row: { status, role: "company_admin" }, isOwner: true, orgId: "org_a", orgRole: "org:admin" }),
        null
      );
    }
  });

  it("lets the academy's Clerk admin in without a membership row (missed webhook)", () => {
    assert.equal(resolveTenantRole({ ...base, orgId: "org_a", orgRole: "org:admin" }), "company_admin");
    assert.equal(resolveTenantRole({ ...base, orgId: "org_a", orgRole: "org:member" }), "learner");
  });

  it("lets the academy owner in without a membership row", () => {
    assert.equal(resolveTenantRole({ ...base, isOwner: true }), "company_admin");
  });

  it("gives nothing for another academy's Clerk org", () => {
    assert.equal(resolveTenantRole({ ...base, orgId: "org_b", orgRole: "org:admin" }), null);
    assert.equal(resolveTenantRole(base), null);
  });
});

describe("higherMemberRole", () => {
  it("never downgrades an existing role", () => {
    assert.equal(higherMemberRole("company_admin", "learner"), "company_admin");
    assert.equal(higherMemberRole("teacher", "learner"), "teacher");
  });
  it("upgrades when the new role is higher", () => {
    assert.equal(higherMemberRole("learner", "teacher"), "teacher");
  });
  it("uses the requested role for new members", () => {
    assert.equal(higherMemberRole(null, "learner"), "learner");
  });
});

describe("isTeachingRole", () => {
  it("covers staff roles only", () => {
    assert.equal(isTeachingRole("company_admin"), true);
    assert.equal(isTeachingRole("teacher"), true);
    assert.equal(isTeachingRole("instructor"), true);
    assert.equal(isTeachingRole("learner"), false);
    assert.equal(isTeachingRole(null), false);
  });
});
