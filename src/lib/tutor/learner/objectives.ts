// Objective registry rules (Architecture §4.1, P2-01). Pure: no I/O and no "@/" imports.
//
// Registered objectives are referenced by id everywhere new (evidence, mastery, prompt prefix, quiz
// questions). Mastery rows for a registered objective use `objective_key = objective_id::text`, so the
// key no longer depends on the objective's wording (and non-Latin text no longer collapses to one key).

export type ObjectiveStatus = "draft" | "active" | "retired";
export type ObjectiveSource = "authored" | "extracted" | "legacy";

export type RegisteredObjective = {
  id: string;
  code: string;
  text: string;
  evidenceCriteria: string | null;
  lessonId: string | null;
  status: ObjectiveStatus;
  source: ObjectiveSource;
};

/** Minimal shape the teacher runtime needs: what the prompt lists and what note_evidence may cite. */
export type ObjectiveRef = { id: string; code?: string | null; text: string };

export type IncomingObjective = { text: string; evidence?: string | null };

export const MAX_OBJECTIVE_TEXT = 500;
export const MAX_EVIDENCE_CRITERIA = 600;
export const MAX_OBJECTIVES_PER_SAVE = 12;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

/** Mastery/evidence key for a registered objective. */
export function objectiveKeyForId(id: string): string {
  return id.trim().toLowerCase();
}

/**
 * Comparison form of objective text: Unicode-normalised, case-folded, punctuation-insensitive.
 * Works for any script (the legacy ASCII slug turned every non-Latin objective into the same key).
 */
export function normalizeObjectiveText(text: string): string {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .trim();
}

export function cleanObjectiveText(text: string, max = MAX_OBJECTIVE_TEXT): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

function codeNumber(code: string): number {
  const m = /^O(\d+)$/i.exec(code.trim());
  return m ? Number(m[1]) : 0;
}

export function nextObjectiveCode(existingCodes: ReadonlyArray<string>, offset = 0): string {
  const max = existingCodes.reduce((acc, c) => Math.max(acc, codeNumber(c)), 0);
  return `O${max + 1 + offset}`;
}

export type ObjectiveUpsertPlan = {
  inserts: Array<{ code: string; text: string; evidenceCriteria: string | null }>;
  updates: Array<{ id: string; text: string; evidenceCriteria: string | null; reactivate: boolean }>;
  /**
   * For each incoming objective (same order, after dropping blanks and duplicates): either the id of the
   * existing registry row it matched, or `{ insertIndex }` pointing into `inserts`.
   */
  resolved: Array<{ existingId: string } | { insertIndex: number }>;
};

/**
 * Plans how a lesson's (edited or extracted) objectives land in the course registry. An incoming
 * objective matches an existing one of the same lesson (or a lesson-less one) by normalised text, so
 * re-running extraction never duplicates rows; everything else becomes a new row with the next free code.
 * Retired matches are reactivated (the author just accepted them again).
 */
export function planObjectiveUpsert(input: {
  existing: ReadonlyArray<RegisteredObjective>;
  allCourseCodes: ReadonlyArray<string>;
  lessonId: string | null;
  incoming: ReadonlyArray<IncomingObjective>;
}): ObjectiveUpsertPlan {
  const plan: ObjectiveUpsertPlan = { inserts: [], updates: [], resolved: [] };
  const candidates = input.existing.filter((o) => o.lessonId === input.lessonId || o.lessonId === null);
  const byNorm = new Map<string, RegisteredObjective>();
  for (const o of candidates) {
    const norm = normalizeObjectiveText(o.text);
    if (norm && !byNorm.has(norm)) byNorm.set(norm, o);
  }

  const seen = new Set<string>();
  for (const raw of input.incoming.slice(0, MAX_OBJECTIVES_PER_SAVE)) {
    const text = cleanObjectiveText(raw.text ?? "");
    const norm = normalizeObjectiveText(text);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    const evidenceCriteria = raw.evidence ? cleanObjectiveText(raw.evidence, MAX_EVIDENCE_CRITERIA) || null : null;

    const match = byNorm.get(norm);
    if (match) {
      const changed =
        match.text !== text ||
        (evidenceCriteria !== null && evidenceCriteria !== match.evidenceCriteria) ||
        match.status !== "active";
      if (changed) {
        plan.updates.push({
          id: match.id,
          text,
          evidenceCriteria: evidenceCriteria ?? match.evidenceCriteria,
          reactivate: match.status !== "active",
        });
      }
      plan.resolved.push({ existingId: match.id });
      continue;
    }

    plan.inserts.push({
      code: nextObjectiveCode(input.allCourseCodes, plan.inserts.length),
      text,
      evidenceCriteria,
    });
    plan.resolved.push({ insertIndex: plan.inserts.length - 1 });
  }
  return plan;
}

/**
 * Maps the value the model put in `note_evidence.objective` to a registered objective of this session:
 * by id, then by code, then by (normalised) text. Returns null for anything unknown; the caller then
 * falls back to a legacy free-text key (Architecture §4.3).
 */
export function resolveObjectiveRef<T extends ObjectiveRef>(value: unknown, objectives: ReadonlyArray<T>): T | null {
  if (typeof value !== "string" || objectives.length === 0) return null;
  const v = value.trim();
  if (!v) return null;
  const lower = v.toLowerCase();
  const byId = objectives.find((o) => o.id.toLowerCase() === lower);
  if (byId) return byId;
  // Tolerate "id: text" echoed back from the prompt line.
  const head = lower.split(/[\s:]+/)[0];
  if (head && head !== lower) {
    const byHead = objectives.find((o) => o.id.toLowerCase() === head);
    if (byHead) return byHead;
  }
  const byCode = objectives.find((o) => o.code && o.code.toLowerCase() === lower);
  if (byCode) return byCode;
  const norm = normalizeObjectiveText(v);
  if (!norm) return null;
  return objectives.find((o) => normalizeObjectiveText(o.text) === norm) ?? null;
}

/** Prompt prefix lines: `id: text`, one per objective (P2-01 acceptance). */
export function formatObjectivePromptLines(objectives: ReadonlyArray<ObjectiveRef>, max = 12): string[] {
  return objectives
    .filter((o) => o.id && o.text.trim())
    .slice(0, max)
    .map((o) => `${o.id}: ${cleanObjectiveText(o.text, 240)}`);
}

export function parseRegisteredObjectiveRow(row: Record<string, unknown>): RegisteredObjective | null {
  if (typeof row.id !== "string" || typeof row.text !== "string") return null;
  const status = row.status === "draft" || row.status === "retired" ? row.status : "active";
  const source = row.source === "authored" || row.source === "legacy" ? row.source : "extracted";
  return {
    id: row.id,
    code: typeof row.code === "string" ? row.code : "",
    text: row.text,
    evidenceCriteria: typeof row.evidence_criteria === "string" ? row.evidence_criteria : null,
    lessonId: typeof row.lesson_id === "string" ? row.lesson_id : null,
    status,
    source,
  };
}
