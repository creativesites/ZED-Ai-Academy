# Payments

The platform launches with **manual payments**. A learner pays by MTN MoMo, Airtel Money or bank transfer, quotes an order reference, and submits their transaction ID. An academy admin confirms the payment, and confirming grants course access.

No payment processor is called in this mode. PayChangu has been removed from the active path.

## Layout

```
src/lib/payments/
  types.ts              PaymentProvider interface and shared types (pure)
  index.ts              Provider registry. Reads PAYMENT_PROVIDER (default "manual")
  manual.ts             Manual provider (server only)
  manual-instructions.ts  Builds the amount, reference and destinations shown to learners (pure)
  order-status.ts       Allowed status transitions (pure)
  reference.ts          Order reference generation (pure)
  proof.ts              Validation for transaction IDs and rejection reasons (pure)
src/actions/payments.ts Server actions: checkout, submit proof, confirm, reject, save details
src/app/(learner)/courses/[slug]/checkout/page.tsx   Learner checkout
src/app/(marketing)/academy/[domain]/admin/payments/page.tsx   Admin queue
```

## Provider interface

```ts
interface PaymentProvider {
  id: string;
  label: string;
  createPayment(order: PaymentOrder): Promise<PaymentStart>;
  resumePayment?(order: PaymentOrder): Promise<PaymentStart | null>;
  verifyWebhook?(req: Request): Promise<WebhookEvent | null>;
}

type PaymentStart =
  | { kind: "redirect"; url: string }                              // hosted checkout
  | { kind: "manual"; instructions: PaymentInstructions };          // show destinations
```

- `createPayment` runs when a learner places an order. A redirect provider returns a URL the learner is sent to. A manual provider returns the instructions.
- `resumePayment` re-shows instructions for an order that is still open (pending or rejected). Return `null` if the destinations are missing.
- `verifyWebhook` is optional. Add it only when a provider sends webhooks.

## Order flow

Statuses (`orders.status`):

| Status | Meaning | Who moves it on |
| --- | --- | --- |
| `pending` | Order placed, learner has not submitted a payment | Learner submits proof |
| `awaiting_confirmation` | Learner submitted a transaction ID | Admin confirms or rejects |
| `paid` | Confirmed. Enrollment created or reactivated | Terminal (except `refunded`) |
| `rejected` | Admin rejected with a reason. The learner can resubmit | Learner resubmits, or admin fails it |
| `failed` | Cancelled | Terminal |
| `refunded` | Refunded after payment | Terminal |

Transitions are in `src/lib/payments/order-status.ts`:

```
pending ──proof──▶ awaiting_confirmation ──confirm──▶ paid ──▶ refunded
   │                    │
   │                    └──reject──▶ rejected ──proof──▶ awaiting_confirmation
   └──▶ failed
```

1. **Place order.** The learner clicks Place order on checkout. If a coupon is applied, the server validates it and sets the price. The order is created with a unique reference such as `ZAA-7K3QWM9T`.
2. **Pay.** The checkout shows the amount in ZMW, the reference to put in the payment note, and the academy's MoMo, Airtel and bank details.
3. **I have paid.** The learner enters the transaction ID, and optionally the method and a note. The order moves to `awaiting_confirmation`. A transaction ID already held by another order that is awaiting confirmation or paid is refused.
4. **Confirm.** An academy admin (company admin of the academy, or super admin) confirms the order on the Payments page. The order is claimed first, so a double click cannot confirm twice. The enrollment is then upserted to `active` with `source = individual_purchase`. The learner is added to the academy and gets the confirmation email.
5. **Reject.** The admin enters a reason. The learner sees it on checkout and can submit again.

Every action checks authorization on the server. Learner actions require the order to belong to the signed-in user. Admin actions call `requireTenantAdmin` for the course's academy.

## Payment details

Destinations are stored per academy in `companies.payment_settings` (JSON: `mtn`, `airtel`, `bank`, `instructions`). Academy admins edit them on the Payments page.

Platform defaults come from env vars. Each field falls back to its env var when the academy leaves it blank:

- `MANUAL_PAY_MTN`
- `MANUAL_PAY_AIRTEL`
- `MANUAL_PAY_BANK`

If no destination exists at all, checkout shows "Payment is not set up yet" and no order can be paid.

## Environment

| Variable | Purpose |
| --- | --- |
| `PAYMENT_PROVIDER` | Active provider id. Default `manual` |
| `MANUAL_PAY_MTN` | Platform MoMo number, used when an academy has none |
| `MANUAL_PAY_AIRTEL` | Platform Airtel Money number, used when an academy has none |
| `MANUAL_PAY_BANK` | Platform bank details, used when an academy has none |
| `NEXT_PUBLIC_APP_URL` | Base URL used in the confirmation email link |

## Database

Migration `supabase/migrations/20261103000000_manual_payments.sql` (not applied):

- Extends the `orders.status` check with `awaiting_confirmation` and `rejected`.
- Adds `orders.transaction_id`, `payment_note`, `payment_submitted_at`, `rejection_reason`, `rejected_at`, `decided_by`.
- Adds `companies.payment_settings jsonb`. Not granted to `anon` or `authenticated`.
- Adds a unique index on `orders.payment_reference`.
- RLS: owners read their orders. Tenant staff read orders for their courses. `anon` and `authenticated` lose INSERT, UPDATE and DELETE on `orders`.

## Adding a real processor

Example: adding Flutterwave.

1. Create `src/lib/payments/flutterwave.ts` exporting a `PaymentProvider` with `id: "flutterwave"`. `createPayment` returns `{ kind: "redirect", url }`. Add `verifyWebhook` if the processor sends webhooks.
2. Register it in the `PROVIDERS` map in `src/lib/payments/index.ts`.
3. Set `PAYMENT_PROVIDER=flutterwave` and the processor's own secret env vars.
4. If the processor sends webhooks, add a route under `src/app/api/webhooks/<id>/route.ts`. It calls `verifyWebhook`, then marks the order `paid` through the same claim-then-enroll path that `confirmOrder` uses. Reuse the order reference as the processor's transaction reference.

Nothing else changes. The checkout, the admin queue and the status flow already work with any `redirect` provider. Provider-specific code stays in that one file.

## Tests

```
npm run test:payments
```

Covers the pure modules: references, status transitions, proof validation and instruction building.

## Known gaps

- Payment proof is not verified against the provider. The admin checks the mobile money or bank statement by hand.
- There is no email to the admin when a learner submits proof.
- Coupon redemption counts (`coupons.uses_count`) are not incremented by checkout. This was already the case before this change.
