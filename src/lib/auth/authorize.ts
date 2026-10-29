import "server-only";

import { getCurrentTenantAccess } from "@/lib/tenants/access";
import { canPerform, type Action, type AcademyRole } from "@/lib/auth/permissions";

export class NotAuthorizedError extends Error {
  constructor(readonly action: Action) {
    super(`Not allowed: ${action}`);
    this.name = "NotAuthorizedError";
  }
}

/**
 * Resolve the caller for one academy and require `action`. Always pass the academy
 * id that was derived from the database row being acted on, never one the client
 * sent alongside it.
 */
export async function authorizeAcademy(academyId: string, action: Action) {
  const access = await getCurrentTenantAccess(academyId);
  if (!access) throw new NotAuthorizedError(action);

  // tenantRole is only set for members (or the Clerk-admin fallback), so it is the role here.
  const role = access.isMember ? (access.tenantRole as AcademyRole | null) : null;
  const actor = { isSuperAdmin: access.isSuperAdmin, role };
  if (!canPerform(actor, action)) throw new NotAuthorizedError(action);
  return { userId: access.userId, actor };
}
