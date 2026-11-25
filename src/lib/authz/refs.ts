/**
 * Tenant reference checks.
 *
 * Server code reads and writes with the Supabase service role, so RLS does not stop a caller from naming
 * another tenant's course, lesson, scenario, persona or group. Every action that accepts such an id must
 * check that it belongs to the tenant the caller was authorised for. This module holds the rules; the
 * lookups are injected so the rules can be unit-tested without a database.
 *
 * Rules:
 * - course   → course.company_id (null means the platform tenant) must equal the tenant.
 * - lesson   → must belong to `courseId` when one is given, else to a course of the tenant.
 * - persona  → must belong to the tenant or to the platform tenant (shared starter cast).
 * - scenario → must belong to the tenant, or be a platform-visibility scenario.
 * - group    → must belong to the tenant.
 */

export type ScenarioOwner = { companyId: string; visibility: string | null };

export type TenantRefLookup = {
  /** company_id of the course; `null` when the column is null; `undefined` when the course does not exist. */
  courseCompany(courseId: string): Promise<string | null | undefined>;
  /** course_id of the lesson (via its module), or `null` when the lesson does not exist. */
  lessonCourse(lessonId: string): Promise<string | null>;
  scenarioOwner(scenarioId: string): Promise<ScenarioOwner | null>;
  personaCompany(personaId: string): Promise<string | null>;
  groupCompany(groupId: string): Promise<string | null>;
};

export type TenantRefs = {
  courseId?: string | null;
  lessonId?: string | null;
  scenarioId?: string | null;
  personaId?: string | null;
  groupId?: string | null;
};

export class TenantRefError extends Error {
  readonly ref: keyof TenantRefs;
  constructor(ref: keyof TenantRefs, message: string) {
    super(message);
    this.name = "TenantRefError";
    this.ref = ref;
  }
}

/** The tenant a course belongs to. Courses without a company belong to the platform tenant. */
export function courseTenantId(courseCompanyId: string | null | undefined, platformTenantId: string): string {
  return courseCompanyId ?? platformTenantId;
}

export async function assertRefsInTenant(
  lookup: TenantRefLookup,
  companyId: string,
  refs: TenantRefs,
  platformTenantId: string,
): Promise<void> {
  if (!companyId) throw new TenantRefError("courseId", "Missing tenant.");

  if (refs.courseId) {
    const courseCompany = await lookup.courseCompany(refs.courseId);
    if (courseCompany === undefined) throw new TenantRefError("courseId", "Course not found.");
    if (courseTenantId(courseCompany, platformTenantId) !== companyId) {
      throw new TenantRefError("courseId", "Course belongs to another academy.");
    }
  }

  if (refs.lessonId) {
    const lessonCourse = await lookup.lessonCourse(refs.lessonId);
    if (!lessonCourse) throw new TenantRefError("lessonId", "Lesson not found.");
    if (refs.courseId) {
      if (lessonCourse !== refs.courseId) {
        throw new TenantRefError("lessonId", "Lesson does not belong to this course.");
      }
    } else {
      const courseCompany = await lookup.courseCompany(lessonCourse);
      if (courseCompany === undefined || courseTenantId(courseCompany, platformTenantId) !== companyId) {
        throw new TenantRefError("lessonId", "Lesson belongs to another academy.");
      }
    }
  }

  if (refs.personaId) {
    const personaCompany = await lookup.personaCompany(refs.personaId);
    if (!personaCompany) throw new TenantRefError("personaId", "Teacher not found.");
    if (personaCompany !== companyId && personaCompany !== platformTenantId) {
      throw new TenantRefError("personaId", "Teacher belongs to another academy.");
    }
  }

  if (refs.scenarioId) {
    const owner = await lookup.scenarioOwner(refs.scenarioId);
    if (!owner) throw new TenantRefError("scenarioId", "Flow not found.");
    if (owner.companyId !== companyId && owner.visibility !== "platform") {
      throw new TenantRefError("scenarioId", "Flow belongs to another academy.");
    }
  }

  if (refs.groupId) {
    const groupCompany = await lookup.groupCompany(refs.groupId);
    if (!groupCompany) throw new TenantRefError("groupId", "Class group not found.");
    if (groupCompany !== companyId) {
      throw new TenantRefError("groupId", "Class group belongs to another academy.");
    }
  }
}

/** Minimal structural view of a Supabase client: enough for the lookups, without importing app types. */
type QueryResult = PromiseLike<{ data: Record<string, unknown> | null; error: unknown }>;
type RefQueryClient = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): { maybeSingle(): QueryResult };
    };
  };
};

export function createSupabaseRefLookup(db: RefQueryClient): TenantRefLookup {
  const one = async (table: string, columns: string, id: string) => {
    const { data } = await db.from(table).select(columns).eq("id", id).maybeSingle();
    return data;
  };
  return {
    async courseCompany(courseId) {
      const row = await one("courses", "id, company_id", courseId);
      if (!row) return undefined;
      return (row.company_id as string | null) ?? null;
    },
    async lessonCourse(lessonId) {
      const lesson = await one("lessons", "id, module_id", lessonId);
      if (!lesson?.module_id) return null;
      const mod = await one("modules", "id, course_id", String(lesson.module_id));
      return (mod?.course_id as string | null) ?? null;
    },
    async scenarioOwner(scenarioId) {
      const row = await one("practice_scenarios", "id, company_id, visibility", scenarioId);
      if (!row) return null;
      return { companyId: String(row.company_id), visibility: (row.visibility as string | null) ?? null };
    },
    async personaCompany(personaId) {
      const row = await one("ai_personas", "id, company_id", personaId);
      return (row?.company_id as string | null) ?? null;
    },
    async groupCompany(groupId) {
      const row = await one("classroom_groups", "id, company_id", groupId);
      return (row?.company_id as string | null) ?? null;
    },
  };
}
