import { test } from "node:test";
import assert from "node:assert/strict";
import { finalizeSessionCore, type FinalizeCoreDeps, type ProfileState } from "./finalize.ts";
import { parseMemory } from "./memory.ts";
import type { LearnerMistake } from "./report-model.ts";

// P1-07 additions to finalize: mistakes go to learner_memories (legacy memory frozen) and habits are per person.

const REPORT_JSON = JSON.stringify({
  scores: { task: 80 },
  strengths: [],
  mistakes: [{ said: "goed", correct: "went", category: "grammar" }],
  nextStep: "Practise past tense.",
});

const LEGACY: ProfileState = {
  level_estimate: null,
  framework: null,
  can_do: [],
  memory: { recentMistakes: [{ said: "a", correct: "b", category: "c" }], notes: [] },
  streak_days: 3,
  last_practice_date: "2026-11-24",
  total_speaking_ms: 0,
};

function run(opts: { memoriesStored: boolean | "throw" }) {
  const calls = { memories: [] as LearnerMistake[][], habits: [] as { today: string; practiceMs: number }[], errors: [] as string[] };
  let saved: ProfileState = LEGACY;
  const deps: FinalizeCoreDeps<{ id: string }> = {
    getReport: async () => null,
    updateSession: async () => {},
    generateReport: async () => ({ text: REPORT_JSON, model: "m" }),
    claimReport: async () => ({ created: true, report: { id: "r" } }),
    recordUsage: async () => {},
    loadProfile: async () => LEGACY,
    saveProfile: async (row) => {
      saved = { ...row } as ProfileState;
    },
    addMistakeVocabulary: async () => {},
    saveMisconceptionMemories: async (m) => {
      calls.memories.push(m);
      if (opts.memoriesStored === "throw") throw new Error("boom");
      return opts.memoriesStored;
    },
    recordHabits: async (h) => {
      calls.habits.push(h);
    },
    onSideEffectError: (step) => calls.errors.push(step),
  };
  return {
    calls,
    deps,
    saved: () => saved,
  };
}

const INPUT = {
  mode: "text" as const,
  currentStatus: "active" as const,
  requestedStatus: "completed" as const,
  learnerSpeakingMs: 1000,
  teacherSpeakingMs: 2000,
  turns: [{ learner_text: "I goed home", events: [] }],
  scenarioTitle: "t",
  scenarioGoal: "g",
  skillLanguage: null,
  profileLanguage: "en",
  liveModel: "live",
  today: "2026-11-25",
};

test("mistakes stored as memories leave the legacy recentMistakes unchanged", async () => {
  const r = run({ memoriesStored: true });
  await finalizeSessionCore(INPUT, r.deps);
  assert.equal(r.calls.memories.length, 1);
  assert.equal(r.calls.memories[0][0].correct, "went");
  assert.deepEqual(parseMemory(r.saved()?.memory).recentMistakes, [{ said: "a", correct: "b", category: "c" }]);
});

test("schema unavailable (false) or failure keeps today's legacy write", async () => {
  for (const mode of [false, "throw"] as const) {
    const r = run({ memoriesStored: mode });
    await finalizeSessionCore(INPUT, r.deps);
    const recent = parseMemory(r.saved()?.memory).recentMistakes;
    assert.equal(recent[0].correct, "went");
    assert.equal(recent.length, 2);
    if (mode === "throw") assert.deepEqual(r.calls.errors, ["memories"]);
  }
});

test("habits are recorded once with the session's calendar day and time", async () => {
  const r = run({ memoriesStored: true });
  await finalizeSessionCore(INPUT, r.deps);
  assert.deepEqual(r.calls.habits, [{ today: "2026-11-25", practiceMs: 3000 }]);
});

test("habits run before the legacy profile write (first habit row is seeded from pre-session streaks)", async () => {
  const order: string[] = [];
  const r = run({ memoriesStored: true });
  const deps = {
    ...r.deps,
    recordHabits: async () => {
      order.push("habits");
    },
    saveProfile: async () => {
      order.push("profile");
    },
  };
  await finalizeSessionCore(INPUT, deps);
  assert.deepEqual(order, ["habits", "profile"]);
});
