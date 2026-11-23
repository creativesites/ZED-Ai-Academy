# HANDOFF — shared log between Agent A and Agent B

Append only. Newest entries at the bottom of each section. Prefix every entry with the date, your
agent letter and phase, e.g. `2026-11-24 · A · A0.1`.

## Status board

| Milestone | State |
|---|---|
| A0.1 academy tree moved to `(academy)` | ✅ merged to `main` |
| A0 foundations merged | ⬜ |
| B0 security & routing merged | ✅ ready on `redesign/b0-security-routing` |
| B1 classroom split commit | ⬜ |
| B1 student shell merged | ⬜ |
| A1 staff shell merged | ⬜ |
| `MobileBottomNav` deleted | ⬜ |
| A2 admin screens merged | ⬜ |
| B2 student screens merged | ⬜ |
| B3 public site + templates merged | ⬜ |
| A3 creator → admin merge | ⬜ |

## Requests (to the other agent)

<!-- `date · from → to · file/area · what you need · why · blocking? (yes/no)` -->

## Decisions

<!-- Anything you decided that the other agent must follow (e.g. proxy redirect vs passthrough, template preset names). -->
- `2026-11-21 · B · B0` · On tenant subdomains, platform-only routes (`/courses/*/learn`, `/courses/*/checkout`, `/live-sessions/**`, `/certificates/**`, `/dashboard/**`, `/practice/**`) redirect to the apex domain with the same path and query string instead of rewriting under `/academy/[domain]`.

## Migrations to apply (the user applies these in Supabase)

<!-- `file · what it does · what breaks / degrades until applied` -->
- `supabase/migrations/20261121000001_orders_coupon_fields.sql` · Adds `coupon_code` and `discount_amount` to `orders`, and `company_id` and `starts_at` to `coupons` · Checkout and PayChangu webhook degrade gracefully without those columns (coupon discount is still charged accurately via PayChangu, but `coupon_code`/`discount_amount` are not persisted on `orders` until applied).

## Done

<!-- `date · agent · phase · branch/PR · summary · what the other agent should know` -->
- `2026-11-23 · A · A0.1 · main (PR #21) · A0.1 merged — academy tree is now under (academy) · Moved src/app/(marketing)/academy/** to src/app/(academy)/academy/** with a clean (academy)/layout.tsx (no legacy CSS, no marketing-shell, no MobileBottomNav) and a temporary legacy CSS bridge in academy/[domain]/page.tsx until B3.`
- `2026-11-23 · B · B0 · redesign/b0-security-routing · Completed B0 security, payments, and routing fixes (S1, S2, S6, F5, F6, F12, F17) · Added pure coupon pricing (src/lib/payments/pricing.ts), order/webhook confirmation (src/lib/payments/orders.ts), invite-only join decision (src/lib/tenants/join-decision.ts), proxy platform-route apex redirects + last_visited_tenant cookie, after-sign-in + resolve-home teacher landing, onboarding guard, tenant-filtered course metadata, and ?action=enroll CTA focus.`
