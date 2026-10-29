/**
 * Academy slug rules. Pure: no I/O, so it is unit-tested directly and can be
 * imported by src/proxy.ts. Supabase (companies.slug) owns slugs; Clerk's
 * organization slug is never used.
 */

/** Subdomains that never resolve to an academy (src/proxy.ts routes them to the main site). */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  "www",
  "api",
  "admin",
  "app",
  "auth",
  "mail",
  "test",
  "dev",
  "staging",
  "dashboard",
  "creator",
  "superadmin",
  "academy",
]);

/** Names that cannot be an academy slug: every reserved subdomain plus app routes and infrastructure names. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  ...RESERVED_SUBDOMAINS,
  "join",
  "sign-in",
  "sign-up",
  "sso-callback",
  "onboarding",
  "launch-your-academy",
  "after-sign-in",
  "settings",
  "support",
  "help",
  "static",
  "assets",
  "cdn",
  "status",
  "www2",
  "smtp",
  "ftp",
]);

const MAX_SLUG_LENGTH = 48;

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

/** Lowercase, ASCII letters/digits and single dashes. Falls back to "academy" for empty names. */
export function baseAcademySlug(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
  return slug || "academy";
}

/**
 * First free slug for `name`: the base itself, then base-2, base-3, ...
 * `taken` holds slugs already used by OTHER academies. Reserved names are never returned.
 */
export function pickAvailableSlug(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = baseAcademySlug(name);
  if (!isReservedSlug(base) && !used.has(base)) return base;
  for (let n = 2; n < 10_000; n++) {
    const candidate = `${base}-${n}`;
    if (!isReservedSlug(candidate) && !used.has(candidate)) return candidate;
  }
  // Practically unreachable; keeps the function total.
  return `${base}-${Date.now().toString(36)}`;
}
