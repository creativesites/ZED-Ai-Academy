// Pronunciation glossary helpers for TTS: captions keep real spelling while TTS receives
// phonetic overrides (e.g. ZRA -> "Z R A", Kwacha -> "Kwah-chah", Mwila -> "Mwee-lah").
// Pure: no I/O or "@/" imports so node:test runs it directly.

export type PronunciationEntry = {
  term: string;
  spoken: string;
};

export const MAX_GLOSSARY_ENTRIES = 30;

/**
 * Parses lines like `ZRA = Z R A` or `Kwacha: Kwah-chah` (or JSON array) into validated entries.
 */
export function parsePronunciationGlossary(raw: unknown): PronunciationEntry[] {
  if (Array.isArray(raw)) {
    const out: PronunciationEntry[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const term = String((item as { term?: unknown }).term ?? "").trim().slice(0, 60);
      const spoken = String((item as { spoken?: unknown }).spoken ?? "").trim().slice(0, 80);
      if (term && spoken) out.push({ term, spoken });
      if (out.length >= MAX_GLOSSARY_ENTRIES) break;
    }
    return out;
  }

  if (typeof raw === "string") {
    const out: PronunciationEntry[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const cleaned = line.trim();
      if (!cleaned || cleaned.startsWith("#")) continue;
      const m = /^(.+?)\s*(?:=|->|=>|:)\s*(.+)$/.exec(cleaned);
      if (!m) continue;
      const term = m[1].trim().slice(0, 60);
      const spoken = m[2].trim().slice(0, 80);
      if (term && spoken) out.push({ term, spoken });
      if (out.length >= MAX_GLOSSARY_ENTRIES) break;
    }
    return out;
  }

  return [];
}

/** Formats glossary entries as editable `term = spoken` lines for Persona Studio. */
export function formatPronunciationGlossary(entries: ReadonlyArray<PronunciationEntry>): string {
  return entries.map((e) => `${e.term} = ${e.spoken}`).join("\n");
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Applies whole-word case-insensitive pronunciation substitutions to TTS text only.
 * Longest terms are replaced first so multi-word names win over single-word substrings.
 */
export function applyPronunciationGlossary(
  text: string,
  entries: ReadonlyArray<PronunciationEntry> | null | undefined,
): string {
  if (!text || !entries || entries.length === 0) return text;
  const sorted = [...entries]
    .filter((e) => e.term.trim().length > 0 && e.spoken.trim().length > 0)
    .sort((a, b) => b.term.length - a.term.length);

  let out = text;
  for (const { term, spoken } of sorted) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term.trim())}(?![\\p{L}\\p{N}])`, "giu");
    out = out.replace(re, spoken.trim());
  }
  return out;
}
