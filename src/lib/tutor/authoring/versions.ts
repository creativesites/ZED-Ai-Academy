// Flow (practice scenario) versioning: pure rules for snapshots, pinning and restore (P1-04, Architecture §7.1).
// DB glue lives in versions-server.ts. No server, Next or Supabase imports here.
//
// A snapshot holds the teaching content of a flow. Placement and access (company, course, lesson, visibility,
// status) are not part of it: restoring an old version never moves a flow or changes who can see it.

/** Columns copied into a snapshot. Keep in sync with scripts/sql/backfill-scenario-versions.sql. */
export const SCENARIO_SNAPSHOT_FIELDS = [
  "skill_pack",
  "persona_id",
  "title",
  "goal",
  "beats",
  "target_items",
  "level",
  "exam_task",
  "max_minutes",
  "allowed_modes",
  "scene",
  "style",
] as const;

export type ScenarioSnapshotField = (typeof SCENARIO_SNAPSHOT_FIELDS)[number];
export type ScenarioSnapshot = { [K in ScenarioSnapshotField]?: unknown };

export type ScenarioVersionSummary = {
  version: number;
  createdAt: string;
  createdBy: string | null;
  note: string | null;
  title: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The content snapshot of a scenario row. Missing columns are left out, not invented. */
export function snapshotFromScenarioRow(row: Record<string, unknown>): ScenarioSnapshot {
  const snapshot: ScenarioSnapshot = {};
  for (const field of SCENARIO_SNAPSHOT_FIELDS) {
    if (field in row && row[field] !== undefined) snapshot[field] = row[field];
  }
  return snapshot;
}

/** Parses a stored snapshot. Unknown keys are dropped; a non-object yields null. */
export function parseSnapshot(value: unknown): ScenarioSnapshot | null {
  if (!isPlainObject(value)) return null;
  const snapshot: ScenarioSnapshot = {};
  for (const field of SCENARIO_SNAPSHOT_FIELDS) {
    if (field in value && value[field] !== undefined) snapshot[field] = value[field];
  }
  return Object.keys(snapshot).length > 0 ? snapshot : null;
}

/**
 * The scenario a session runs: the live row with the pinned snapshot's content laid over it.
 * Ids, tenant, placement and access stay from the live row. Without a snapshot, the live row (today's behaviour).
 */
export function applySnapshot<R extends Record<string, unknown>>(row: R, snapshot: ScenarioSnapshot | null): R {
  if (!snapshot) return row;
  const out: Record<string, unknown> = { ...row };
  for (const field of SCENARIO_SNAPSHOT_FIELDS) {
    if (field in snapshot && snapshot[field] !== undefined) out[field] = snapshot[field];
  }
  return out as R;
}

function stable(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    isPlainObject(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v,
  );
}

/** Whether two snapshots have the same content (key order ignored). */
export function snapshotsEqual(a: ScenarioSnapshot | null, b: ScenarioSnapshot | null): boolean {
  if (!a || !b) return a === b;
  return stable(parseSnapshot(a)) === stable(parseSnapshot(b));
}

/** The next version number after the ones that exist (1 for a flow with none). */
export function nextVersionNumber(existing: readonly number[]): number {
  const valid = existing.filter((v) => Number.isInteger(v) && v >= 1);
  return valid.length === 0 ? 1 : Math.max(...valid) + 1;
}

export type SaveVersionPlan =
  | { action: "create"; version: number }
  /** Content unchanged since the latest version: publish that one rather than adding a duplicate. */
  | { action: "reuse"; version: number };

/** What saving a flow does to its history. */
export function planSaveVersion(input: {
  snapshot: ScenarioSnapshot;
  latest: { version: number; snapshot: ScenarioSnapshot | null } | null;
  /** Always add a version (restore does: it is an explicit, recorded act). */
  forceNew?: boolean;
}): SaveVersionPlan {
  if (!input.forceNew && input.latest && snapshotsEqual(input.latest.snapshot, input.snapshot)) {
    return { action: "reuse", version: input.latest.version };
  }
  return { action: "create", version: input.latest ? input.latest.version + 1 : 1 };
}

export type RestorePlan =
  | { ok: true; snapshot: ScenarioSnapshot; version: number; note: string }
  | { ok: false; reason: "version_not_found" | "invalid_snapshot" };

/** Restoring creates a new version from an old snapshot; history is never rewritten. */
export function planRestore(input: {
  target: number;
  versions: readonly { version: number; snapshot: unknown }[];
}): RestorePlan {
  const found = input.versions.find((v) => v.version === input.target);
  if (!found) return { ok: false, reason: "version_not_found" };
  const snapshot = parseSnapshot(found.snapshot);
  if (!snapshot) return { ok: false, reason: "invalid_snapshot" };
  return {
    ok: true,
    snapshot,
    version: nextVersionNumber(input.versions.map((v) => v.version)),
    note: `Restored from v${input.target}`,
  };
}

export type PinPlan =
  /** Pin the published version. */
  | { action: "pin"; version: number }
  /** The flow has no version yet: create v1 from the live row, then pin it. */
  | { action: "create_v1" }
  /** Versioning is not available (migration not applied): run the live row, as before. */
  | { action: "none" };

/** Which version a new session pins. */
export function planSessionPin(input: { versioningAvailable: boolean; publishedVersion: number | null | undefined }): PinPlan {
  if (!input.versioningAvailable) return { action: "none" };
  const v = input.publishedVersion;
  if (typeof v === "number" && Number.isInteger(v) && v >= 1) return { action: "pin", version: v };
  return { action: "create_v1" };
}

/** Soft-deleted flows are hidden from lists and pickers. */
export function isArchivedScenario(row: { archived_at?: string | null }): boolean {
  return typeof row.archived_at === "string" && row.archived_at.length > 0;
}

/** Rows for a Versions list: newest first. */
export function summarizeVersions(
  rows: readonly { version: number; snapshot: unknown; created_at: string; created_by: string | null; note: string | null }[],
): ScenarioVersionSummary[] {
  return [...rows]
    .sort((a, b) => b.version - a.version)
    .map((row) => {
      const snap = parseSnapshot(row.snapshot);
      return {
        version: row.version,
        createdAt: row.created_at,
        createdBy: row.created_by,
        note: row.note,
        title: typeof snap?.title === "string" ? snap.title : "",
      };
    });
}
