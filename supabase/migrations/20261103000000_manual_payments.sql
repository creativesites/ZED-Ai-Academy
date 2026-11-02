-- =============================================================================
-- Manual payments (launch mode).
--
-- Learners pay by MTN MoMo, Airtel Money or bank transfer, quote an order
-- reference, then submit their transaction ID. An academy admin confirms or
-- rejects the order. Confirming creates the enrollment.
--
--  * orders.status gains 'awaiting_confirmation' and 'rejected'.
--  * orders gets the learner's proof and the admin's decision.
--  * companies gets payment_settings (per-academy MoMo / Airtel / bank details).
--  * RLS: owners and tenant staff can read orders. Writes stay with the service
--    role (server actions), so anon and authenticated keep no INSERT/UPDATE.
--
-- Idempotent: every change uses IF EXISTS / IF NOT EXISTS / DROP POLICY IF EXISTS.
-- Current user = (auth.jwt() ->> 'sub'), never auth.uid().
--
-- NOT APPLIED to any database. Review, then apply with the Supabase CLI.
-- =============================================================================

BEGIN;

-- 1. Order statuses.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'awaiting_confirmation', 'paid', 'rejected', 'failed', 'refunded'));

-- 2. Learner proof and admin decision. payment_method (existing) holds the
--    method the learner chose (MTN MoMo, Airtel Money, Bank transfer, Other).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS transaction_id       text,
  ADD COLUMN IF NOT EXISTS payment_note         text,
  ADD COLUMN IF NOT EXISTS payment_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason     text,
  ADD COLUMN IF NOT EXISTS rejected_at          timestamptz,
  ADD COLUMN IF NOT EXISTS decided_by           text;   -- Clerk user id of the admin who confirmed or rejected

-- 3. Per-academy payment destinations: { "mtn": "...", "airtel": "...", "bank": "...", "instructions": "..." }.
--    Not granted to anon or authenticated (companies uses column grants, see
--    20261028000000_rls_hardening.sql C3), so only the server reads it.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS payment_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 4. Order references are typed into payment notes, so they must be unique.
CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_reference_key
  ON public.orders (payment_reference)
  WHERE payment_reference IS NOT NULL;

-- 5. Lookup indexes for the admin queue and for duplicate transaction IDs.
CREATE INDEX IF NOT EXISTS orders_course_status_idx ON public.orders (course_id, status);
CREATE INDEX IF NOT EXISTS orders_transaction_id_idx
  ON public.orders (transaction_id)
  WHERE transaction_id IS NOT NULL;

-- 6. RLS. Owners read their own orders. Active tenant staff read orders for
--    courses they manage. Nobody but the service role writes.
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT
  USING (user_id = (auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "Tenant staff can view orders" ON public.orders;
CREATE POLICY "Tenant staff can view orders"
  ON public.orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = orders.course_id
        AND public.is_company_staff(c.company_id::text)
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.orders FROM anon, authenticated;

COMMIT;
