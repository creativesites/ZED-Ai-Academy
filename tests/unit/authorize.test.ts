import { beforeEach, describe, expect, it, vi } from "vitest";

const accessMock = vi.fn();
vi.mock("@/lib/tenants/access", () => ({ getCurrentTenantAccess: (id: string) => accessMock(id) }));
vi.mock("server-only", () => ({}));

import { authorizeAcademy, NotAuthorizedError } from "@/lib/auth/authorize";

beforeEach(() => accessMock.mockReset());

describe("authorizeAcademy", () => {
  it("allows a teacher to start a session in their academy", async () => {
    accessMock.mockResolvedValue({ userId: "u1", isSuperAdmin: false, isMember: true, tenantRole: "teacher" });
    await expect(authorizeAcademy("org_a", "session.start")).resolves.toMatchObject({ actor: { role: "teacher" } });
  });

  it("denies a learner starting a session", async () => {
    accessMock.mockResolvedValue({ userId: "u1", isSuperAdmin: false, isMember: true, tenantRole: "learner" });
    await expect(authorizeAcademy("org_a", "session.start")).rejects.toBeInstanceOf(NotAuthorizedError);
  });

  it("denies a non-member even if a role string is present", async () => {
    accessMock.mockResolvedValue({ userId: "u1", isSuperAdmin: false, isMember: false, tenantRole: "company_admin" });
    await expect(authorizeAcademy("org_a", "classroom.view")).rejects.toBeInstanceOf(NotAuthorizedError);
  });

  it("denies when signed out", async () => {
    accessMock.mockResolvedValue(null);
    await expect(authorizeAcademy("org_a", "classroom.view")).rejects.toBeInstanceOf(NotAuthorizedError);
  });
});
