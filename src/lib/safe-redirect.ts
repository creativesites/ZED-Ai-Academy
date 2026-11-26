/**
 * Turn an untrusted `redirect_url` into a same-site relative path, or null.
 *
 * Rejects backslashes and control characters (browsers treat `/\evil.com` like `//evil.com`),
 * then resolves the URL and requires it to stay on `origin` (or an allowed absolute host,
 * e.g. a tenant subdomain of the root domain).
 */
export function safeRedirectPath(
  raw: string | null | undefined,
  origin: string,
  isAllowedHost: (host: string) => boolean = () => false
): string | null {
  if (!raw) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null;

  try {
    if (raw.startsWith("/") && !raw.startsWith("//")) {
      const base = new URL(origin);
      const u = new URL(raw, base);
      if (u.origin !== base.origin) return null;
      return u.pathname + u.search + u.hash;
    }
    if (raw.startsWith("https://") || raw.startsWith("http://")) {
      const u = new URL(raw);
      if (u.origin === new URL(origin).origin || isAllowedHost(u.host)) {
        return u.pathname + u.search + u.hash;
      }
    }
  } catch {
    return null;
  }
  return null;
}
