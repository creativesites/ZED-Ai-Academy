// Teaching strategies as data (P2-05, Architecture §5). Pure: no I/O, no "@/" imports.
//
// The policy (policy.ts) picks a strategy and a move each turn; strategies shape which moves are allowed and how
// generous hints are. Each strategy has a short prompt fragment; all fragments for the session's pack go in the
// cached system prompt so switching strategy mid-session never changes the cached prefix.

export const MOVES = [
  "probe",
  "explain",
  "worked_example",
  "demonstrate",
  "hint",
  "simplify",
  "check",
  "prerequisite",
  "stretch",
  "independent_task",
  "redirect",
  "recap",
  "wrap_up",
] as const;
export type Move = (typeof MOVES)[number];

export const STRATEGY_IDS = [
  "probe",
  "guided",
  "socratic",
  "worked_example",
  "demonstration",
  "conversational",
  "problem_based",
  "role_play",
  "exam_prep",
  "retrieval",
  "viva",
] as const;
export type StrategyId = (typeof STRATEGY_IDS)[number];

export type Strategy = {
  id: StrategyId;
  label: string;
  /** Moves the policy may recommend under this strategy (recap/wrap_up/redirect are always allowed). */
  moves: readonly Move[];
  /** Hints before the teacher may reveal the answer. 0 = never hint (viva). */
  maxHints: number;
  /** Aim for a check at least every N learner turns while teaching. */
  checkEvery: number;
  /** Target spoken words per teacher turn. */
  wordsPerTurn: number;
  /** ≤150-token prompt fragment, in the cached prefix. */
  prompt: string;
};

const ALWAYS: readonly Move[] = ["recap", "wrap_up", "redirect"];

export const STRATEGIES: Record<StrategyId, Strategy> = {
  probe: {
    id: "probe",
    label: "Probe / diagnose",
    moves: ["probe", "check", "explain"],
    maxHints: 1,
    checkEvery: 1,
    wordsPerTurn: 35,
    prompt: "Probe: find out what the learner already knows with one short question before teaching.",
  },
  guided: {
    id: "guided",
    label: "Guided instruction",
    moves: ["probe", "explain", "check", "hint", "simplify", "worked_example", "demonstrate", "prerequisite"],
    maxHints: 2,
    checkEvery: 2,
    wordsPerTurn: 50,
    prompt: "Guided: explain one small idea with a concrete example, then check it with a quick question.",
  },
  socratic: {
    id: "socratic",
    label: "Socratic",
    moves: ["probe", "hint", "check", "stretch"],
    maxHints: 3,
    checkEvery: 1,
    wordsPerTurn: 35,
    prompt: "Socratic: lead with questions; let the learner reason it out; give a hint rather than the answer.",
  },
  worked_example: {
    id: "worked_example",
    label: "Worked example → faded",
    moves: ["worked_example", "check", "hint", "independent_task"],
    maxHints: 2,
    checkEvery: 2,
    wordsPerTurn: 60,
    prompt:
      "Worked example: show a full solution step by step on the board, then a similar one with steps missing for the learner, then one on their own.",
  },
  demonstration: {
    id: "demonstration",
    label: "Demonstration",
    moves: ["demonstrate", "check", "hint", "independent_task"],
    maxHints: 2,
    checkEvery: 2,
    wordsPerTurn: 45,
    prompt: "Demonstration: show how it is done (board, clip), then ask the learner to try the same.",
  },
  conversational: {
    id: "conversational",
    label: "Conversational",
    moves: ["explain", "check", "simplify"],
    maxHints: 2,
    checkEvery: 4,
    wordsPerTurn: 60,
    prompt: "Conversational: answer the learner's question briefly and clearly, then offer a quick check.",
  },
  problem_based: {
    id: "problem_based",
    label: "Problem-based",
    moves: ["independent_task", "hint", "check", "stretch"],
    maxHints: 2,
    checkEvery: 3,
    wordsPerTurn: 40,
    prompt: "Problem-based: set a realistic task, let the learner work, give hints only when asked or stuck.",
  },
  role_play: {
    id: "role_play",
    label: "Role-play / simulation",
    moves: ["demonstrate", "check", "hint"],
    maxHints: 2,
    checkEvery: 3,
    wordsPerTurn: 35,
    prompt: "Role-play: stay in character for the scenario; step out briefly to correct or debrief.",
  },
  exam_prep: {
    id: "exam_prep",
    label: "Exam preparation",
    moves: ["check", "worked_example", "hint", "stretch"],
    maxHints: 1,
    checkEvery: 1,
    wordsPerTurn: 40,
    prompt: "Exam prep: ask exam-style questions, then give mark-scheme feedback on the answer.",
  },
  retrieval: {
    id: "retrieval",
    label: "Retrieval / spaced revision",
    moves: ["check", "hint", "explain", "worked_example"],
    maxHints: 1,
    checkEvery: 1,
    wordsPerTurn: 35,
    prompt: "Retrieval: ask the learner to recall first; explain only after their attempt.",
  },
  viva: {
    id: "viva",
    label: "Oral check (viva)",
    moves: ["probe", "check"],
    maxHints: 0,
    checkEvery: 1,
    wordsPerTurn: 30,
    prompt: "Viva: ask open questions and follow-ups. Do not teach or hint.",
  },
};

