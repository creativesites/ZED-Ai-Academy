import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => authMock() }));

let rows: Record<string, Record<string, unknown> | null> = {};
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: rows[table] ?? null }),
      };
      return chain;
    },
  }),
}));

import { getCurrentTenantAccess, requireTenantMember, requireTenantTeacher } from "@/lib/tenants/access";

const ACADEMY = "org_academy";
const OTHER = "org_other";

beforeEach(() => {
  rows = { profiles: { role: "learner", company_id: ACADEMY } };
  authMock.mockReset();
});

describe("getCurrentTenantAccess", () => {
  it("uses the company_members row when one exists", async () => {
    authMock.mockResolvedValue({ userId: "u1", orgId: ACADEMY, orgRole: "org:member" });
    rows.company_members = { company_id: ACADEMY, profile_id: "u1", status: "active", role: "teacher" };
    const access = await getCurrentTenantAccess(ACADEMY);
    expect(access?.tenantRole).toBe("teacher");
    expect(access?.isMember).toBe(true);
  });

  it("gives the academy's Clerk admin company_admin when no row exists (missed webhook)", async () => {
    authMock.mockResolvedValue({ userId: "u1", orgId: ACADEMY, orgRole: "org:admin" });
    const access = await getCurrentTenantAccess(ACADEMY);
    expect(access?.tenantRole).toBe("company_admin");
    expect(access?.isMember).toBe(true);
    expect(access?.isSuperAdmin).toBe(false);
  });

  it("gives other Clerk org members learner, never a teaching role", async () => {
    authMock.mockResolvedValue({ userId: "u1", orgId: ACADEMY, orgRole: "org:member" });
    const access = await getCurrentTenantAccess(ACADEMY);
    expect(access?.tenantRole).toBe("learner");
    expect(access?.isMember).toBe(true);
  });

  it("does not grant anything for a different academy's Clerk admin", async () => {
    authMock.mockResolvedValue({ userId: "u1", orgId: OTHER, orgRole: "org:admin" });
    const access = await getCurrentTenantAccess(ACADEMY);
    expect(access?.isMember).toBe(false);
    expect(access?.tenantRole).toBeNull();
  });

  it("treats a deactivated row as an explicit revocation (no Clerk fallback)", async () => {
    authMock.mockResolvedValue({ userId: "u1", orgId: ACADEMY, orgRole: "org:admin" });
    rows.company_members = { company_id: ACADEMY, profile_id: "u1", status: "deactivated", role: "company_admin" };
    const access = await getCurrentTenantAccess(ACADEMY);
    expect(access?.isMember).toBe(false);
  });

  it("never makes a Clerk admin a platform super admin", async () => {
    authMock.mockResolvedValue({ userId: "u1", orgId: ACADEMY, orgRole: "org:admin" });
    rows.profiles = { role: "learner", company_id: ACADEMY };
    const access = await getCurrentTenantAccess(ACADEMY);
    expect(access?.isSuperAdmin).toBe(false);
  });

  it("returns null when signed out", async () => {
    authMock.mockResolvedValue({ userId: null });
    expect(await getCurrentTenantAccess(ACADEMY)).toBeNull();
  });
});

describe("require guards", () => {
  it("lets the academy's Clerk admin teach (the add-class fix)", async () => {
    authMock.mockResolvedValue({ userId: "u1", orgId: ACADEMY, orgRole: "org:admin" });
    await expect(requireTenantTeacher(ACADEMY)).resolves.toMatchObject({ tenantRole: "company_admin" });
    await expect(requireTenantMember(ACADEMY)).resolves.toBeTruthy();
  });

  it("blocks a plain learner from teaching", async () => {
    authMock.mockResolvedValue({ userId: "u1", orgId: ACADEMY, orgRole: "org:member" });
    await expect(requireTenantTeacher(ACADEMY)).rejects.toThrow("Teacher permissions required.");
  });
});
