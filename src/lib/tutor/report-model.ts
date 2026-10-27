import { z } from "zod";
import { tutorEventSchema } from "./events.ts";

// Pure parts of the post-session report: the model output schema, parsing, mistake collection and
// transcript building. The model call and the database writes live in server/report.ts.

export const REPORT_SCORE_KEYS = ["fluency", "accuracy", "vocabulary", "pronunciation", "task"] as const;
export type ReportScoreKey = (typeof REPORT_SCORE_KEYS)[number];

export const MAX_REPORT_MISTAKES = 20;

const scoreSchema = z.number().min(0).max(100).transform((n) => Math.round(n));

export const tutorReportSchema = z.object({
  scores: z.object({
    fluency: scoreSchema.optional(),
    accuracy: scoreSchema.optional(),
    vocabulary: scoreSchema.optional(),
    pronunciation: scoreSchema.optional(),
    task: scoreSchema.optional(),
  }),
  strengths: z.array(z.string().min(1)).max(5),
  mistakes: z
    .array(
      z.object({
        said: z.string(),
        correct: z.string().min(1),
        category: z.string().min(1),
        note: z.string().optional(),
      }),
    )
    .max(MAX_REPORT_MISTAKES),
  nextStep: z.string().min(1).max(500),
});

export type TutorReportContent = z.infer<typeof tutorReportSchema>;

/** Gemini structured output schema for the report. Scores are guidance only. */
export const REPORT_JSON_SCHEMA = {
  type: "object",
  properties: {
    scores: {
      type: "object",
      description: "Guidance scores from 0 to 100. Omit a score when the transcript does not show it.",
      properties: Object.fromEntries(
        REPORT_SCORE_KEYS.map((key) => [key, { type: "integer", minimum: 0, maximum: 100 }]),
      ),
    },
    strengths: { type: "array", items: { type: "string" }, maxItems: 5 },
    mistakes: {
      type: "array",
      maxItems: MAX_REPORT_MISTAKES,
      items: {
        type: "object",
        properties: {
          said: { type: "string" },
          correct: { type: "string" },
          category: { type: "string" },
          note: { type: "string" },
        },
        required: ["said", "correct", "category"],
      },
    },
    nextStep: { type: "string" },
  },
  required: ["scores", "strengths", "mistakes", "nextStep"],
} as const;

export const REPORT_SYSTEM_PROMPT = `You write a short, encouraging post-session report for a learner who practised speaking with an AI teacher.
- Base everything on the transcript. Do not invent speech the learner did not produce.
- Scores (0-100) are guidance only: fluency, accuracy, vocabulary, pronunciation, task (did they complete the scenario goal). Omit pronunciation when there is no audio evidence in the transcript.
- Strengths: up to 3 specific things the learner did well.
- Mistakes: the most useful errors (up to 20), each with what they said, the correct form, and a category (tone, pronunciation, vocabulary, grammar, word_order, politeness).
- nextStep: one concrete thing to practise next.
Return only JSON matching the schema.`;

export type ParsedReport = { ok: true; report: TutorReportContent } | { ok: false; error: string };

/** Parses the model's JSON text. Never throws. */
export function parseTutorReport(text: string | undefined): ParsedReport {
  if (!text) return { ok: false, error: "empty report" };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "report is not valid JSON" };
  }
  const parsed = tutorReportSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid report" };
  return { ok: true, report: parsed.data };
}

export type LearnerMistake = { said: string; correct: string; category: string };

export type StoredTurn = { learner_text: string | null; events: unknown };

/**
 * Mistakes from `note_mistake` events across all turns, de-duplicated on (said, correct), capped.
 * Invalid stored events are skipped.
 */
export function collectNoteMistakes(turns: StoredTurn[], limit = MAX_REPORT_MISTAKES): LearnerMistake[] {
  const seen = new Set<string>();
  const out: LearnerMistake[] = [];
  for (const turn of turns) {
    for (const raw of Array.isArray(turn.events) ? turn.events : []) {
      const parsed = tutorEventSchema.safeParse(raw);
      if (!parsed.success || parsed.data.type !== "note_mistake") continue;
      const { said, correct, category } = parsed.data;
      const key = `${said}\u0000${correct}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ said, correct, category });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** True when the learner produced any text or transcribed speech. */
export function hasLearnerSpeech(turns: StoredTurn[]): boolean {
  return turns.some((turn) => typeof turn.learner_text === "string" && turn.learner_text.trim().length > 0);
}

/**
 * "Learner: ... / Teacher: ..." transcript of the session, keeping the most recent `maxChars`.
 */
export function buildTranscript(turns: StoredTurn[], maxChars = 12_000): string {
  const lines: string[] = [];
  for (const turn of turns) {
    if (turn.learner_text && turn.learner_text.trim()) lines.push(`Learner: ${turn.learner_text.trim()}`);
    for (const raw of Array.isArray(turn.events) ? turn.events : []) {
      const parsed = tutorEventSchema.safeParse(raw);
      if (parsed.success && parsed.data.type === "say") lines.push(`Teacher: ${parsed.data.text}`);
    }
  }
  const full = lines.join("\n");
  return full.length <= maxChars ? full : full.slice(full.length - maxChars);
}

/**
 * Tone statistics for Mandarin sessions, from mistakes categorised as tone. Empty for other languages.
 */
export function toneStats(language: string | null, mistakes: LearnerMistake[]): Record<string, number> {
  if (language !== "zh") return {};
  const toneMistakes = mistakes.filter((m) => m.category.toLowerCase().includes("tone")).length;
  return { toneMistakes, totalMistakes: mistakes.length };
}
