import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ currentUser: vi.fn(), clerkClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: vi.fn() }));

import { higherMemberRole } from "@/lib/tenants/membership";

describe("higherMemberRole", () => {
  it("never downgrades an existing role", () => {
    expect(higherMemberRole("company_admin", "learner")).toBe("company_admin");
    expect(higherMemberRole("teacher", "learner")).toBe("teacher");
  });
  it("upgrades when the new role is higher", () => {
    expect(higherMemberRole("learner", "teacher")).toBe("teacher");
  });
  it("uses the requested role for new members", () => {
    expect(higherMemberRole(null, "learner")).toBe("learner");
  });
});
