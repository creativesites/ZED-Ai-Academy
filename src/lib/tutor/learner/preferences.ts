import { z } from "zod";

// Global learner preferences (learner_preferences, D-17): about the person's device and needs, not tenant
// scoped. Pure. null means "no choice" so existing defaults (network guess, mode policy) still apply.

export type LearnerPreferences = {
  preferredMode: "voice" | "text" | null;
  speechRate: number | null;
  captions: boolean | null;
  dataSaver: boolean | null;
  reducedMotion: boolean | null;
  uiLanguage: string | null;
};

export const EMPTY_PREFERENCES: LearnerPreferences = {
  preferredMode: null,
  speechRate: null,
  captions: null,
  dataSaver: null,
  reducedMotion: null,
  uiLanguage: null,
};

/** A partial update from the learner. Unknown keys are rejected. */
export const preferencesPatchSchema = z
  .object({
    preferredMode: z.enum(["voice", "text"]).nullable(),
    speechRate: z.number().min(0.5).max(2).nullable(),
    captions: z.boolean().nullable(),
    dataSaver: z.boolean().nullable(),
    reducedMotion: z.boolean().nullable(),
    uiLanguage: z
      .string()
      .trim()
      .regex(/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})?$/, "Use a language code like en or en-ZM")
      .nullable(),
  })
  .partial()
  .strict();

export type PreferencesPatch = z.infer<typeof preferencesPatchSchema>;

export function preferencesFromRow(row: Record<string, unknown> | null | undefined): LearnerPreferences {
  if (!row) return { ...EMPTY_PREFERENCES };
  const bool = (v: unknown) => (typeof v === "boolean" ? v : null);
  const rate = Number(row.speech_rate);
  return {
    preferredMode: row.preferred_mode === "voice" || row.preferred_mode === "text" ? row.preferred_mode : null,
    speechRate: row.speech_rate != null && Number.isFinite(rate) ? rate : null,
    captions: bool(row.captions),
    dataSaver: bool(row.data_saver),
    reducedMotion: bool(row.reduced_motion),
    uiLanguage: typeof row.ui_language === "string" && row.ui_language ? row.ui_language : null,
  };
}

/** DB columns for a validated patch (only the keys present). */
export function preferencesPatchToRow(patch: PreferencesPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if ("preferredMode" in patch) row.preferred_mode = patch.preferredMode;
  if ("speechRate" in patch) row.speech_rate = patch.speechRate;
  if ("captions" in patch) row.captions = patch.captions;
  if ("dataSaver" in patch) row.data_saver = patch.dataSaver;
  if ("reducedMotion" in patch) row.reduced_motion = patch.reducedMotion;
  if ("uiLanguage" in patch) row.ui_language = patch.uiLanguage;
  return row;
}

/**
 * The mode hint for a session start: the client's explicit hint (mic denied, Lite) wins; otherwise the
 * learner's saved account preference; otherwise none (the server's mode policy decides).
 */
export function resolvePreferMode(
  clientHint: "live" | "voice" | "text" | undefined,
  account: LearnerPreferences | null,
): "live" | "voice" | "text" | undefined {
  if (clientHint) return clientHint;
  return account?.preferredMode ?? undefined;
}
