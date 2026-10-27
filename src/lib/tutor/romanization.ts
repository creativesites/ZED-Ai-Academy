// Tone-coloured romanization for the captions. Pure, no React.
// Pinyin tone marks are combining diacritics after NFD normalisation:
//   U+0304 macron = tone 1, U+0301 acute = tone 2, U+030C caron = tone 3, U+0300 grave = tone 4.
// The mark detection matches docs/prototypes/speaking-room.html (toneSpans). The prototype colours a
// whole space-separated word by its first mark, which is wrong for "Lǎoshī"; here each syllable is
// split out first, so "shī" gets its own tone. A syllable with no mark is neutral (tone 0).

export type ToneSegment = { text: string; tone: 0 | 1 | 2 | 3 | 4 };

const VOWELS = "aeiouüv";

/** Tone number (1..4) carried by one romanized syllable, or 0 when it has no tone mark. */
export function pinyinToneOf(word: string): 0 | 1 | 2 | 3 | 4 {
  const decomposed = word.normalize("NFD");
  if (decomposed.includes("̄")) return 1;
  if (decomposed.includes("́")) return 2;
  if (decomposed.includes("̌")) return 3;
  if (decomposed.includes("̀")) return 4;
  return 0;
}

function isVowel(ch: string): boolean {
  const base = ch.normalize("NFD")[0]?.toLowerCase() ?? "";
  return VOWELS.includes(base);
}

/**
 * Splits one run of letters into pinyin-like syllables. Each vowel group is a nucleus. The consonants
 * between two nuclei go to the next syllable, except a coda: "n" or "ng" stays with the syllable before
 * (Zhōng-guó, Shàng-hǎi, Nán-jīng). "sh", "zh" and "ch" are single onsets.
 */
function splitSyllables(word: string): string[] {
  const chars = [...word];
  const groups: Array<[number, number]> = [];
  for (let i = 0; i < chars.length; ) {
    if (isVowel(chars[i])) {
      const start = i;
      while (i < chars.length && isVowel(chars[i])) i++;
      groups.push([start, i]);
    } else {
      i++;
    }
  }
  if (groups.length <= 1) return [word];

  const cuts: number[] = [];
  for (let g = 0; g < groups.length - 1; g++) {
    const runStart = groups[g][1];
    const runEnd = groups[g + 1][0];
    const run = chars.slice(runStart, runEnd).join("").toLowerCase();
    let coda = 0;
    if (run.startsWith("ng")) coda = 2;
    else if (run.startsWith("n")) coda = 1;
    else if (run.length === 2 && run[1] === "h") coda = 0;
    else coda = Math.max(0, run.length - 1);
    if (coda > 0 && coda >= run.length) coda = run.length - 1;
    cuts.push(runStart + coda);
  }

  const parts: string[] = [];
  let from = 0;
  for (const cut of cuts) {
    parts.push(chars.slice(from, cut).join(""));
    from = cut;
  }
  parts.push(chars.slice(from).join(""));
  return parts.filter((part) => part.length > 0);
}

/**
 * Splits a romanized line into syllables and separators, each tagged with its tone. Separators
 * (spaces, punctuation, digits) are tone 0 and runs of them are merged. Concatenating the `text`
 * fields gives back the input exactly, so callers can render it as-is.
 */
export function toneSegments(roman: string): ToneSegment[] {
  if (!roman) return [];
  const out: ToneSegment[] = [];
  const pushSeparator = (text: string) => {
    const last = out[out.length - 1];
    if (last && last.tone === 0) last.text += text;
    else out.push({ text, tone: 0 });
  };

  // Combining marks (\p{M}) belong to their letters, so decomposed input splits the same way.
  for (const run of roman.match(/[\p{L}\p{M}]+|[^\p{L}\p{M}]+/gu) ?? []) {
    if (/^[\p{L}\p{M}]/u.test(run)) {
      for (const syllable of splitSyllables(run)) {
        out.push({ text: syllable, tone: pinyinToneOf(syllable) });
      }
    } else {
      pushSeparator(run);
    }
  }
  return out;
}
