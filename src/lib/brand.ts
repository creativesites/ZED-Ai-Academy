/**
 * CS Learn brand — single source of truth for product identity.
 *
 * Use `BRAND.name` ("CS Learn") in compact UI, `BRAND.fullName` ("CreativeSites Learn")
 * where the full identity fits (page titles, footers, certificates, emails).
 *
 * Colours here are the hex values for places that cannot read CSS variables
 * (canvas, PDFs, emails, contrast maths, tenant fallbacks). In JSX/CSS prefer the
 * Tailwind tokens defined in `src/app/globals.css` (`bg-brand`, `text-ink`, …).
 *
 * NOTE: technical identifiers (the `zedai` tenant slug, ZEDAI_TENANT_ID, table names,
 * routes such as /academy/zedai) intentionally keep their legacy names.
 */

export const BRAND = {
  name: "CS Learn",
  fullName: "CreativeSites Learn",
  parent: "CreativeSites",
  domain: "learn.creativesites.site",
  url: "https://learn.creativesites.site",
  tagline: "LEARN • PRACTICE • BUILD • GROW",
  taglineWords: ["Learn", "Practice", "Build", "Grow"] as const,
  description:
    "Learn, practise and build practical AI and technology skills with hands-on courses, an AI tutor and certificates — built for individuals and teams in Africa.",
  supportEmail: "creativesites263@gmail.com",
  defaultAuthor: "CS Learn Team",
} as const;

export const BRAND_COLORS = {
  midnight: "#050D20",
  navy: "#09152B",
  navyCard: "#101D35",
  navyElevated: "#15233D",
  royalBlue: "#075BEB",
  royalBlueHover: "#0549C8",
  electricBlue: "#00B9F4",
  purple: "#6500F5",
  violet: "#9200E8",
  orange: "#FF8500",
  gold: "#FFC400",
  magenta: "#F000A8",
  white: "#FFFFFF",
  softWhite: "#F5F7FC",
  lightGray: "#E5EAF2",
  slate: "#94A3B8",
  darkSlate: "#334155",
  charcoal: "#172033",
} as const;

/** Default accent for tenants/academies that have not chosen their own colour. */
export const DEFAULT_PRIMARY_COLOR = BRAND_COLORS.royalBlue;
/** Default dark/secondary colour for tenant themes. */
export const DEFAULT_SECONDARY_COLOR = BRAND_COLORS.navy;

export const BRAND_GRADIENTS = {
  primary: "linear-gradient(120deg, #00B9F4, #075BEB, #6500F5)",
  learn: "linear-gradient(120deg, #FFC400, #FF8500, #F000A8)",
  combined: "linear-gradient(110deg, #00B9F4, #075BEB, #6500F5, #F000A8, #FF8500)",
} as const;

/** Logo files in /public/brand. Never stretch, recolour or crop them. */
export const BRAND_LOGOS = {
  /** Full lockup with white wordmark — dark navy/charcoal backgrounds. */
  onDark: { src: "/brand/cs-learn-logo-on-dark.png", width: 1200, height: 374 },
  /** Full lockup with outlined wordmark — white / light backgrounds. */
  onLight: { src: "/brand/cs-learn-logo-on-light.png", width: 1200, height: 396 },
  /** Icon-only emblem with outline — works on light and dark. */
  emblem: { src: "/brand/cs-learn-emblem.png", width: 512, height: 456 },
  /** Icon-only emblem without outline — dark backgrounds. */
  emblemOnDark: { src: "/brand/cs-learn-emblem-on-dark.png", width: 512, height: 448 },
} as const;

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || BRAND.url).replace(/\/$/, "");
}
