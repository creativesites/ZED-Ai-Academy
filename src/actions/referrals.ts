"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { nanoid } from "nanoid";

export async function getOrCreateReferralCode(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated.");

  const supabase = createClient();

  // Check if user already has a referral code
  const { data: existing } = await supabase
    .from("referrals")
    .select("referral_code")
    .eq("referrer_id", userId)
    .is("referred_id", null)
    .maybeSingle();

  if (existing) return existing.referral_code;

  // Generate a unique code
  const code = nanoid(8).toUpperCase();
  const { error } = await supabase.from("referrals").insert({
    referrer_id: userId,
    referral_code: code,
    status: "pending",
  });

  if (error) throw new Error(error.message);
  return code;
}

export async function getReferralStats(): Promise<{ code: string; total: number; converted: number }> {
  const { userId } = await auth();
  if (!userId) return { code: "", total: 0, converted: 0 };

  const supabase = createClient();
  const { data } = await supabase
    .from("referrals")
    .select("referral_code, referred_id, status")
    .eq("referrer_id", userId);

  const rows = data ?? [];
  const codeRow = rows.find((r) => r.referral_code);
  const code = codeRow?.referral_code ?? "";
  const withReferral = rows.filter((r) => r.referred_id);
  const converted = withReferral.filter((r) => r.status === "converted").length;

  return { code, total: withReferral.length, converted };
}

// Called on successful enrollment if referral_code param present
export async function trackReferral(referralCode: string, newUserId: string) {
  const supabase = createClient();
  const { data: referral } = await supabase
    .from("referrals")
    .select("id, referrer_id")
    .eq("referral_code", referralCode)
    .is("referred_id", null)
    .maybeSingle();

  if (!referral || referral.referrer_id === newUserId) return;

  await supabase
    .from("referrals")
    .update({ referred_id: newUserId, status: "converted" })
    .eq("id", referral.id);
}
