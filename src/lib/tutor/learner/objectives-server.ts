import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { isSchemaUnavailableError } from "../mastery/server.ts";
import { loose, type DbError, type LooseDb } from "./loose-db.ts";
import {
  cleanObjectiveText,
  MAX_EVIDENCE_CRITERIA,
  parseRegisteredObjectiveRow,
  planObjectiveUpsert,
  type IncomingObjective,
  type ObjectiveRef,
  type ObjectiveStatus,
  type RegisteredObjective,
} from "./objectives.ts";

// Database glue for the objective registry (P2-01). Callers authorise first (course managers for writes,
// session ownership / enrolment for reads); every function scopes by tenant and degrades to "registry
// unavailable" when migration 20261125000200 is not applied yet.

const OBJECTIVE_COLUMNS = "id, code, text, evidence_criteria, lesson_id, status, source";

export type RegistryResult<T> = { available: true; value: T } | { available: false };

function db(client?: unknown): LooseDb {
  return loose(client ?? createServiceClient());
}

function warn(where: string, error: DbError) {
  console.warn(`[tutor/objectives] ${where}:`, error.message ?? error.code);
}

function rowsOf(data: unknown): RegisteredObjective[] {
  return (Array.isArray(data) ? data : [])
    .map((r) => parseRegisteredObjectiveRow(r as Record<string, unknown>))
    .filter((r): r is RegisteredObjective => r !== null);
}

export async function listCourseObjectives(input: {
  courseId: string;
  companyId: string;
  includeRetired?: boolean;
  client?: unknown;
}): Promise<RegistryResult<RegisteredObjective[]>> {
  let q = db(input.client)
    .from("learning_objectives")
    .select(OBJECTIVE_COLUMNS)
    .eq("course_id", input.courseId)
    .eq("company_id", input.companyId);
  if (!input.includeRetired) q = q.neq("status", "retired");
  const res = await q.order("code", { ascending: true }).limit(500);
  if (res.error) {
    if (!isSchemaUnavailableError(res.error)) warn("list", res.error);
    return { available: false };
  }
  return { available: true, value: sortByCode(rowsOf(res.data)) };
}

function sortByCode(rows: RegisteredObjective[]): RegisteredObjective[] {
  const num = (c: string) => Number(/^O(\d+)$/i.exec(c)?.[1] ?? Number.MAX_SAFE_INTEGER);
  return [...rows].sort((a, b) => num(a.code) - num(b.code) || a.code.localeCompare(b.code));
}

/**
 * Persists a lesson's objectives into the course registry ("accept all"): matching rows are reused (and
 * updated when edited), new ones inserted with the next free code. Optionally links them to a flow.
 * Returns the registry rows in the order given.
 */
export async function saveLessonObjectives(input: {
  companyId: string;
  courseId: string;
  lessonId: string | null;
  userId: string;
  objectives: ReadonlyArray<IncomingObjective>;
  source?: "authored" | "extracted";
  scenarioId?: string | null;
  client?: unknown;
}): Promise<RegistryResult<RegisteredObjective[]>> {
  const client = db(input.client);
  const existingRes = await client
    .from("learning_objectives")
    .select(OBJECTIVE_COLUMNS)
    .eq("course_id", input.courseId)
    .eq("company_id", input.companyId)
    .limit(500);
  if (existingRes.error) {
    if (!isSchemaUnavailableError(existingRes.error)) warn("load before save", existingRes.error);
    return { available: false };
  }
  const existing = rowsOf(existingRes.data);
  const plan = planObjectiveUpsert({
    existing,
    allCourseCodes: existing.map((o) => o.code),
    lessonId: input.lessonId,
    incoming: input.objectives,
  });

  for (const u of plan.updates) {
    const res = await client
      .from("learning_objectives")
      .update({
        text: u.text,
        evidence_criteria: u.evidenceCriteria,
        ...(u.reactivate ? { status: "active" } : {}),
      })
      .eq("id", u.id)
      .eq("company_id", input.companyId);
    if (res.error) warn("update", res.error);
  }

  let inserted: RegisteredObjective[] = [];
  if (plan.inserts.length > 0) {
    const res = await client
      .from("learning_objectives")
      .insert(
        plan.inserts.map((i) => ({
          company_id: input.companyId,
          course_id: input.courseId,
          lesson_id: input.lessonId,
          code: i.code,
          text: i.text,
          evidence_criteria: i.evidenceCriteria,
          status: "active",
          source: input.source ?? "extracted",
          created_by: input.userId,
        })),
      )
      .select(OBJECTIVE_COLUMNS);
    if (res.error) {
      // A concurrent save may have taken a code (unique (course_id, code)). The caller can retry; the
      // flow still saves without registry links.
      warn("insert", res.error);
      return { available: false };
    }
    inserted = rowsOf(res.data);
  }

  const byId = new Map(existing.map((o) => [o.id, o]));
  const insertedByCode = new Map(inserted.map((o) => [o.code, o]));
  const updatedText = new Map(plan.updates.map((u) => [u.id, u]));
  const ordered: RegisteredObjective[] = [];
  for (const r of plan.resolved) {
    if ("existingId" in r) {
      const base = byId.get(r.existingId);
      if (!base) continue;
      const u = updatedText.get(base.id);
      ordered.push(u ? { ...base, text: u.text, evidenceCriteria: u.evidenceCriteria, status: "active" } : base);
    } else {
      const row = insertedByCode.get(plan.inserts[r.insertIndex]?.code ?? "");
      if (row) ordered.push(row);
    }
  }

  if (input.scenarioId) {
    await linkScenarioObjectives({
      client,
      scenarioId: input.scenarioId,
      companyId: input.companyId,
      objectiveIds: ordered.map((o) => o.id),
    });
  }
  return { available: true, value: ordered };
}

