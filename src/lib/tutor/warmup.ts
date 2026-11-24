// Personalized "Warm-Up from Last Time" helper.
// Uses the learner's recent mistakes or memory notes to kick off the opening 20 seconds
// with continuity, without derailing the current scenario.

export type WarmupSource = {
  recentMistakes: Array<{ said: string; correct: string; category: string }>;
  memoryNotes: string[];
};

export type WarmupSuggestion = {
  label: string;
  detail: string;
};

/** Picks one concise warm-up point from learner memory, or null for first-time learners. */
export function pickWarmupSuggestion(source: WarmupSource): WarmupSuggestion | null {
  const latestMistake = source.recentMistakes[0];
  if (latestMistake && latestMistake.correct.trim()) {
    const cat = latestMistake.category ? ` (${latestMistake.category})` : "";
    return {
      label: `Quick revisit${cat}`,
      detail: latestMistake.said.trim()
        ? `Instead of “${latestMistake.said.trim()}”, try “${latestMistake.correct.trim()}”`
        : `Focus on: “${latestMistake.correct.trim()}”`,
    };
  }

  const latestNote = source.memoryNotes.find((n) => n.trim().length > 0);
  if (latestNote) {
    return {
      label: "From your last session",
      detail: latestNote.trim(),
    };
  }

  return null;
}

/** Enriches the opening turn instruction with a brief warm-up cue when learner memory exists. */
export function buildOpeningWithWarmup(baseInstruction: string, source: WarmupSource): string {
  const suggestion = pickWarmupSuggestion(source);
  if (!suggestion) return baseInstruction;
  return `${baseInstruction} Before diving in, weave a super-brief 1-sentence warm-up callback referencing: ${suggestion.detail}. Keep it encouraging and move swiftly into step 1.`;
}
