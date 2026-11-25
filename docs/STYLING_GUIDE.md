# CS Learn Styling Guide

> Brand identity, logo usage, colour and type tokens: see **[BRAND.md](./BRAND.md)**. This file covers how to apply them in UI work.

## 1. Visual direction
A premium, modern learning platform with a navy foundation, Royal Blue actions, and a few gold/orange achievement accents. Clean, structured layouts, generous whitespace, clear hierarchy, and restrained gradients. Avoid heavy glow and neon effects.

## 2. Typography
Fonts load in `src/app/layout.tsx` (`next/font`):
- `--font-inter` → **Inter**: body and UI (`font-sans`)
- `--font-manrope` → **Manrope**: headings and display (`font-heading`, `font-display`)
- `--font-jetbrains-mono` → **JetBrains Mono** (`font-mono`)

`h1`–`h6` use Manrope automatically (`globals.css`). Body text defaults to 15px with relaxed line height.

## 3. Colour
- Semantic shadcn tokens (`bg-background`, `bg-card`, `text-muted-foreground`, `bg-primary`, `border-border`, `ring-ring`) for generic UI.
- Brand tokens (`bg-brand`, `text-brand-text`, `text-ink`, `bg-navy`, `bg-brand-soft`, `text-brand-gold`) for brand-specific moments.
- **No raw hex in `className`** (`bg-[#…]`). If a colour is missing, add a token in `globals.css` and a mirror in `src/lib/brand.ts`.
- Inline styles can use CSS variables: `style={{ color: "var(--color-brand-text)" }}`.
- Canvas, SVG attributes, values saved to the DB and contrast maths need real hex: import `BRAND_COLORS`.

## 4. Components
- **Radius:** 10–16px for controls and cards (`rounded-xl`/`rounded-2xl`). `--radius` is 0.875rem.
- **Primary button:** `bg-brand hover:bg-brand-hover text-white font-semibold` (shadcn `Button` default variant uses `--primary`, which is the same colour).
- **Secondary button:** transparent or `bg-card` with `border` and `text-foreground`.
- **Cards:** `bg-card border border-border shadow-elev-1`, title and short description, progress bar (`bg-gradient-cs` fill is fine), and a category/difficulty label.
- **Achievement UI** (certificates, streaks, milestones): `text-brand-gold`, `bg-gradient-learn`.
- **Shadows:** `shadow-elev-1`, `shadow-elev-2`, `shadow-elev-3`. Keep them subtle. No coloured glow shadows on ordinary controls.

## 5. Dark surfaces
Use `bg-navy` / `bg-ink` (or `.dark`, or `data-surface="dark"`) for dark sections. Inside them `text-brand-text` brightens automatically. Use white for primary text and `text-slate-400` for secondary text.

## 6. Motion and accessibility
- Transitions of 150–300ms on colour, opacity and transform.
- Reduced motion is respected globally.
- Keep the visible focus states (global `:focus-visible` outline, or `focus-visible:ring-2 ring-ring`).
- Aim for WCAG AA contrast. Never rely on colour alone to show status.

## 7. Legacy template
Marketing pages still use the purchased "logistiq" template (`public/assets/css/style.css`, Bootstrap). Its `--logistiq-base` and `--logistiq-black` variables are mapped to Royal Blue and Deep Navy, and the header logo panels use Midnight Navy. App surfaces (`.app-surface`) reset the template's unlayered styles. See `app-surface-reset.css`.
