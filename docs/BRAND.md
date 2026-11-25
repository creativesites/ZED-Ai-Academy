# CS Learn — Brand Implementation Guide

**Product:** CS Learn · **Full name:** CreativeSites Learn · **Parent:** CreativeSites
**Domain:** https://learn.creativesites.site · **Tagline:** LEARN • PRACTICE • BUILD • GROW

CS Learn is a standalone learning product in the CreativeSites ecosystem. CreativeSites builds technology; CS Learn helps people learn, practise, build and grow.

This file explains how the brand is wired into the code. For general UI rules see [STYLING_GUIDE.md](./STYLING_GUIDE.md).

---

## 1. Sources of truth

| What | Where |
|---|---|
| Names, domain, tagline, support email, logo paths, hex colours for non-CSS contexts | `src/lib/brand.ts` (`BRAND`, `BRAND_COLORS`, `BRAND_LOGOS`, `BRAND_GRADIENTS`, `DEFAULT_PRIMARY_COLOR`) |
| CSS design tokens (Tailwind v4 `@theme`), light/dark themes, gradients, focus styles | `src/app/globals.css` |
| Logo component | `src/components/shared/brand-logo.tsx` → `<BrandLogo variant="…" />` |
| Logo files | `public/brand/` |
| Favicon / app icon / Apple icon / OG image | `src/app/favicon.ico`, `src/app/icon.png`, `src/app/apple-icon.png`, `src/app/opengraph-image.jpg` (Next.js metadata file conventions) |
| PWA manifest + icons | `public/manifest.json`, `public/brand/icon-*.png` |
| Root metadata (title template, OG, Twitter, `metadataBase`) | `src/app/layout.tsx` |
| Legacy marketing template colours | `--logistiq-*` variables in `public/assets/css/style.css` (mapped to CS Learn values) |

**Rule:** don't hard-code brand hex in components. Use the Tailwind tokens below in JSX, and `BRAND_COLORS` from `@/lib/brand` only where CSS variables can't be used (canvas, SVG attributes, contrast maths, data defaults written to the DB).

## 2. Naming

| Context | Use |
|---|---|
| Compact UI (nav, buttons, page `<title>` suffix, AI prompts, short copy) | **CS Learn** (`BRAND.name`) |
| Formal (footer copyright, certificates, OG `siteName`, sign-up pitch) | **CreativeSites Learn** (`BRAND.fullName`) |
| Company / publisher | **CreativeSites** (`BRAND.parent`) |

Page titles: set only the page name (`title: "Pricing"`). The root template appends `| CS Learn`.

Technical identifiers stay as they are on purpose: the platform tenant slug `zedai`, `ZEDAI_TENANT_ID`, the `/academy/zedai` route, table and column names, and the repo and package name. Renaming them would mean data migrations and would break URLs.

## 3. Logo assets

All variants come from the supplied CreativeSites Learn artwork (Downloads, 25 Nov 2026). The "transparent" source files had a checkerboard pattern baked into the pixels and the dark ones sat on solid navy. Real alpha channels were made by keying out the background. The artwork itself was not redrawn, recoloured or cropped.

| Variant (`<BrandLogo variant>`) | File | Use on |
|---|---|---|
| `onDark` (default) | `cs-learn-logo-on-dark.png` | Navy/charcoal surfaces: headers, footers, mobile menu, dark heroes |
| `onLight` | `cs-learn-logo-on-light.png` | White/light surfaces: auth forms, certificates, light nav |
| `emblem` | `cs-learn-emblem.png` | Any background, compact spots (creator nav, avatars, favicon source) |
| `emblemOnDark` | `cs-learn-emblem-on-dark.png` | Dark compact spots (super-admin nav, preloader) |
| — | `cs-learn-logo-dark-framed.jpg` | The original framed artwork on navy, for decks and social posts |

