-- One order per payment gateway reference (tx_ref). Settlement (webhook, return page and
-- reconcile job) looks orders up by payment_reference and must find exactly one row.
-- Idempotent: safe to re-run.
CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_reference_key
  ON public.orders (payment_reference)
  WHERE payment_reference IS NOT NULL;

-- Speeds up the reconcile job's scan of stale pending orders.
CREATE INDEX IF NOT EXISTS orders_pending_created_at_idx
  ON public.orders (created_at)
  WHERE status = 'pending';