export function isMoveAllowed(strategy: StrategyId, move: Move): boolean {
  return ALWAYS.includes(move) || STRATEGIES[strategy].moves.includes(move);
}

/** Persona teaching philosophy (P2-05): optional, biases the policy. Stored on ai_personas.teaching_philosophy. */
export type TeachingPhilosophy = {
  defaultStrategy?: StrategyId;
  /** low: fewer hints before revealing; high: more. */
  hintGenerosity?: "low" | "normal" | "high";
  /** strict: a partial answer is not enough to move on. */
  strictness?: "lenient" | "normal" | "strict";
  /** Free text, e.g. "English with Bemba support". Prompt only. */
  languageMix?: string;
  formality?: "casual" | "neutral" | "formal";
};

const PHILOSOPHY_ENUMS = {
  hintGenerosity: ["low", "normal", "high"],
  strictness: ["lenient", "normal", "strict"],
  formality: ["casual", "neutral", "formal"],
} as const;

/** Parses the persona jsonb leniently: unknown keys and bad values are dropped. */
export function parseTeachingPhilosophy(raw: unknown): TeachingPhilosophy {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const out: TeachingPhilosophy = {};
  if (typeof r.defaultStrategy === "string" && (STRATEGY_IDS as readonly string[]).includes(r.defaultStrategy)) {
    out.defaultStrategy = r.defaultStrategy as StrategyId;
  }
  for (const key of Object.keys(PHILOSOPHY_ENUMS) as (keyof typeof PHILOSOPHY_ENUMS)[]) {
    const v = r[key];
    if (typeof v === "string" && (PHILOSOPHY_ENUMS[key] as readonly string[]).includes(v)) {
      (out as Record<string, string>)[key] = v;
    }
  }
  if (typeof r.languageMix === "string" && r.languageMix.trim()) {
    out.languageMix = r.languageMix.replace(/[<>{}`]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
  }
  return out;
}

/** Hints allowed before revealing, after the persona's generosity bias. */
export function maxHintsFor(strategy: StrategyId, philosophy: TeachingPhilosophy = {}): number {
  const base = STRATEGIES[strategy].maxHints;
  if (base === 0) return 0;
  if (philosophy.hintGenerosity === "low") return Math.max(1, base - 1);
  if (philosophy.hintGenerosity === "high") return base + 1;
  return base;
}

export type StrategyContext = {
  origin: string | null | undefined;
  skillPack: string | null | undefined;
  /** Flow style (practice_scenarios.style), e.g. guided_lesson, roleplay, exam. */
  style?: string | null;
  /** Learner level estimate (free text, e.g. "beginner", "A1"). */
  level?: string | null;
  philosophy?: TeachingPhilosophy;
};

const BEGINNER_RE = /\b(beginner|novice|a1|a2|starter|intro)/i;

/** The session's starting strategy. Origin wins, then flow style, then the persona default, then the learner level. */
export function chooseBaseStrategy(ctx: StrategyContext): StrategyId {
  const origin = ctx.origin ?? "";
  if (origin === "viva") return "viva";
  if (origin === "revision") return "retrieval";
  if (origin === "ask") return "conversational";
  const style = (ctx.style ?? "").toLowerCase();
  if (/role ?play|simulation/.test(style)) return "role_play";
  if (/exam/.test(style)) return "exam_prep";
  if (ctx.philosophy?.defaultStrategy) return ctx.philosophy.defaultStrategy;
  if ((ctx.skillPack ?? "").startsWith("language-")) return "role_play";
  // Objectives start unseen, so guided instruction; the policy moves a confident, practising learner to socratic.
  return "guided";
}

export function isBeginnerLevel(level: string | null | undefined): boolean {
  return !!level && BEGINNER_RE.test(level);
}

/** Prompt block listing every strategy a pack may use (cached prefix). */
export function strategyPromptBlock(ctx: Pick<StrategyContext, "origin" | "skillPack" | "philosophy">): string {
  const ids: StrategyId[] =
    ctx.origin === "viva"
      ? ["viva"]
      : ["probe", "guided", "socratic", "worked_example", "demonstration", "conversational", "problem_based", "retrieval"];
  if ((ctx.skillPack ?? "").startsWith("language-")) ids.push("role_play");
  const lines = ids.map((id) => `- ${STRATEGIES[id].prompt}`);
  const p = ctx.philosophy ?? {};
  const persona: string[] = [];
  if (p.formality) persona.push(`formality: ${p.formality}`);
  if (p.strictness) persona.push(`strictness on partial answers: ${p.strictness}`);
  if (p.hintGenerosity) persona.push(`hint generosity: ${p.hintGenerosity}`);
  if (p.languageMix) persona.push(`language mix: ${p.languageMix}`);
  return [
    "Teaching strategies you may be asked to use (a teacher note names the move for this turn):",
    ...lines,
    ...(persona.length ? [`Teaching style settings: ${persona.join("; ")}.`] : []),
  ].join("\n");
}
