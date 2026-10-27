import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { TutorUsageKind } from "@/types/database";
import { estimateCostUsd } from "../usage-rates.ts";

export type UsageInput = {
  companyId: string;
  userId: string | null;
  sessionId: string | null;
  model: string;
  kind: TutorUsageKind;
  units: number;
  unit: string;
};

/**
 * Writes one row to ai_usage_ledger (server only, service role).
 * Metering must not break a learner's turn, so failures are logged and swallowed.
 */
export async function recordUsage(input: UsageInput): Promise<void> {
  const units = Number.isFinite(input.units) ? Math.max(0, Math.round(input.units)) : 0;
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("ai_usage_ledger").insert({
      company_id: input.companyId,
      user_id: input.userId,
      session_id: input.sessionId,
      model: input.model,
      kind: input.kind,
      units,
      unit: input.unit,
      est_cost_usd: estimateCostUsd(input.kind, units),
    });
    if (error) console.error("[tutor] usage ledger insert failed:", error.message);
  } catch (err) {
    console.error("[tutor] usage ledger insert threw:", err);
  }
}
