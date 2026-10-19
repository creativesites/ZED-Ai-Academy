/**
 * The academy permission matrix. Pure: no I/O, so it is unit-tested directly.
 * Server code resolves the caller's role (src/lib/tenants/access.ts) and then asks
 * canPerform(). Platform super admins can do everything inside any academy.
 */
export type AcademyRole = "company_admin" | "instructor" | "teacher" | "ta" | "learner";

export const ACTIONS = [
  "classroom.view",
  "classroom.manage",
  "session.start",
  "session.end",
  "session.join",
  "session.moderate",
  "attendance.mark",
] as const;

export type Action = (typeof ACTIONS)[number];

const TEACHING: readonly AcademyRole[] = ["company_admin", "instructor", "teacher"];

const ALLOWED: Record<Action, readonly AcademyRole[]> = {
  "classroom.view": ["company_admin", "instructor", "teacher", "ta", "learner"],
  "classroom.manage": TEACHING,
  "session.start": TEACHING,
  "session.end": TEACHING,
  "session.join": ["company_admin", "instructor", "teacher", "ta", "learner"],
  "session.moderate": [...TEACHING, "ta"],
  "attendance.mark": [...TEACHING, "ta"],
};

export type Actor = {
  isSuperAdmin: boolean;
  /** Role in this academy, or null when not a member. */
  role: AcademyRole | null;
};

export function canPerform(actor: Actor, action: Action): boolean {
  if (actor.isSuperAdmin) return true;
  if (!actor.role) return false;
  return ALLOWED[action].includes(actor.role);
}

export function isTeachingRoleName(role: string | null | undefined): role is AcademyRole {
  return role === "company_admin" || role === "instructor" || role === "teacher";
}
