import { describe, expect, it } from "vitest";
import { ACTIONS, canPerform, type Action, type AcademyRole } from "@/lib/auth/permissions";

const member = (role: AcademyRole) => ({ isSuperAdmin: false, role });
const outsider = { isSuperAdmin: false, role: null };

describe("academy permission matrix", () => {
  it("lets teaching roles start, end and manage classes", () => {
    for (const role of ["company_admin", "instructor", "teacher"] as const) {
      expect(canPerform(member(role), "session.start")).toBe(true);
      expect(canPerform(member(role), "session.end")).toBe(true);
      expect(canPerform(member(role), "classroom.manage")).toBe(true);
    }
  });

  it("never lets learners or TAs start or end sessions", () => {
    for (const role of ["learner", "ta"] as const) {
      expect(canPerform(member(role), "session.start")).toBe(false);
      expect(canPerform(member(role), "session.end")).toBe(false);
      expect(canPerform(member(role), "classroom.manage")).toBe(false);
    }
  });

  it("lets TAs moderate and mark attendance, but not learners", () => {
    expect(canPerform(member("ta"), "session.moderate")).toBe(true);
    expect(canPerform(member("ta"), "attendance.mark")).toBe(true);
    expect(canPerform(member("learner"), "session.moderate")).toBe(false);
    expect(canPerform(member("learner"), "attendance.mark")).toBe(false);
  });

  it("lets every member join and view", () => {
    for (const role of ["learner", "ta", "instructor"] as const) {
      expect(canPerform(member(role), "session.join")).toBe(true);
      expect(canPerform(member(role), "classroom.view")).toBe(true);
    }
  });

  it("gives non-members nothing", () => {
    for (const action of ACTIONS) {
      expect(canPerform(outsider, action as Action)).toBe(false);
    }
  });

  it("lets a platform super admin do everything in any academy", () => {
    for (const action of ACTIONS) {
      expect(canPerform({ isSuperAdmin: true, role: null }, action as Action)).toBe(true);
    }
  });
});
