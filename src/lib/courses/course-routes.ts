export function normalizeCourseSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "course";
}

export function getCourseListPath(tenantSlug?: string | null): string {
  const cleanSlug = tenantSlug?.trim();
  return cleanSlug ? `/academy/${cleanSlug}/admin/courses` : "/creator/courses";
}

export function getCourseEditorPath(courseId: string, tenantSlug?: string | null): string {
  return `${getCourseListPath(tenantSlug)}/${courseId}`;
}

export function getLessonEditorPath(
  courseId: string,
  lessonId: string,
  tenantSlug?: string | null
): string {
  return `${getCourseEditorPath(courseId, tenantSlug)}/lessons/${lessonId}`;
}
