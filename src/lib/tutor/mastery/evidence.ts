import type { TutorEvent } from "../events.ts";
import type { EvidenceSource } from "../learner/knowledge.ts";
import { objectiveKeyForId, resolveObjectiveRef, type ObjectiveRef } from "../learner/objectives.ts";

export type EvidenceResult = "correct" | "partial" | "misconception";

export type ObjectiveOutcomeStatus = "met" | "partial" | "review";

export type CollectedEvidence = {
  objectiveKey: string;
  objectiveText: string;
  result: EvidenceResult;
  detail: string | null;
  /** Registered objective (P2-01). When set, objectiveKey is the id. */
  objectiveId?: string | null;
  /** Evidence v2 (P2-02). Defaults: teacher_judgement, unverified. */
  source?: EvidenceSource;
  serverVerified?: boolean;
  /** 0..1, overrides result in the knowledge rule. */
  score?: number | null;
  /** 1 recall .. 3 transfer. */
  difficulty?: number | null;
  /** Quiz question id, interaction id, ... */
  itemRef?: string | null;
};

export type MasteryState = {
  objectiveKey: string;
  objectiveText: string;
  level: number;
  evidenceCount: number;
  lastResult: EvidenceResult | null;
  lastEvidenceAt: string | null;
};

export type SessionObjectiveSummary = {
  objectiveKey: string;
  objectiveText: string;
  status: ObjectiveOutcomeStatus;
  lastResult: EvidenceResult;
  evidence: string;
  nextStep?: string;
  masteryLevel: number;
};

export type MasteryScope = {
  courseId?: string | null;
  scenarioId?: string | null;
};

const MAX_OBJECTIVE_SLUG = 96;
const MAX_DETAIL_CHARS = 240;

/**
 * Produces a stable, collision-resistant key for an objective within its course or scenario.
 */
export function normalizeObjectiveKey(
  objectiveText: string,
  scope: MasteryScope = {},
): string {
  const normalized = objectiveText
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, MAX_OBJECTIVE_SLUG)
    .replace(/^-+|-+$/g, "");

  // Text with no ASCII letters/digits (Chinese, Arabic, ...) used to collapse to one shared key. Such text now
  // gets a stable hash of its Unicode form; ASCII keys are unchanged so existing mastery rows still match.
  const slug = normalized || unicodeObjectiveSlug(objectiveText) || "general-objective";
  const prefix = scope.courseId
    ? `course:${scope.courseId}:`
    : scope.scenarioId
      ? `scenario:${scope.scenarioId}:`
      : "global:";

  return `${prefix}${slug}`;
}

function unicodeObjectiveSlug(objectiveText: string): string {
  const folded = objectiveText
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .trim();
  if (!folded) return "";
  // FNV-1a 32-bit, twice with different offsets for a 64-bit-ish key: deterministic and dependency-free.
  const fnv = (seed: number) => {
    let h = seed >>> 0;
    for (const ch of folded) {
      h ^= ch.codePointAt(0) ?? 0;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(36);
  };
  return `u-${fnv(0x811c9dc5)}${fnv(0x01234567)}`;
}

export function clampMasteryLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(3, Math.round(level)));
}

/**
 * Mastery rollup rule:
 * - correct: +1
 * - partial: +0 (minimum stays 1 once partial evidence exists? No: stays current level, clamped 0..3)
 * - misconception: -1
 */
export function nextMasteryLevel(
  currentLevel: number,
  result: EvidenceResult,
): number {
  const base = clampMasteryLevel(currentLevel);
  if (result === "correct") return clampMasteryLevel(base + 1);
  if (result === "misconception") return clampMasteryLevel(base - 1);
  return base;
}

function cleanText(raw: string | undefined | null, fallback = ""): string {
  const s = (raw ?? "").replace(/\s+/g, " ").trim();
  return s || fallback;
}

/**
 * Extracts `note_evidence` events emitted by the AI teacher across session turns.
 * Also maps legacy `note_mistake` (when paired with category) only if no `note_evidence` exists? No,
 * `note_evidence` is the v2 mastery signal; keep language `note_mistake` separate.
 */
export function collectNoteEvidence(
  turns: Array<{ eventsJson?: unknown }>,
  scope: MasteryScope = {},
  /** Registered objectives of the session: note_evidence citing one of them (by id, code or text) maps to it. */
  objectives: ReadonlyArray<ObjectiveRef> = [],
): CollectedEvidence[] {
  const items: CollectedEvidence[] = [];

  for (const turn of turns) {
    if (!Array.isArray(turn.eventsJson)) continue;
    for (const raw of turn.eventsJson) {
      if (!raw || typeof raw !== "object") continue;
      const ev = raw as Partial<TutorEvent>;
      if (ev.type !== "note_evidence") continue;

      const objectiveText = cleanText(
        "objective" in ev ? ev.objective : undefined,
      );
      const result = "result" in ev ? ev.result : undefined;
      if (
        !objectiveText ||
        (result !== "correct" &&
          result !== "partial" &&
          result !== "misconception")
      ) {
        continue;
      }

      const rawDetail =
        "detail" in ev ? cleanText(ev.detail) : "";
      const detail = rawDetail ? rawDetail.slice(0, MAX_DETAIL_CHARS) : null;

      const registered = resolveObjectiveRef(objectiveText, objectives);
      items.push({
        objectiveKey: registered ? objectiveKeyForId(registered.id) : normalizeObjectiveKey(objectiveText, scope),
        objectiveText: registered ? registered.text : objectiveText,
        result,
        detail,
        objectiveId: registered ? registered.id : null,
        // The teacher's judgement of an open answer: half weight, never server-verified (Architecture §4.3).
        source: "teacher_judgement",
        serverVerified: false,
      });
    }
  }

  return items;
}

