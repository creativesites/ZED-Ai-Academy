import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { isSchemaUnavailableError } from "@/lib/tutor/mastery/server";
import {
  parseSnapshot,
  planSaveVersion,
  planSessionPin,
  snapshotFromScenarioRow,
  summarizeVersions,
  type ScenarioSnapshot,
  type ScenarioVersionSummary,
} from "./versions.ts";

// DB glue for flow versioning (P1-04). Callers authorise first; these helpers take the service client.
// Every function degrades to "no versioning" (null / false) when migration 20261125000101 is not applied.

type Db = SupabaseClient<Database>;

const UNIQUE_VIOLATION = "23505";

async function latestVersion(
  db: Db,
  scenarioId: string,
): Promise<{ available: boolean; latest: { version: number; snapshot: ScenarioSnapshot | null } | null }> {
  const { data, error } = await db
    .from("practice_scenario_versions")
    .select("version, snapshot")
    .eq("scenario_id", scenarioId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (!isSchemaUnavailableError(error)) console.warn("[tutor/versions] could not read versions:", error.message);
    return { available: false, latest: null };
  }
  return { available: true, latest: data ? { version: data.version, snapshot: parseSnapshot(data.snapshot) } : null };
}

/**
 * Snapshots a saved scenario row as its newest version (or reuses the latest when the content is unchanged) and
 * publishes it. Returns the published version, or null when versioning is unavailable or the write failed; the
 * save itself has already succeeded, so failures here are logged, not thrown.
 */
export async function recordScenarioVersion(
  db: Db,
  input: { row: Record<string, unknown>; userId: string | null; note?: string | null; forceNew?: boolean },
): Promise<number | null> {
  const scenarioId = String(input.row.id ?? "");
  if (!scenarioId) return null;
  const snapshot = snapshotFromScenarioRow(input.row);

  for (let attempt = 0; attempt < 2; attempt++) {
    const { available, latest } = await latestVersion(db, scenarioId);
    if (!available) return null;
    const plan = planSaveVersion({ snapshot, latest, forceNew: input.forceNew });
    if (plan.action === "create") {
      const { error } = await db.from("practice_scenario_versions").insert({
        scenario_id: scenarioId,
        version: plan.version,
        snapshot: snapshot as unknown as Json,
        created_by: input.userId,
        note: input.note ?? null,
      });
      if (error) {
        // A concurrent save took this number: re-read and try once more.
        if (error.code === UNIQUE_VIOLATION && attempt === 0) continue;
        if (!isSchemaUnavailableError(error)) console.warn("[tutor/versions] could not save version:", error.message);
        return null;
      }
    }
    const { error: publishError } = await db
      .from("practice_scenarios")
      .update({ published_version: plan.version })
      .eq("id", scenarioId);
    if (publishError) {
      if (!isSchemaUnavailableError(publishError)) {
        console.warn("[tutor/versions] could not publish version:", publishError.message);
      }
      return null;
    }
    return plan.version;
  }
  return null;
}

/**
 * The version a new session on this scenario pins. Creates v1 lazily for a flow saved before versioning existed.
 * Returns null when versioning is unavailable (the session then runs the live row, as before).
 */
export async function pinScenarioVersion(db: Db, scenarioId: string): Promise<number | null> {
  const { data, error } = await db.from("practice_scenarios").select("*").eq("id", scenarioId).maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as Record<string, unknown>;
  const plan = planSessionPin({
    versioningAvailable: "published_version" in row,
    publishedVersion: row.published_version as number | null | undefined,
  });
  if (plan.action === "none") return null;
  if (plan.action === "pin") return plan.version;
  return recordScenarioVersion(db, {
    row,
    userId: (row.created_by as string | null) ?? null,
    note: "Initial version",
  });
}

/** The pinned snapshot for a session, or null (unversioned session, missing row, or no migration). */
export async function loadScenarioSnapshot(
  db: Db,
  scenarioId: string,
  version: number | null | undefined,
): Promise<ScenarioSnapshot | null> {
  if (typeof version !== "number") return null;
  const { data, error } = await db
    .from("practice_scenario_versions")
    .select("snapshot")
    .eq("scenario_id", scenarioId)
    .eq("version", version)
    .maybeSingle();
  if (error) {
    if (!isSchemaUnavailableError(error)) console.warn("[tutor/versions] could not load snapshot:", error.message);
    return null;
  }
  return data ? parseSnapshot(data.snapshot) : null;
}

export async function loadScenarioVersions(
  db: Db,
  scenarioId: string,
): Promise<{ available: boolean; rows: { version: number; snapshot: unknown; created_at: string; created_by: string | null; note: string | null }[] }> {
  const { data, error } = await db
    .from("practice_scenario_versions")
    .select("version, snapshot, created_at, created_by, note")
    .eq("scenario_id", scenarioId)
    .order("version", { ascending: false });
  if (error) {
    if (!isSchemaUnavailableError(error)) throw new Error(error.message);
    return { available: false, rows: [] };
  }
  return { available: true, rows: data ?? [] };
}

export async function listScenarioVersionSummaries(
  db: Db,
  scenarioId: string,
): Promise<{ available: boolean; publishedVersion: number | null; versions: ScenarioVersionSummary[] }> {
  const [{ available, rows }, scenario] = await Promise.all([
    loadScenarioVersions(db, scenarioId),
    db.from("practice_scenarios").select("*").eq("id", scenarioId).maybeSingle(),
  ]);
  const published = (scenario.data as unknown as { published_version?: number | null } | null)?.published_version;
  return { available, publishedVersion: typeof published === "number" ? published : null, versions: summarizeVersions(rows) };
}

/**
 * Soft delete: sets archived_at and status 'archived' (learner pickers only show published/draft flows).
 * Returns false when the archived_at column does not exist yet, so the caller can fall back to a hard delete.
 */
export async function archiveScenario(db: Db, input: { scenarioId: string; companyId: string }): Promise<boolean> {
  const { error } = await db
    .from("practice_scenarios")
    .update({ archived_at: new Date().toISOString(), status: "archived" })
    .eq("id", input.scenarioId)
    .eq("company_id", input.companyId);
  if (!error) return true;
  if (isSchemaUnavailableError(error)) return false;
  throw new Error(error.message);
}

/**
 * Runs a scenario list query hiding soft-deleted flows; reruns it unfiltered when archived_at does not exist yet.
 */
export async function withoutArchived<T>(
  run: (hideArchived: boolean) => PromiseLike<{ data: T | null; error: { code?: string; message: string } | null }>,
): Promise<{ data: T | null; error: { code?: string; message: string } | null }> {
  const first = await run(true);
  if (first.error && isSchemaUnavailableError(first.error)) return run(false);
  return first;
}
