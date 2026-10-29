import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import {
  buildManualInstructions,
  resolveManualDetails,
  type ManualEnv,
} from "./manual-instructions.ts";
import type {
  ManualPaymentDetails,
  PaymentOrder,
  PaymentProvider,
  PaymentStart,
} from "./types.ts";

/**
 * Manual provider: the learner pays MTN MoMo, Airtel Money or bank transfer and quotes
 * the order reference. An academy admin confirms the payment in the Admin Hub.
 *
 * Destinations come from companies.payment_settings for the order's academy, with
 * platform env vars as the per-field fallback. Nothing here calls a payment processor.
 */

function readEnv(): ManualEnv {
  return {
    MANUAL_PAY_MTN: process.env.MANUAL_PAY_MTN,
    MANUAL_PAY_AIRTEL: process.env.MANUAL_PAY_AIRTEL,
    MANUAL_PAY_BANK: process.env.MANUAL_PAY_BANK,
  };
}

/** Stored settings for one academy. Returns {} when the academy or column is missing. */
export async function loadAcademyPaymentSettings(
  companyId: string
): Promise<Partial<ManualPaymentDetails>> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("companies")
    .select("payment_settings")
    .eq("id", companyId)
    .maybeSingle();

  if (error) {
    console.error("[payments] Could not load academy payment settings:", error.message);
    return {};
  }
  const raw = data?.payment_settings;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const settings = raw as Record<string, unknown>;
  const pick = (key: string) => (typeof settings[key] === "string" ? (settings[key] as string) : null);
  return {
    mtn: pick("mtn"),
    airtel: pick("airtel"),
    bank: pick("bank"),
    instructions: pick("instructions"),
  };
}

/** Null when neither the academy nor the platform has any destination set. */
async function describeManualPayment(order: PaymentOrder): Promise<PaymentStart | null> {
  const academy = await loadAcademyPaymentSettings(order.companyId);
  const details = resolveManualDetails(academy, readEnv());
  if (!details.mtn && !details.airtel && !details.bank) return null;
  return { kind: "manual", instructions: buildManualInstructions(order, details) };
}

export const manualPaymentProvider: PaymentProvider = {
  id: "manual",
  label: "Mobile money or bank transfer (confirmed by the academy)",

  async createPayment(order) {
    const start = await describeManualPayment(order);
    if (!start) {
      throw new Error(
        "Payment details have not been set up for this academy yet. Please contact the academy."
      );
    }
    return start;
  },

  async resumePayment(order) {
    return describeManualPayment(order);
  },
};
