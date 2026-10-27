import "server-only";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import type { TutorSessionRow } from "./session-context.ts";

// Shared lookups for the tutor routes. All reads use the service client; callers apply the
// authorization rule they need (owner-only for writes, owner or staff for the view).

export const SESSION_STARTS_PER_HOUR = 30;

export const sessionIdSchema = z.string().uuid();

export async function loadSession(sessionId: string): Promise<TutorSessionRow | null> {
  const { data } = await createServiceClient().from("tutor_sessions").select("*").eq("id", sessionId).maybeSingle();
  return data ?? null;
}

/** The session, but only when the Clerk user owns it. Null otherwise, so the caller answers 404. */
export async function loadOwnedSession(sessionId: string, userId: string): Promise<TutorSessionRow | null> {
  const session = await loadSession(sessionId);
  return session && session.user_id === userId ? session : null;
}

/** Sessions this user started in the last `windowMs`. Used for the start rate limit. */
export async function countRecentSessionStarts(userId: string, windowMs: number, now = Date.now()): Promise<number> {
  const since = new Date(now - windowMs).toISOString();
  const { count } = await createServiceClient()
    .from("tutor_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("started_at", since);
  return count ?? 0;
}

/**
 * Active staff of an active tenant: company_admin, teacher or instructor. Mirrors public.is_company_staff.
 */
export async function isTenantStaff(userId: string, companyId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const [{ data: membership }, { data: company }] = await Promise.all([
    supabase
      .from("company_members")
      .select("role")
      .eq("company_id", companyId)
      .eq("profile_id", userId)
      .eq("status", "active")
      .in("role", ["company_admin", "teacher", "instructor"])
      .maybeSingle(),
    supabase.from("companies").select("status").eq("id", companyId).maybeSingle(),
  ]);
  return !!membership && company?.status === "active";
}

/** Marks a session that failed to start as abandoned. Best effort: errors are logged, not thrown. */
export async function abandonSession(sessionId: string): Promise<void> {
  const { error } = await createServiceClient()
    .from("tutor_sessions")
    .update({ status: "abandoned", ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("status", "active");
  if (error) console.error("[tutor] could not mark session abandoned:", error.message);
}

/** Reads a JSON body without throwing. Returns undefined when the body is missing or not JSON. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}
