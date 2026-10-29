/**
 * Where sign-up and sign-in send people. Pure: no I/O, so it is unit-tested
 * directly and shared by the auth pages, src/proxy.ts and /after-sign-in.
 *
 * These values only route people; they never grant anything. Every destination
 * re-checks the caller on the server (staff codes, academy ownership, ...).
 */

export type SignupRole = "company_admin" | "teacher" | "student";

export type SignupIntent = {
  role: SignupRole | null;
  /** Academy slug the person was invited to (from the join link). */
  tenant: string | null;
  /** Staff code from a staff invite link. */
  code: string | null;
  /** Same-site path to return to. */
  redirectUrl: string | null;
  enrollCourse: string | null;
};

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const CODE_RE = /^\d{4,8}$/;

function read(params: ParamSource, key: string): string | null {
  if (params instanceof URLSearchParams) return params.get(key);
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function normalizeSignupRole(raw: string | null | undefined): SignupRole | null {
  if (raw === "company_admin" || raw === "tutor") return "company_admin";
  if (raw === "teacher") return "teacher";
  if (raw === "student" || raw === "learner") return "student";
  return null;
}

/**
 * A same-site relative path, or null. Absolute URLs are reduced to their path
 * (Clerk passes full URLs as redirect_url); protocol-relative and backslash
 * tricks are rejected.
 */
export function safeRelativePath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      value = `${url.pathname}${url.search}`;
    } catch {
      return null;
    }
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (/[\u0000-\u001f]/.test(value)) return null;
  return value;
}

/** The academy slug in a /academy/{slug}/... path, if any. */
export function tenantFromPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const match = path.match(/^\/academy\/([^/?#]+)/);
  const slug = match?.[1]?.toLowerCase() ?? null;
  return slug && SLUG_RE.test(slug) ? slug : null;
}

export function readSignupIntent(params: ParamSource): SignupIntent {
  const tenant = read(params, "tenant")?.toLowerCase() ?? null;
  const code = read(params, "code")?.trim() ?? null;
  const enrollCourse = read(params, "enroll_course");
  return {
    role: normalizeSignupRole(read(params, "role")),
    tenant: tenant && SLUG_RE.test(tenant) ? tenant : null,
    code: code && CODE_RE.test(code) ? code : null,
    redirectUrl: safeRelativePath(read(params, "redirect_url")),
    enrollCourse: enrollCourse && /^[a-z0-9-]{1,128}$/.test(enrollCourse) ? enrollCourse : null,
  };
}

/** The academy this sign-up belongs to: explicit `tenant`, else one in the return path. */
export function intentTenant(intent: SignupIntent): string | null {
  if (intent.role === "company_admin") return null;
  return intent.tenant ?? tenantFromPath(intent.redirectUrl);
}

function withQuery(path: string, query: Record<string, string | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Query string that carries the intent between the sign-up chooser, sign-up and sign-in. */
export function intentQuery(intent: SignupIntent, overrides: Partial<SignupIntent> = {}): string {
  const merged = { ...intent, ...overrides };
  const params = new URLSearchParams();
  if (merged.role) params.set("role", merged.role);
  if (merged.tenant) params.set("tenant", merged.tenant);
  if (merged.code) params.set("code", merged.code);
  if (merged.redirectUrl) params.set("redirect_url", merged.redirectUrl);
  if (merged.enrollCourse) params.set("enroll_course", merged.enrollCourse);
  return params.toString();
}

/** Where a NEW account goes right after sign-up (email or Google). */
export function afterSignUpPath(intent: SignupIntent): string {
  if (intent.role === "company_admin") return "/launch-your-academy";

  const role = intent.role === "teacher" ? "teacher" : "student";
  const tenant = intentTenant(intent);
  if (tenant) {
    const next = tenantFromPath(intent.redirectUrl) === tenant ? intent.redirectUrl : null;
    return withQuery("/onboarding", {
      role,
      tenant,
      code: role === "teacher" ? intent.code : null,
      next,
    });
  }
  return withQuery("/onboarding", {
    role,
    enroll_course: intent.enrollCourse,
    next: intent.redirectUrl,
  });
}

/** Where an EXISTING account goes after signing in (or a signed-in visitor of /sign-in, /sign-up). */
export function afterSignInPath(intent: SignupIntent): string {
  if (intent.role === "company_admin") return "/launch-your-academy";

  const tenant = intentTenant(intent);
  if (tenant && (intent.tenant || intent.role)) {
    // The join page adds the membership (learner, or teacher after the staff-code check).
    if (intent.role === "teacher") {
      return withQuery(`/academy/${tenant}/join`, { role: "teacher", code: intent.code });
    }
    return `/academy/${tenant}/join`;
  }
  if (intent.redirectUrl) return withQuery("/after-sign-in", { redirect_url: intent.redirectUrl });
  if (intent.enrollCourse) return `/courses/${intent.enrollCourse}`;
  return "/after-sign-in";
}

/**
 * src/proxy.ts: a signed-in visitor of exactly /sign-in or /sign-up is sent on,
 * keeping the role and return path. Sub-paths (sso-callback, factor-one,
 * verify-email-address, continue, ...) are part of Clerk's own flow and must
 * never be interrupted, so they return null.
 */
export function signedInAuthPageRedirect(pathname: string, params: URLSearchParams): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path !== "/sign-in" && path !== "/sign-up") return null;
  return afterSignInPath(readSignupIntent(params));
}

/** What sign-up stores (Clerk unsafeMetadata) so an interrupted sign-up can resume. */
export type SignupResumeHint = { signupRole?: unknown; signupTenant?: unknown };

/** Where someone who has not finished onboarding resumes (e.g. after closing the tab). */
export function resumeOnboardingPath(hint: SignupResumeHint | null | undefined): string {
  const role = normalizeSignupRole(typeof hint?.signupRole === "string" ? hint.signupRole : null);
  if (role === "company_admin") return "/launch-your-academy";
  const tenant =
    typeof hint?.signupTenant === "string" && SLUG_RE.test(hint.signupTenant) ? hint.signupTenant : null;
  if (tenant) return withQuery("/onboarding", { role: role === "teacher" ? "teacher" : "student", tenant });
  return role ? withQuery("/onboarding", { role }) : "/onboarding";
}