- Size the logo with a height (`h-10 w-auto`) or width (`w-[200px] h-auto`) only. Its aspect ratio is fixed, so never set both.
- The tagline row in the full lockup can't be read below about 60px of logo height. In tight spaces use an emblem.
- **Known gap:** the light-background lockup is white lettering with a dark outline (that's how it was supplied). For a stronger light-mode wordmark, ask design for a version with navy lettering and replace `cs-learn-logo-on-light.png`. No code changes needed.

## 4. Colour tokens

| Token (Tailwind) | Hex | Use |
|---|---|---|
| `brand` | `#075BEB` Royal Blue | Primary buttons, fills, rings, progress |
| `brand-hover` | `#0549C8` | Hover/pressed for `bg-brand` |
| `brand-text` | `#075BEB` → `#33C5F6` on dark | Accent text and icons. Switches to a brighter blue automatically inside `bg-ink`, `bg-navy*`, `.dark` and `[data-surface="dark"]`, so it stays AA-legible |
| `brand-soft` / `brand-tint` | `#EEF4FF` / `#E1ECFE` | Tinted surfaces, hover rows, icon wells |
| `brand-electric` | `#00B9F4` | Highlights and interactive accents on dark |
| `brand-purple` / `brand-violet` / `brand-magenta` | `#6500F5` / `#9200E8` / `#F000A8` | Gradient stops only |
| `brand-orange` / `brand-gold` | `#FF8500` / `#FFC400` | Achievements, certificates, milestones, ratings. Use sparingly |
| `ink` / `ink-hover` | `#09152B` / `#15233D` | Primary dark text and dark section backgrounds |
| `navy`, `navy-deep`, `navy-card`, `navy-elevated` | `#050D20`, `#09152B`, `#101D35`, `#15233D` | Dark theme layers |
| `surface`, `line`, `charcoal`, `slate-ink` | `#F5F7FC`, `#E5EAF2`, `#172033`, `#334155` | Neutrals |

Use opacity modifiers freely, e.g. `bg-brand/10` or `border-ink/10`.

### Gradients (use them selectively)
`bg-gradient-cs` (cyan → royal → purple), `bg-gradient-learn` (gold → orange → magenta) and `bg-gradient-brand` (full spectrum). `text-gradient-*` variants exist for headline words. Use gradients for brand moments, progress bars and key highlights, not on every card or button.

### Themes
- **Light** (default app UI): canvas `#F5F7FC`, cards white, text `#172033`, secondary text `#64748B`, borders `#E5EAF2`, primary `#075BEB`.
- **Dark** (`.dark`, the flagship navy look): canvas `#050D20`, cards `#101D35`, popovers `#15233D`, text white, secondary text `#94A3B8`, ring Electric Blue.

## 5. Typography

- **Inter**: body, UI, forms, dashboards (`font-sans`).
- **Manrope**: headings, course titles, big stats (`font-heading` is applied to `h1`–`h6` automatically; `font-display` is available as a utility).
- **JetBrains Mono**: code and IDs (`font-mono`).

| Element | Weight | Size |
|---|---|---|
| Hero | 800 | 48–64px (`text-display`) |
| Page heading | 700 | 32–40px |
| Section heading | 700 | 24–30px |
| Card heading | 600 | 18–22px |
| Body | 400 | 15–17px |
| Supporting | 400 | 13–14px |
| Label | 600 | 12–13px |

## 6. Accessibility

- A global `:focus-visible` outline uses Royal Blue (Electric Blue on dark).
- `brand-text` changes value on dark surfaces so accent text keeps AA contrast. Royal Blue on white measures about 5.6:1.
- `prefers-reduced-motion` turns off animations everywhere (`globals.css`).
- Don't use colour alone to show status. Pair it with an icon or a text label.

## 7. Tenant academies

Tenant academies keep their own colours and logos (`companies.primary_color`, `companies.logo_url`). The CS Learn brand only sets defaults: `DEFAULT_PRIMARY_COLOR` (`#075BEB`) is used when a tenant hasn't chosen a colour, and the "CS Learn Navy" palette is the first curated preset in the branding studio.
