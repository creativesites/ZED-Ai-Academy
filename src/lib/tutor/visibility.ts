import type { SessionOrigin } from "./scenario.ts";

// Who may read a tutor session's turns and report. Mirrors the RLS helper
// public.is_staff_visible_tutor_session in supabase/migrations/20261101000000_zai_tutor.sql:
// the learner always can; tenant staff can only when the session is a lesson or assignment,
// was shared by the learner, or was flagged. Pure.

export type TutorSessionVisibilityFacts = {
  userId: string;
  origin: SessionOrigin;
  sharedWithTeacher: boolean;
  status: "active" | "completed" | "abandoned" | "flagged";
};

export function canViewTutorSession(
  viewerId: string,
  session: TutorSessionVisibilityFacts,
  viewer: { isTenantStaff: boolean },
): boolean {
  if (viewerId === session.userId) return true;
  if (!viewer.isTenantStaff) return false;
  return (
    session.origin === "lesson" ||
    session.origin === "assignment" ||
    session.sharedWithTeacher ||
    session.status === "flagged"
  );
}
