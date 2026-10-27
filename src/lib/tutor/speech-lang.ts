// Picks a BCP 47 language for the browser speech fallback (speechSynthesis) from one teacher line.
// Pure, so node:test can run it. Teachers mix the target language with English, so each line is
// checked on its own: Han characters are Mandarin, and Spanish or French lines are recognised by
// their letters and common words. Anything else is read in English.

export type SpeechLang = "zh-CN" | "es-ES" | "fr-FR" | "en-GB";

const HAN = /[㐀-鿿豈-﫿]/;
const ES_LETTERS = /[ñ¿¡]/i;
const FR_LETTERS = /[çœàâèêëîïôùûÿ]/i;
const ES_WORDS = /\b(hola|gracias|por favor|buenos|buenas|quiero|quieres|cuánto|cuesta|café|leche|muy|bien|sí|usted|señor|señora|vale|perfecto|adiós|un|una|con|el|la|los|las|de|es|está)\b/i;
const FR_WORDS = /\b(bonjour|merci|s'il|vous|plaît|je|voudrais|une|un|baguette|croissant|très|bien|oui|non|au revoir|c'est|combien|madame|monsieur|parfait|le|la|les|de|du|et)\b/i;
const EN_WORDS = /\b(the|you|your|and|is|are|what|how|try|again|good|great|say|let's|now|this|that|with|for)\b/gi;

function countMatches(text: string, re: RegExp): number {
  return (text.match(new RegExp(re.source, "gi")) ?? []).length;
}

/**
 * The language to read `text` in. `target` is the session's language (the persona's first
 * language: "zh", "es", "fr" or "en").
 */
export function speechLangFor(text: string, target: string | null | undefined): SpeechLang {
  if (HAN.test(text)) return "zh-CN";
  const english = countMatches(text, EN_WORDS);
  if (target === "es") {
    const spanish = countMatches(text, ES_WORDS) + (ES_LETTERS.test(text) ? 2 : 0);
    return spanish > 0 && spanish >= english ? "es-ES" : "en-GB";
  }
  if (target === "fr") {
    const french = countMatches(text, FR_WORDS) + (FR_LETTERS.test(text) ? 2 : 0);
    return french > 0 && french >= english ? "fr-FR" : "en-GB";
  }
  return "en-GB";
}

/** Best voice for a language from the browser's list: exact match first, then the same base language. */
export function pickVoice<V extends { lang: string; localService?: boolean }>(voices: readonly V[], lang: SpeechLang): V | undefined {
  const norm = (l: string) => l.replace("_", "-").toLowerCase();
  const want = lang.toLowerCase();
  const base = want.split("-")[0];
  const exact = voices.filter((v) => norm(v.lang) === want);
  const sameBase = voices.filter((v) => norm(v.lang).split("-")[0] === base);
  // Prefer network voices (usually more natural) over local ones when both exist.
  const best = (list: V[]) => list.find((v) => v.localService === false) ?? list[0];
  return best(exact) ?? best(sameBase);
}
