import "server-only";
import { isSchemaUnavailableError } from "../mastery/server.ts";
import { looseDb, type LooseDb } from "./memory-server.ts";
import {
  preferencesFromRow,
  preferencesPatchToRow,
  type LearnerPreferences,
  type PreferencesPatch,
} from "./preferences.ts";

// learner_preferences glue (P1-07). Not tenant scoped: keyed by the signed-in user only.
// Schema unavailable ⇒ { available: false }, callers keep today's defaults (localStorage, mode policy).

const COLUMNS = "preferred_mode, speech_rate, captions, data_saver, reduced_motion, ui_language";

export async function loadLearnerPreferences(
  userId: string,
  db: LooseDb = looseDb(),
): Promise<{ available: boolean; preferences: LearnerPreferences | null }> {
  try {
    const res = (await db.from("learner_preferences").select(COLUMNS).eq("user_id", userId).maybeSingle()) as {
      data: Record<string, unknown> | null;
      error: { code?: string; message?: string } | null;
    };
    if (res.error) {
      if (!isSchemaUnavailableError(res.error)) console.warn("[tutor/preferences] load failed:", res.error.message);
      return { available: false, preferences: null };
    }
    return { available: true, preferences: res.data ? preferencesFromRow(res.data) : null };
  } catch (err) {
    console.warn("[tutor/preferences] load threw:", err);
    return { available: false, preferences: null };
  }
}

/** Upserts a validated patch. Returns false when the table is not migrated. */
export async function saveLearnerPreferences(userId: string, patch: PreferencesPatch, db: LooseDb = looseDb()): Promise<boolean> {
  const row = preferencesPatchToRow(patch);
  if (Object.keys(row).length === 0) return true;
  const { error } = await db.from("learner_preferences").upsert({ user_id: userId, ...row }, { onConflict: "user_id" });
  if (error) {
    if (isSchemaUnavailableError(error)) return false;
    throw new Error(`could not save preferences: ${error.message}`);
  }
  return true;
}
