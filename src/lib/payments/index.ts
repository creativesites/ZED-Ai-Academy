import "server-only";
import { manualPaymentProvider } from "./manual.ts";
import type { PaymentProvider } from "./types.ts";

/**
 * Provider registry. The active provider comes from PAYMENT_PROVIDER (default "manual").
 *
 * To add a processor: create src/lib/payments/<name>.ts exporting a PaymentProvider,
 * add it to PROVIDERS below, and set PAYMENT_PROVIDER=<id>. Nothing else changes.
 */
const PROVIDERS: Record<string, PaymentProvider> = {
  [manualPaymentProvider.id]: manualPaymentProvider,
};

export function getPaymentProvider(): PaymentProvider {
  const id = (process.env.PAYMENT_PROVIDER ?? "").trim().toLowerCase() || "manual";
  const provider = PROVIDERS[id];
  if (!provider) {
    throw new Error(
      `Unknown PAYMENT_PROVIDER "${id}". Available: ${Object.keys(PROVIDERS).join(", ")}.`
    );
  }
  return provider;
}

export type {
  OrderStatus,
  PaymentInstructions,
  PaymentOrder,
  PaymentProvider,
  PaymentStart,
  WebhookEvent,
} from "./types.ts";
