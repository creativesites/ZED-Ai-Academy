// Which teacher reads a vocabulary card aloud, chosen by the card's language. Teachers are named by their
// persona preset key (never by position in a preset array, which silently changes the character when the
// array is reordered) and carry the same TTS voice as their persona row, so a teacher sounds the same in the
// deck, the session and the lesson dock.

export type DeckTeacherKey = "tinashe" | "lin" | "sofia" | "camille" | "mwila" | "banda" | "chanda";

export type DeckTeacher = {
  /** Persona preset key (see components/tutor/avatar/persona-presets.ts). */
  presetKey: DeckTeacherKey;
  /** Gemini TTS voice for /api/tutor/tts. */
  voice: string;
};

/** The platform default teacher (Tinashe) and its voice, as seeded in ai_personas. */
export const DEFAULT_DECK_TEACHER: DeckTeacher = { presetKey: "tinashe", voice: "Puck" };

const BY_LANGUAGE: Readonly<Record<string, DeckTeacher>> = {
  en: DEFAULT_DECK_TEACHER,
  zh: { presetKey: "lin", voice: "Kore" },
  es: { presetKey: "sofia", voice: "Aoede" },
  fr: { presetKey: "camille", voice: "Leda" },
  bem: { presetKey: "mwila", voice: "Kore" },
  ny: { presetKey: "banda", voice: "Charon" },
  tog: { presetKey: "chanda", voice: "Fenrir" },
};

/** The teacher for a card language ("zh", "es", ...). Unknown or empty languages get the default teacher. */
export function deckTeacherFor(language: string | null | undefined): DeckTeacher {
  const key = (language ?? "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(BY_LANGUAGE, key) ? BY_LANGUAGE[key] : DEFAULT_DECK_TEACHER;
}
