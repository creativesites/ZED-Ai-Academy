// Data-saver ("Lite") mode for the AI Teacher. Lite draws the light SVG teacher instead of the Rive
// files and skips the scene and the animated backdrop. The teacher still speaks: voice is the lesson,
// and the learner has a separate mute. Pure helpers here; the hook is in the UI layer.

export const LITE_STORAGE_KEY = "zai.teacher.lite";

/** The parts of navigator.connection (Network Information API) we read. All optional: Safari has none. */
export type ConnectionHints = {
  saveData?: boolean;
  effectiveType?: string;
  type?: string;
};

/**
 * Whether to start in Lite when the learner has not chosen: the browser asks to save data, the link is
 * slow (2g/3g), or the device reports a cellular connection. Unknown connections stay on the full stage.
 */
export function shouldDefaultToLite(hints: ConnectionHints | null | undefined): boolean {
  if (!hints) return false;
  if (hints.saveData === true) return true;
  if (hints.effectiveType && ["slow-2g", "2g", "3g"].includes(hints.effectiveType)) return true;
  if (hints.type === "cellular") return true;
  return false;
}

/**
 * The learner's saved choice on this device wins, then their account preference (learner_preferences.
 * data_saver, P1-07; null/undefined = none), then the network guess. Anything but "1" / "0" counts as no
 * device choice.
 */
export function resolveLite(
  stored: string | null,
  hints: ConnectionHints | null | undefined,
  accountDataSaver?: boolean | null,
): boolean {
  if (stored === "1") return true;
  if (stored === "0") return false;
  if (typeof accountDataSaver === "boolean") return accountDataSaver;
  return shouldDefaultToLite(hints);
}
