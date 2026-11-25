"use server";

import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ZEDAI_TENANT_ID } from "@/lib/tenants/constants";
import { isSchemaUnavailableError } from "@/lib/tutor/mastery/server";
import {
  addGoalSchema,
  authorizeMemoryAction,
  buildLearnerExport,
  cleanLearnerText,
  editMemorySchema,
  evidenceRedactionFor,
  exportFileName,
  memoryIdSchema,
} from "@/lib/tutor/learner/memory-actions";
import { memoryFromRow, type LearnerMemoryRecord } from "@/lib/tutor/learner/memory";
import { loadLearnerHabits, looseDb, MEMORY_COLUMNS, type LooseDb } from "@/lib/tutor/learner/memory-server";
import { preferencesPatchSchema, type LearnerPreferences } from "@/lib/tutor/learner/preferences";
import { loadLearnerPreferences, saveLearnerPreferences } from "@/lib/tutor/learner/preferences-server";

// "What my teacher knows" actions (P1-08). The service role bypasses RLS, so every action checks
// ownership in code (authorizeMemoryAction) and every write is also filtered by user_id. The tenant
// always comes from the stored row (or the course / academy record), never from the client.

export type MemoryActionResult = { ok: true } | { ok: false; error: string };

type DbError = { code?: string; message?: string } | null;

const NOT_FOUND: { ok: false; error: string } = { ok: false, error: "That item no longer exists." };
const UNAVAILABLE: { ok: false; error: string } = { ok: false, error: "Memory settings are not available yet." };