/**
 * Applies a chronologically ordered batch of evidence events onto existing mastery rows
 * (keyed by objectiveKey) and returns updated mastery states for all touched objectives.
 */
export function applyEvidenceBatch(
  existingByKey: ReadonlyMap<string, MasteryState>,
  batch: ReadonlyArray<CollectedEvidence>,
  timestampIso: string,
): MasteryState[] {
  const working = new Map<string, MasteryState>();

  for (const ev of batch) {
    const prev =
      working.get(ev.objectiveKey) ??
      existingByKey.get(ev.objectiveKey) ?? {
        objectiveKey: ev.objectiveKey,
        objectiveText: ev.objectiveText,
        level: 0,
        evidenceCount: 0,
        lastResult: null,
        lastEvidenceAt: null,
      };

    working.set(ev.objectiveKey, {
      objectiveKey: ev.objectiveKey,
      objectiveText: ev.objectiveText || prev.objectiveText,
      level: nextMasteryLevel(prev.level, ev.result),
      evidenceCount: prev.evidenceCount + 1,
      lastResult: ev.result,
      lastEvidenceAt: timestampIso,
    });
  }

  return Array.from(working.values());
}

function defaultEvidenceLine(result: EvidenceResult): string {
  if (result === "correct") return "Answered accurately during the session.";
  if (result === "partial") return "Got the main idea; needs another pass for full confidence.";
  return "Ran into a misconception here — worth a quick review.";
}

function defaultNextStep(result: EvidenceResult, objectiveText: string): string | undefined {
  if (result === "correct") return undefined;
  if (result === "partial") {
    return `Work through one more check on "${objectiveText}" without hints.`;
  }
  return `Revisit "${objectiveText}" with a simple worked example.`;
}

function outcomeStatusFromResult(
  result: EvidenceResult,
  correctCount: number,
  misconceptionCount: number,
): ObjectiveOutcomeStatus {
  if (result === "misconception") return "review";
  if (result === "partial") return "partial";
  if (misconceptionCount > 0 && correctCount <= misconceptionCount) return "partial";
  return "met";
}

/**
 * Summarizes session `note_evidence` into per-objective outcomes for Report Card v2.
 * Orders weak/review items first or preserves encounter order grouped clearly by objective.
 */
export function summarizeSessionObjectives(
  batch: ReadonlyArray<CollectedEvidence>,
  updatedMastery: ReadonlyArray<MasteryState>,
): SessionObjectiveSummary[] {
  const levelByKey = new Map<string, number>();
  for (const m of updatedMastery) {
    levelByKey.set(m.objectiveKey, m.level);
  }

  const grouped = new Map<
    string,
    {
      objectiveKey: string;
      objectiveText: string;
      lastResult: EvidenceResult;
      lastDetail: string | null;
      correctCount: number;
      misconceptionCount: number;
    }
  >();

  for (const ev of batch) {
    const prev = grouped.get(ev.objectiveKey) ?? {
      objectiveKey: ev.objectiveKey,
      objectiveText: ev.objectiveText,
      lastResult: ev.result,
      lastDetail: null,
      correctCount: 0,
      misconceptionCount: 0,
    };
    prev.objectiveText = ev.objectiveText;
    prev.lastResult = ev.result;
    if (ev.detail) prev.lastDetail = ev.detail;
    if (ev.result === "correct") prev.correctCount += 1;
    if (ev.result === "misconception") prev.misconceptionCount += 1;
    grouped.set(ev.objectiveKey, prev);
  }

  return Array.from(grouped.values()).map((entry) => {
    const status = outcomeStatusFromResult(
      entry.lastResult,
      entry.correctCount,
      entry.misconceptionCount,
    );
    const masteryLevel =
      levelByKey.get(entry.objectiveKey) ??
      nextMasteryLevel(0, entry.lastResult);

    return {
      objectiveKey: entry.objectiveKey,
      objectiveText: entry.objectiveText,
      status,
      lastResult: entry.lastResult,
      evidence: entry.lastDetail ?? defaultEvidenceLine(entry.lastResult),
      nextStep: defaultNextStep(entry.lastResult, entry.objectiveText),
      masteryLevel,
    };
  });
}

/**
 * Formats weak mastery rows into short bullet strings for `learnerProfile.memoryNotes`.
 */
export function formatMasteryMemoryNotes(
  rows: ReadonlyArray<{
    objectiveText: string;
    level: number;
    lastResult?: EvidenceResult | null;
  }>,
  limit = 6,
): string[] {
  return [...rows]
    .filter((r) => r.level <= 2)
    .sort((a, b) => a.level - b.level)
    .slice(0, limit)
    .map((r) => {
      const tag =
        r.level === 0
          ? "needs review"
          : r.level === 1
            ? "developing"
            : "almost solid";
      return `Objective (${tag}, level ${r.level}/3): ${r.objectiveText}`;
    });
}
