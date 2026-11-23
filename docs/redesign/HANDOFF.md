# HANDOFF — shared log between Agent A and Agent B

Append only. Newest entries at the bottom of each section. Prefix every entry with the date, your
agent letter and phase, e.g. `2026-11-24 · A · A0.1`.

## Status board

| Milestone | State |
|---|---|
| A0.1 academy tree moved to `(academy)` | ✅ merged to `main` |
| A0 foundations merged | ⬜ |
| B0 security & routing merged | ⬜ |
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
