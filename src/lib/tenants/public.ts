/**
 * Strip server-only secrets from a companies row before it is passed to a
 * client component (anything passed as a prop to a "use client" component is
 * serialized into the page sent to every visitor).
 *
 * teacher_code is the staff join secret: if it reaches the browser, anyone can
 * join the academy as a teacher.
 */
export function toPublicTenant<T extends Record<string, unknown>>(
  company: T
): Omit<T, "teacher_code" | "admin_id" | "suspended_reason" | "suspended_at"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { teacher_code, admin_id, suspended_reason, suspended_at, ...rest } = company;
  return rest;
}