async function requireUser(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

async function loadOwnedMemory(
  db: LooseDb,
  id: string,
  userId: string,
): Promise<{ memory: LearnerMemoryRecord; companyId: string } | null | "unavailable"> {
  const res = (await db
    .from("learner_memories")
    .select(`${MEMORY_COLUMNS}, user_id`)
    .eq("id", id)
    .maybeSingle()) as { data: Record<string, unknown> | null; error: DbError };
  if (res.error) return isSchemaUnavailableError(res.error) ? "unavailable" : null;
  const row = res.data;
  const ownership = authorizeMemoryAction(
    row ? { user_id: String(row.user_id), company_id: String(row.company_id), status: String(row.status) } : null,
    userId,
  );
  if (!ownership.ok || !row) return null;
  const memory = memoryFromRow(row);
  return memory ? { memory, companyId: ownership.companyId } : null;
}

async function withOwnedMemory(
  rawId: string,
  fn: (ctx: { db: LooseDb; userId: string; memory: LearnerMemoryRecord; companyId: string }) => Promise<MemoryActionResult>,
): Promise<MemoryActionResult> {
  const userId = await requireUser();
  if (!userId) return { ok: false, error: "Please sign in again." };
  const id = memoryIdSchema.safeParse(rawId);
  if (!id.success) return NOT_FOUND;
  const db = looseDb();
  const owned = await loadOwnedMemory(db, id.data, userId);
  if (owned === "unavailable") return UNAVAILABLE;
  if (!owned) return NOT_FOUND;
  return fn({ db, userId, ...owned });
}

/** Learner corrects the text of one of their memories. */
export async function updateMemoryText(id: string, content: string): Promise<MemoryActionResult> {
  const parsed = editMemorySchema.safeParse({ id, content });
  if (!parsed.success) return NOT_FOUND;
  const text = cleanLearnerText(parsed.data.content);
  if (!text) return { ok: false, error: "Write something, or delete the item instead." };
  return withOwnedMemory(parsed.data.id, async ({ db, userId, memory, companyId }) => {
    const { error } = (await db
      .from("learner_memories")
      .update({ content: text, confidence: 1 })
      .eq("id", memory.id)
      .eq("user_id", userId)
      .eq("company_id", companyId)) as { error: DbError };
    return error ? { ok: false, error: "Could not save. Try again." } : { ok: true };
  });
}

/** "This isn't right" / "Show again": hidden memories never reach the teacher's prompt. */
export async function setMemoryHidden(id: string, hidden: boolean): Promise<MemoryActionResult> {
  return withOwnedMemory(id, async ({ db, userId, memory, companyId }) => {
    const { error } = (await db
      .from("learner_memories")
      .update({ status: hidden ? "hidden" : "active" })
      .eq("id", memory.id)
      .eq("user_id", userId)
      .eq("company_id", companyId)) as { error: DbError };
    return error ? { ok: false, error: "Could not save. Try again." } : { ok: true };
  });
}

/** Hard delete of the memory, and the free-text detail of the evidence it was made from is redacted. */
export async function deleteMemory(id: string): Promise<MemoryActionResult> {
  return withOwnedMemory(id, async ({ db, userId, memory, companyId }) => {
    const { error } = (await db
      .from("learner_memories")
      .delete()
      .eq("id", memory.id)
      .eq("user_id", userId)
      .eq("company_id", companyId)) as { error: DbError };
    if (error) return { ok: false, error: "Could not delete. Try again." };

    const redact = evidenceRedactionFor(memory, userId);
    if (redact) {
      let q = db
        .from("learner_evidence")
        .update({ detail: null })
        .eq("user_id", redact.userId)
        .eq("company_id", companyId)
        .eq("session_id", redact.sessionId);
      if (redact.objectiveKey) q = q.eq("objective_key", redact.objectiveKey);
      const { error: redactError } = (await q) as { error: DbError };
      if (redactError && !isSchemaUnavailableError(redactError)) {
        console.warn("[learner-memory] evidence redaction failed:", redactError.message);
      }
    }
    return { ok: true };
  });
}

/**
 * "Forget this course": deletes every memory about the course and redacts the free-text detail of the
 * course's evidence. Mastery states are kept (they are progress records); the learner sees them on the page.
 */
export async function forgetCourse(rawCourseId: string): Promise<MemoryActionResult> {
  const userId = await requireUser();
  if (!userId) return { ok: false, error: "Please sign in again." };
  const courseId = memoryIdSchema.safeParse(rawCourseId);
  if (!courseId.success) return NOT_FOUND;

  const supabase = createServiceClient();
  const { data: course } = await supabase.from("courses").select("id, company_id").eq("id", courseId.data).maybeSingle();
  if (!course) return NOT_FOUND;
  const companyId = course.company_id ?? ZEDAI_TENANT_ID;
  const db = looseDb(supabase);

  const { error } = (await db
    .from("learner_memories")
    .delete()
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("course_id", course.id)) as { error: DbError };
  if (error) return isSchemaUnavailableError(error) ? UNAVAILABLE : { ok: false, error: "Could not forget the course. Try again." };

  const { error: redactError } = (await db
    .from("learner_evidence")
    .update({ detail: null })
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("course_id", course.id)) as { error: DbError };
  if (redactError && !isSchemaUnavailableError(redactError)) {
    console.warn("[learner-memory] course evidence redaction failed:", redactError.message);
  }
  return { ok: true };
}

/** The academy a page belongs to, if the learner may use it (member, enrolled, or the platform academy). */
async function academyForLearner(domain: string, userId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data: company } = await supabase.from("companies").select("id").eq("slug", domain).maybeSingle();
  if (!company) return null;
  if (company.id === ZEDAI_TENANT_ID) return company.id;
  const [{ data: member }, { data: enrollment }] = await Promise.all([
    supabase
      .from("company_members")
      .select("company_id")
      .eq("profile_id", userId)
      .eq("company_id", company.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("enrollments")
      .select("id")
      .eq("user_id", userId)
      .eq("company_id", company.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
  ]);
  return member || enrollment ? company.id : null;
}

/** First-meeting goal entered on the page (learner_stated). Replaces nothing; the learner can edit it later. */
export async function addLearnerGoal(
  domain: string,
  content: string,
): Promise<{ ok: true; id: string; companyId: string } | { ok: false; error: string }> {
  const userId = await requireUser();
  if (!userId) return { ok: false, error: "Please sign in again." };
  const parsed = addGoalSchema.safeParse({ domain, content });
  if (!parsed.success) return { ok: false, error: "Write a short goal." };
  const text = cleanLearnerText(parsed.data.content);
  if (!text) return { ok: false, error: "Write a short goal." };
  const companyId = await academyForLearner(parsed.data.domain, userId);
  if (!companyId) return NOT_FOUND;

  const id = crypto.randomUUID();
  const { error } = (await looseDb()
    .from("learner_memories")
    .insert({
      id,
      company_id: companyId,
      user_id: userId,
      kind: "goal",
      content: text,
      source: "learner_stated",
      source_ref: "about_me_page",
      confidence: 1,
    })) as { error: DbError };
  if (error) return isSchemaUnavailableError(error) ? UNAVAILABLE : { ok: false, error: "Could not save. Try again." };
  return { ok: true, id, companyId };
}

/** Everything the teacher keeps about the signed-in learner, in every academy, as a JSON document. */
export async function exportMyLearnerData(): Promise<{ ok: true; fileName: string; json: string } | { ok: false; error: string }> {
  const userId = await requireUser();
  if (!userId) return { ok: false, error: "Please sign in again." };
  const db = looseDb();

  const [memRes, prefs, habits, mastery, evidence] = await Promise.all([
    db
      .from("learner_memories")
      .select(MEMORY_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(2000) as PromiseLike<{ data: Record<string, unknown>[] | null; error: DbError }>,
    loadLearnerPreferences(userId, db),
    loadLearnerHabits(userId, db),
    db
      .from("learner_mastery")
      .select("company_id, course_id, objective_key, objective_text, level, evidence_count, last_result, last_evidence_at")
      .eq("user_id", userId)
      .limit(2000) as PromiseLike<{ data: unknown[] | null; error: DbError }>,
    db
      .from("learner_evidence")
      .select("company_id, course_id, session_id, objective_key, objective_text, result, detail, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5000) as PromiseLike<{ data: unknown[] | null; error: DbError }>,
  ]);

  const exportedAt = new Date().toISOString();
  const json = buildLearnerExport({
    userId,
    exportedAt,
    memories: (memRes.error ? [] : (memRes.data ?? [])).flatMap((r) => {
      const m = memoryFromRow(r);
      return m ? [m] : [];
    }),
    preferences: prefs.preferences,
    habits: habits.habits,
    objectives: mastery.error ? [] : (mastery.data ?? []),
    evidence: evidence.error ? [] : (evidence.data ?? []),
  });
  return { ok: true, fileName: exportFileName(exportedAt), json };
}

/** Account preferences for the teacher (global, not per academy). Null when signed out or not migrated. */
export async function getMyLearnerPreferences(): Promise<LearnerPreferences | null> {
  const userId = await requireUser();
  if (!userId) return null;
  return (await loadLearnerPreferences(userId)).preferences;
}

export async function saveMyLearnerPreferences(patch: unknown): Promise<MemoryActionResult> {
  const userId = await requireUser();
  if (!userId) return { ok: false, error: "Please sign in again." };
  const parsed = preferencesPatchSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: "Invalid preference." };
  try {
    return (await saveLearnerPreferences(userId, parsed.data)) ? { ok: true } : UNAVAILABLE;
  } catch {
    return { ok: false, error: "Could not save. Try again." };
  }
}
