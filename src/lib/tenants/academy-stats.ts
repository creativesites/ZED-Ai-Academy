/**
 * Stats shown on an academy's public page. Pure, unit-tested.
 *
 * Only real numbers (or values the academy owner typed into their page content)
 * are shown. A value with no data is null, and templates hide it; a brand-new
 * academy shows no stats at all instead of made-up ones.
 */

export type AcademyStats = {
  students: string | null;
  rating: string | null;
  success: string | null;
};

export type AcademyStatsInput = {
  learnerCount: number | null | undefined;
  enrollmentCount: number | null | undefined;
  completionCount: number | null | undefined;
  ratingAverage: number | null | undefined;
  ratingCount: number | null | undefined;
};

/** Owner-entered overrides from companies.home_content (stats_students, stats_rating, stats_success). */
export type AcademyStatsOverrides = Record<string, unknown> | null | undefined;

function override(content: AcademyStatsOverrides, key: string): string | null {
  const value = content?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function formatCount(n: number): string {
  return n > 100 ? `${n.toLocaleString("en-US")}+` : String(n);
}

export function computeAcademyStats(input: AcademyStatsInput, content?: AcademyStatsOverrides): AcademyStats {
  const learners = input.learnerCount ?? 0;
  const enrollments = input.enrollmentCount ?? 0;
  const completions = input.completionCount ?? 0;
  const ratingCount = input.ratingCount ?? 0;
  const ratingAverage = input.ratingAverage ?? 0;

  const students = learners > 0 ? formatCount(learners) : null;
  const rating = ratingCount > 0 && ratingAverage > 0 ? `${ratingAverage.toFixed(1)}/5` : null;
  const success =
    enrollments > 0 && completions > 0
      ? `${Math.min(100, Math.round((completions / enrollments) * 100))}%`
      : null;

  return {
    students: override(content, "stats_students") ?? students,
    rating: override(content, "stats_rating") ?? rating,
    success: override(content, "stats_success") ?? success,
  };
}

export function hasAnyStat(stats: AcademyStats | null | undefined): boolean {
  return Boolean(stats && (stats.students || stats.rating || stats.success));
}
