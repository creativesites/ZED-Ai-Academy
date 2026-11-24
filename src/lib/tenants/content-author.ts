/**
 * Who may use the creator-only AI tools that are not tied to one course or academy (course blueprint,
 * block editing, branding assistant, image generation, flow stress-test): platform super admins, staff
 * profile roles, active staff members of any academy, and academy owners. Learners may not. Pure.
 */
export const CONTENT_AUTHOR_ROLES = ["teacher", "instructor", "company_admin", "super_admin"] as const;

export function isContentAuthor(facts: {
  profileRole: string | null | undefined;
  activeMemberRoles: readonly string[];
  ownsAcademy: boolean;
}): boolean {
  if (facts.ownsAcademy) return true;
  if (facts.profileRole && (CONTENT_AUTHOR_ROLES as readonly string[]).includes(facts.profileRole)) return true;
  return facts.activeMemberRoles.some((role) => (CONTENT_AUTHOR_ROLES as readonly string[]).includes(role));
}
