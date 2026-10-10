import { beforeEach, describe, expect, it, vi } from "vitest";

// --- mocks -----------------------------------------------------------------
const authMock = vi.fn();
const currentUserMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
  currentUser: () => currentUserMock(),
}));

const accessMock = vi.fn();
vi.mock("@/lib/tenants/access", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tenants/access")>("@/lib/tenants/access");
  return { ...actual, getCurrentTenantAccess: (id: string) => accessMock(id) };
});

// Minimal chainable Supabase stub: rows keyed by table name.
let tables: Record<string, Record<string, unknown> | null> = {};
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        single: async () => ({ data: tables[table] ?? null }),
        maybeSingle: async () => ({ data: tables[table] ?? null }),
      };
      return chain;
    },
  }),
}));

const signMock = vi.fn((opts: { moderator: boolean; room: string }) => `token:${opts.room}:${opts.moderator}`);
vi.mock("@/lib/jitsi/token", () => ({
  getJaasAppId: () => "app",
  signJaasToken: (opts: { moderator: boolean; room: string }) => signMock(opts),
}));

import { getBookingJitsiToken, getClassroomJitsiToken } from "@/actions/jitsi";

beforeEach(() => {
  vi.clearAllMocks();
  currentUserMock.mockResolvedValue({ id: "u1", firstName: "Ann", lastName: "B", primaryEmailAddress: null, imageUrl: "" });
  tables = { companies: { is_session_active: true, active_room_name: "classroom-acme-room" } };
});

describe("getClassroomJitsiToken", () => {
  it("gives a learner a participant token for the live room only", async () => {
    accessMock.mockResolvedValue({ isSuperAdmin: false, isMember: true, tenantRole: "learner" });
    const result = await getClassroomJitsiToken("org_1");
    expect(result).toMatchObject({ success: true, moderator: false, roomName: "classroom-acme-room" });
    expect(signMock).toHaveBeenCalledWith(expect.objectContaining({ moderator: false, room: "classroom-acme-room" }));
  });

  it("gives a teacher a moderator token", async () => {
    accessMock.mockResolvedValue({ isSuperAdmin: false, isMember: true, tenantRole: "teacher" });
    const result = await getClassroomJitsiToken("org_1");
    expect(result).toMatchObject({ success: true, moderator: true });
  });

  it("rejects non-members of the academy", async () => {
    accessMock.mockResolvedValue({ isSuperAdmin: false, isMember: false, tenantRole: null });
    const result = await getClassroomJitsiToken("org_other");
    expect(result.success).toBe(false);
    expect(signMock).not.toHaveBeenCalled();
  });

  it("rejects when no class is live", async () => {
    accessMock.mockResolvedValue({ isSuperAdmin: false, isMember: true, tenantRole: "learner" });
    tables.companies = { is_session_active: false, active_room_name: null };
    const result = await getClassroomJitsiToken("org_1");
    expect(result.success).toBe(false);
  });
});

describe("getBookingJitsiToken", () => {
  const live = () => ({
    id: "b1",
    learner_id: "learner",
    instructor_id: "teacher",
    status: "confirmed",
    starts_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    ends_at: new Date(Date.now() + 25 * 60_000).toISOString(),
  });

  it("rejects users who are not on the booking", async () => {
    authMock.mockResolvedValue({ userId: "stranger" });
    tables.live_session_bookings = live();
    const result = await getBookingJitsiToken("b1");
    expect(result.success).toBe(false);
    expect(signMock).not.toHaveBeenCalled();
  });

  it("makes only the instructor a moderator", async () => {
    tables.live_session_bookings = live();
    authMock.mockResolvedValue({ userId: "learner" });
    expect(await getBookingJitsiToken("b1")).toMatchObject({ success: true, moderator: false, roomName: "b1" });
    authMock.mockResolvedValue({ userId: "teacher" });
    expect(await getBookingJitsiToken("b1")).toMatchObject({ success: true, moderator: true });
  });

  it("keeps learners out before the join window opens", async () => {
    tables.live_session_bookings = {
      ...live(),
      starts_at: new Date(Date.now() + 60 * 60_000).toISOString(),
      ends_at: new Date(Date.now() + 120 * 60_000).toISOString(),
    };
    authMock.mockResolvedValue({ userId: "learner" });
    expect((await getBookingJitsiToken("b1")).success).toBe(false);
  });

  it("keeps learners out of unconfirmed bookings", async () => {
    tables.live_session_bookings = { ...live(), status: "requested" };
    authMock.mockResolvedValue({ userId: "learner" });
    expect((await getBookingJitsiToken("b1")).success).toBe(false);
  });
});
