// Links between AI teacher surfaces that keep the learner inside their academy. Teacher pages (Teacher home,
// sessions, revision, cards, history, "What Tinashe knows") live at /academy/[domain]/practice/** for
// academy learners and at /practice/** on the platform. The lesson player has one route for everyone
// (/courses/[slug]/learn) and is never prefixed. Build every teacher link with these helpers, and derive the
// academy from the resource (the course's company), not from the current URL.

const ACADEMY_PREFIX = /^\/academy\/([^/?#]+)/;
const ACADEMY_LESSON = /^\/academy\/[^/?#]+(\/courses\/[^/?#]+\/learn(?:[?#].*)?)$/;

/** Routes that only exist at the platform root, even for academy learners. */
const PLATFORM_ONLY = [
  /^\/courses\/[^/?#]+\/(learn|checkout)(?=$|[/?#])/,
  /^\/(certificates|live-sessions|try|ai-tutor|sign-in|sign-up)(?=$|[/?#])/,
];

/** An academy slug we are willing to put in a URL: lowercase letters, digits and dashes. */
export function cleanAcademySlug(domain: string | null | undefined): string | null {
  const slug = typeof domain === "string" ? domain.trim().toLowerCase() : "";
  return /^[a-z0-9][a-z0-9-]{0,62}$/.test(slug) ? slug : null;
}

/** "/academy/<slug>" for an academy, "" for the platform (no or invalid slug). */
export function academyBase(domain: string | null | undefined): string {
  const slug = cleanAcademySlug(domain);
  return slug ? `/academy/${slug}` : "";
}

/**
 * The href for an app path inside the learner's academy. `path` starts with "/" (e.g. "/practice/deck",
 * "/practice/abc?lessonId=1"). Paths that already carry an academy, platform-only routes (the lesson player,
 * checkout, certificates, live sessions) and external or relative links are returned unchanged.
 */
export function academyHref(domain: string | null | undefined, path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  // There is no lesson player under /academy/[domain]: send "/academy/x/courses/y/learn" to the real one.
  const academyLesson = ACADEMY_LESSON.exec(path);
  if (academyLesson) return academyLesson[1];
  if (ACADEMY_PREFIX.test(path)) return path;
  if (PLATFORM_ONLY.some((re) => re.test(path))) return path;
  const base = academyBase(domain);
  if (!base) return path;
  return path === "/" ? base : `${base}${path}`;
}

/** The single lesson player route, optionally opened at one lesson. */
export function lessonHref(courseSlug: string, lessonId?: string | null): string {
  const base = `/courses/${encodeURIComponent(courseSlug)}/learn`;
  return lessonId ? `${base}?lesson=${encodeURIComponent(lessonId)}` : base;
}

/** The academy slug in a pathname like "/academy/acme/practice", or null on platform paths. */
export function academySlugFromPath(pathname: string | null | undefined): string | null {
  const match = ACADEMY_PREFIX.exec(pathname ?? "");
  return match ? cleanAcademySlug(decodeURIComponent(match[1])) : null;
}
