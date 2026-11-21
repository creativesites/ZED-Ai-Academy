-- Add coupon tracking columns to orders and tenant scoping / start date to coupons.
-- Applied manually by the user; application code degrades gracefully if not yet applied.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0;

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_coupon_code ON public.orders (coupon_code) WHERE coupon_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coupons_company_id ON public.coupons (company_id) WHERE company_id IS NOT NULL;