/** Replaces the set of objectives a flow teaches. */
export async function linkScenarioObjectives(input: {
  client?: unknown;
  scenarioId: string;
  companyId: string;
  objectiveIds: ReadonlyArray<string>;
}): Promise<boolean> {
  const client = db(input.client);
  const del = await client
    .from("scenario_objectives")
    .delete()
    .eq("scenario_id", input.scenarioId)
    .eq("company_id", input.companyId);
  if (del.error) {
    if (!isSchemaUnavailableError(del.error)) warn("unlink", del.error);
    return false;
  }
  const ids = Array.from(new Set(input.objectiveIds));
  if (ids.length === 0) return true;
  const ins = await client.from("scenario_objectives").insert(
    ids.map((objectiveId, position) => ({
      scenario_id: input.scenarioId,
      objective_id: objectiveId,
      company_id: input.companyId,
      position,
    })),
  );
  if (ins.error) {
    warn("link", ins.error);
    return false;
  }
  return true;
}

/** Objectives a flow teaches (active only), for the prompt prefix and note_evidence mapping. */
export async function loadScenarioObjectiveRefs(input: {
  client?: unknown;
  scenarioId: string;
  companyId: string;
}): Promise<ObjectiveRef[]> {
  const client = db(input.client);
  const links = await client
    .from("scenario_objectives")
    .select("objective_id, position")
    .eq("scenario_id", input.scenarioId)
    .eq("company_id", input.companyId)
    .order("position", { ascending: true });
  if (links.error) {
    if (!isSchemaUnavailableError(links.error)) warn("load scenario links", links.error);
    return [];
  }
  const ids = (Array.isArray(links.data) ? links.data : [])
    .map((l) => (l as { objective_id?: unknown }).objective_id)
    .filter((id): id is string => typeof id === "string");
  if (ids.length === 0) return [];
  const refs = await loadObjectiveRefsByIds({ client, ids, companyId: input.companyId });
  const order = new Map(ids.map((id, i) => [id, i]));
  return refs.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** Active objectives by id, constrained to one tenant (and optionally one course). Unknown ids are dropped. */
export async function loadObjectiveRefsByIds(input: {
  client?: unknown;
  ids: ReadonlyArray<string>;
  companyId: string;
  courseId?: string | null;
}): Promise<ObjectiveRef[]> {
  const ids = Array.from(new Set(input.ids)).slice(0, 50);
  if (ids.length === 0) return [];
  let q = db(input.client)
    .from("learning_objectives")
    .select("id, code, text, status, course_id")
    .in("id", ids)
    .eq("company_id", input.companyId)
    .eq("status", "active");
  if (input.courseId) q = q.eq("course_id", input.courseId);
  const res = await q;
  if (res.error) {
    if (!isSchemaUnavailableError(res.error)) warn("load by ids", res.error);
    return [];
  }
  return (Array.isArray(res.data) ? res.data : [])
    .map((r) => r as { id?: unknown; code?: unknown; text?: unknown })
    .filter((r): r is { id: string; code: string | null; text: string } => typeof r.id === "string" && typeof r.text === "string")
    .map((r) => ({ id: r.id, code: typeof r.code === "string" ? r.code : null, text: r.text }));
}

export async function updateObjective(input: {
  client?: unknown;
  id: string;
  companyId: string;
  courseId: string;
  text?: string;
  evidenceCriteria?: string | null;
  status?: ObjectiveStatus;
}): Promise<RegistryResult<RegisteredObjective | null>> {
  const patch: Record<string, unknown> = {};
  if (typeof input.text === "string") patch.text = cleanObjectiveText(input.text);
  if (input.evidenceCriteria !== undefined) {
    patch.evidence_criteria = input.evidenceCriteria
      ? cleanObjectiveText(input.evidenceCriteria, MAX_EVIDENCE_CRITERIA)
      : null;
  }
  if (input.status) patch.status = input.status;
  if (Object.keys(patch).length === 0) return { available: true, value: null };
  const res = await db(input.client)
    .from("learning_objectives")
    .update(patch)
    .eq("id", input.id)
    .eq("company_id", input.companyId)
    .eq("course_id", input.courseId)
    .select(OBJECTIVE_COLUMNS)
    .maybeSingle();
  if (res.error) {
    if (!isSchemaUnavailableError(res.error)) warn("update one", res.error);
    return { available: false };
  }
  return { available: true, value: res.data ? parseRegisteredObjectiveRow(res.data as Record<string, unknown>) : null };
}
