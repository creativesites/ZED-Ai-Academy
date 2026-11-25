import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { ZEDAI_TENANT_ID } from "@/lib/tenants/constants";
import type { AiMeter } from "./call.ts";

/**
 * Who pays for an AI call, derived from server-side facts only (never from a client-supplied companyId).
 * - With a course: the course's tenant (platform courses bill the platform tenant).
 * - Otherwise: the caller's earliest active membership, else the platform tenant (same rule as the TTS route).
 */
export async function meterFor(userId: string, opts: { courseId?: string | null } = {}): Promise<AiMeter> {
  const db = createServiceClient();
  if (opts.courseId) {
    const { data: course } = await db.from("courses").select("company_id").eq("id", opts.courseId).maybeSingle();
    if (course) return { companyId: course.company_id ?? ZEDAI_TENANT_ID, userId };
  }
  const { data: membership } = await db
    .from("company_members")
    .select("company_id")
    .eq("profile_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return { companyId: membership?.company_id ?? ZEDAI_TENANT_ID, userId };
}
