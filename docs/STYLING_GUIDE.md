# Zed AI Academy Styling Guide

## 1. Visual Direction
A modern, light-first interface with high readability, soft depth, and crisp blue accents.

Design goals:
- Keep backgrounds bright and clean.
- Use subtle gradients and soft shadows instead of heavy dark panels.
- Prioritize clear hierarchy and generous spacing.

## 2. Typography
Defined in `/Users/winstonzulu/Documents/GitHub/zed-ai-academy/src/app/layout.tsx`:
- Primary (`--font-manrope`): `Manrope`
- Heading (`--font-sora`): `Sora`
- Mono (`--font-jetbrains-mono`): `JetBrains Mono`

Usage:
- Body copy: `font-sans`
- Headings: automatically mapped to `font-heading` in `globals.css`
- Technical snippets or IDs: `font-mono`

## 3. Color System
Design tokens live in `/Users/winstonzulu/Documents/GitHub/zed-ai-academy/src/app/globals.css`.

Core semantic tokens:
- `--background`: app canvas
- `--foreground`: default text
- `--primary`: action blue
- `--secondary`: neutral UI fill
- `--muted` / `--muted-foreground`: subdued surfaces and secondary text
- `--border`: low-contrast separators and strokes

Guidelines:
- Use `text-slate-900` or `text-foreground` for major text.
- Use `text-slate-600` or `text-muted-foreground` for supporting text.
- Reserve `primary` color for key actions, links, and status emphasis.

## 4. Surface & Elevation
Utility in `globals.css`:
- `.surface-card`: shared elevated light surface style for cards.

Use `.surface-card` for feature cards, metric blocks, and neutral panels.

## 5. Component Styling Rules
Buttons:
- Primary CTA: filled blue (`bg-blue-600`, `hover:bg-blue-500`, white text)
- Secondary CTA: outlined neutral (`border-slate-300`, `bg-white`)

Cards:
- Rounded corners (`rounded-2xl` or token-based radius)
- Light border (`border-slate-200` or `border-border`)
- Soft shadow only (avoid dark, high-contrast shadows)

Badges:
- Lightweight semantic badges (`blue-50`, `cyan-50`) with subtle borders.

## 6. Layout & Spacing
- Use `max-w-6xl` or `max-w-7xl` content containers.
- Section rhythm: usually `py-16` to `py-20`.
- Keep hero content width constrained (`max-w-3xl`) for readability.

## 7. Motion
- Keep transitions short and calm (`transition-all`, `duration-200` to `300`).
- Use subtle hover lift (`hover:-translate-y-0.5`) and shadow changes.
- Avoid aggressive scale/rotation on key UI elements.

## 8. Accessibility
- Maintain strong color contrast on all text and CTAs.
- Ensure focus styles remain visible (ring tokens are already configured).
- Never rely on color alone for critical state communication.

## 9. Implementation Notes
Primary files for this system:
- `/Users/winstonzulu/Documents/GitHub/zed-ai-academy/src/app/layout.tsx`
- `/Users/winstonzulu/Documents/GitHub/zed-ai-academy/src/app/globals.css`
- `/Users/winstonzulu/Documents/GitHub/zed-ai-academy/src/app/(marketing)/page.tsx`
- `/Users/winstonzulu/Documents/GitHub/zed-ai-academy/src/components/shared/navbar.tsx`
- `/Users/winstonzulu/Documents/GitHub/zed-ai-academy/src/components/shared/footer.tsx`

When designing new pages, start from token-based colors and shared surface styles instead of hard-coded dark palettes.
