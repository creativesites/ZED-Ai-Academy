// Pure response-to-target token comparison used across ALL subjects (key terms,
// concepts, formulas, definitions, and language phrases) to give instant visual feedback.

export type TokenMatch = {
  text: string;
  matched: boolean;
};

export type ResponseMatchResult = {
  score: number; // 0..100
  tokens: TokenMatch[];
  suggestedQuality: "again" | "hard" | "good" | "easy";
};

function normalizeToken(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function tokenize(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  // For CJK scripts without spaces, split per ideograph; otherwise split by whitespace.
  if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(trimmed) && !/\s/.test(trimmed)) {
    return [...trimmed].filter((ch) => /[\p{L}\p{N}]/u.test(ch));
  }
  return trimmed.split(/\s+/).filter(Boolean);
}

/**
 * Compares a learner's spoken or typed reply against an expected target answer/phrase.
 * Returns per-word match flags, a 0..100 coverage score, and a suggested SM-2 rating.
 */
export function compareResponseToTarget(response: string, target: string): ResponseMatchResult {
  const targetTokens = tokenize(target);
  if (targetTokens.length === 0) {
    return { score: 0, tokens: [], suggestedQuality: "again" };
  }

  const responseNorm = new Set(tokenize(response).map(normalizeToken).filter(Boolean));
  const tokens: TokenMatch[] = targetTokens.map((raw) => {
    const norm = normalizeToken(raw);
    const matched = norm.length === 0 ? true : responseNorm.has(norm);
    return { text: raw, matched };
  });

  const scorable = tokens.filter((t) => normalizeToken(t.text).length > 0);
  const matchedCount = scorable.filter((t) => t.matched).length;
  const score = scorable.length > 0 ? Math.round((matchedCount / scorable.length) * 100) : 0;

  const suggestedQuality: ResponseMatchResult["suggestedQuality"] =
    score >= 92 ? "easy" : score >= 75 ? "good" : score >= 45 ? "hard" : "again";

  return { score, tokens, suggestedQuality };
}
