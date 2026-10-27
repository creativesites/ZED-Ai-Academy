// Shape of learner_language_profiles.memory: recent mistakes and free-text notes for the teacher.
// Pure. Unknown or malformed stored values parse to empty memory instead of throwing.

export type LearnerMemory = {
  recentMistakes: { said: string; correct: string; category: string }[];
  notes: string[];
};

export function parseMemory(raw: unknown): LearnerMemory {
  const obj = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const recentMistakes = Array.isArray(obj.recentMistakes)
    ? obj.recentMistakes.flatMap((m) => {
        if (typeof m !== "object" || m === null) return [];
        const r = m as Record<string, unknown>;
        return typeof r.said === "string" && typeof r.correct === "string" && typeof r.category === "string"
          ? [{ said: r.said, correct: r.correct, category: r.category }]
          : [];
      })
    : [];
  const notes = Array.isArray(obj.notes) ? obj.notes.filter((n): n is string => typeof n === "string") : [];
  return { recentMistakes, notes };
}
