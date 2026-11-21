export type InvitedMetadata = {
  invitedCompanyId?: string | null;
  invitedCourseId?: string | null;
  invitedCohortId?: string | null;
};

export type JoinAssignmentDecision = {
  courseId: string | null;
  cohortId: string | null;
  shouldClearInviteMetadata: boolean;
};

/**
 * Pure decision function for `/academy/[domain]/join` (S1).
 *
 * - Query params (`?courseId=`, `?cohortId=`) are NEVER accepted.
 * - Only Clerk `publicMetadata.invited*` set server-side by an admin invite
 *   for this exact `companyId` is honoured.
 * - Signals `shouldClearInviteMetadata` so the caller clears the one-time
 *   invite metadata after applying it.
 */
export function resolveJoinAssignments(
  companyId: string,
  publicMetadata: InvitedMetadata | null | undefined
): JoinAssignmentDecision {
  if (!publicMetadata || publicMetadata.invitedCompanyId !== companyId) {
    return {
      courseId: null,
      cohortId: null,
      shouldClearInviteMetadata: false,
    };
  }

  return {
    courseId: publicMetadata.invitedCourseId ?? null,
    cohortId: publicMetadata.invitedCohortId ?? null,
    shouldClearInviteMetadata: true,
  };
}
