import { test } from "node:test";
import assert from "node:assert/strict";
import {
  finalizeSessionCore,
  mergeMistakes,
  type FinalizeCoreDeps,
  type FinalizeCoreInput,
  type ProfileState,
  type ReportPayload,
  type SessionStatus,
} from "./finalize.ts";
import type { LearnerMistake, StoredTurn } from "./report-model.ts";

type Row = ReportPayload & { id: string };

const TURNS: StoredTurn[] = [
  { learner_text: null, events: [{ type: "say", text: "你好！" }] },
  {
    learner_text: "你号",
    events: [{ type: "note_mistake", said: "你号", correct: "你好", category: "tone" }],
  },
];

const REPORT_JSON = JSON.stringify({
  scores: { fluency: 70, accuracy: 65 },
  strengths: ["Clear greeting"],
  mistakes: [{ said: "谢谢", correct: "谢谢你", category: "vocabulary" }],
  nextStep: "Practise third-tone pairs.",
});

function input(overrides: Partial<FinalizeCoreInput> = {}): FinalizeCoreInput {
  return {
    mode: "live",
    currentStatus: "active" as SessionStatus,
    requestedStatus: "completed",
    learnerSpeakingMs: 61_000,
    teacherSpeakingMs: 30_000,
    turns: TURNS,
    scenarioTitle: "Tea house",
    scenarioGoal: "Greet and order tea.",
    skillLanguage: "zh",
    profileLanguage: "zh",
    liveModel: "gemini-3.8-live",
    today: "2026-10-27",
    ...overrides,
  };
}

type Usage = { kind: string; model: string; units: number; unit: string };

/**
 * In-memory stand-in for tutor_reports, tutor_sessions, learner_language_profiles and usage.
 * `staleRead` makes getReport return null even after a report exists, which simulates two
 * requests that both passed the first check before either one stored the report.
 */
function makeStore(options: { staleRead?: boolean; modelText?: string; profile?: ProfileState } = {}) {
  const state = {
    report: null as Row | null,
    usage: [] as Usage[],
    profile: (options.profile ?? null) as ProfileState,
    profileSaves: 0,
    vocabCalls: [] as LearnerMistake[][],
    sessionUpdates: [] as { status: SessionStatus; learnerSpeakingMs: number; teacherSpeakingMs: number }[],
    generateCalls: 0,
    claimAttempts: 0,
  };
  let nextId = 1;

  const deps: FinalizeCoreDeps<Row> = {
    getReport: async () => (options.staleRead ? null : state.report),
    updateSession: async (update) => {
      state.sessionUpdates.push(update);
    },
    generateReport: async () => {
      state.generateCalls++;
      return { text: options.modelText ?? REPORT_JSON, model: "gemini-3.8-flash", totalTokens: 900 };
    },
    claimReport: async (payload) => {
      state.claimAttempts++;
      if (state.report) return { created: false, report: state.report };
      state.report = { id: `r${nextId++}`, ...payload };
      return { created: true, report: state.report };
    },
    recordUsage: async (usage) => {
      state.usage.push(usage);
    },
    loadProfile: async () => state.profile,
    saveProfile: async (row) => {
      state.profileSaves++;
      state.profile = {
        level_estimate: row.level_estimate,
        framework: row.framework,
        can_do: row.can_do,
        memory: row.memory,
        streak_days: row.streak_days,
        last_practice_date: row.last_practice_date,
        total_speaking_ms: row.total_speaking_ms,
      };
    },
    addMistakeVocabulary: async (mistakes) => {
      state.vocabCalls.push(mistakes);
    },
  };
  return { deps, state };
}

test("a single finalize stores the report and applies every side effect once", async () => {
  const { deps, state } = makeStore();
  const result = await finalizeSessionCore(input(), deps);

  assert.equal(result.created, true);
  assert.equal(state.report?.id, "r1");
  assert.equal(state.generateCalls, 1);
  assert.deepEqual(
    state.usage.map((u) => u.kind),
    ["llm", "live_audio_in", "live_audio_out"],
  );
  assert.equal(state.profileSaves, 1);
  assert.equal(state.profile?.total_speaking_ms, 91_000);
  assert.equal(state.profile?.streak_days, 1);
  assert.equal(state.vocabCalls.length, 1);
});

test("a duplicate complete after the report exists changes nothing", async () => {
  const { deps, state } = makeStore();
  await finalizeSessionCore(input(), deps);
  const usageBefore = state.usage.length;
  const profileBefore = { ...state.profile! };

  const second = await finalizeSessionCore(input(), deps);

  assert.equal(second.created, false);
  assert.equal(second.report.id, "r1");
  assert.equal(state.generateCalls, 1, "no second model call once stored");
  assert.equal(state.usage.length, usageBefore);
  assert.equal(state.profileSaves, 1);
  assert.deepEqual(state.profile, profileBefore);
  assert.equal(state.vocabCalls.length, 1);
});

test("a concurrent duplicate that loses the claim records no usage and no profile change", async () => {
  // Both requests read "no report" before either stores one (staleRead).
  const { deps, state } = makeStore({ staleRead: true });
  const [first, second] = await Promise.all([
    finalizeSessionCore(input(), deps),
    finalizeSessionCore(input(), deps),
  ]);

  assert.equal(state.claimAttempts, 2);
  assert.equal([first.created, second.created].filter(Boolean).length, 1, "exactly one winner");
  assert.equal(first.report.id, second.report.id, "both return the same stored report");
  // Winner's side effects only: one llm row, one pair of live rows, one profile write, one vocab pass.
  assert.deepEqual(
    state.usage.map((u) => u.kind),
    ["llm", "live_audio_in", "live_audio_out"],
  );
  assert.equal(state.profileSaves, 1);
  assert.equal(state.profile?.total_speaking_ms, 91_000);
  assert.equal(state.vocabCalls.length, 1);
});

test("a failed model call leaves no claim, so a retry does the full work once", async () => {
  const { deps, state } = makeStore({ modelText: "not json" });
  await assert.rejects(finalizeSessionCore(input(), deps), /report model output unusable/);
  assert.equal(state.report, null);
  assert.equal(state.usage.length, 0, "no usage is recorded before the claim");
  assert.equal(state.profileSaves, 0);

  // The model recovers on retry.
  const retry = makeStore();
  retry.state.report = null;
  const result = await finalizeSessionCore(input(), retry.deps);
  assert.equal(result.created, true);
  assert.equal(retry.state.profileSaves, 1);
});

test("a session with no learner speech skips the model and records no llm usage", async () => {
  const { deps, state } = makeStore();
  const result = await finalizeSessionCore(
    input({
      mode: "text",
      turns: [{ learner_text: null, events: [{ type: "say", text: "Hi" }] }],
    }),
    deps,
  );
  assert.equal(result.created, true);
  assert.equal(state.generateCalls, 0);
  assert.deepEqual(state.usage, []);
  assert.equal(state.profileSaves, 1);
});

test("streak extends on the next day and speaking time accumulates across sessions", async () => {
  const { deps, state } = makeStore({
    profile: {
      level_estimate: "HSK1",
      framework: null,
      can_do: [],
      memory: { recentMistakes: [], notes: ["keep it short"] },
      streak_days: 3,
      last_practice_date: "2026-10-26",
      total_speaking_ms: 5_000,
    },
  });
  await finalizeSessionCore(input({ mode: "text" }), deps);
  assert.equal(state.profile?.streak_days, 4);
  assert.equal(state.profile?.last_practice_date, "2026-10-27");
  assert.equal(state.profile?.total_speaking_ms, 96_000);
  assert.equal(state.profile?.level_estimate, "HSK1");
  assert.deepEqual((state.profile?.memory as { notes?: string[] } | undefined)?.notes, ["keep it short"]);
});

test("flagged and completed sessions keep their status", async () => {
  const flagged = makeStore();
  await finalizeSessionCore(input({ currentStatus: "flagged", requestedStatus: "abandoned" }), flagged.deps);
  assert.equal(flagged.state.sessionUpdates[0].status, "flagged");

  const completed = makeStore();
  await finalizeSessionCore(input({ currentStatus: "completed", requestedStatus: "abandoned" }), completed.deps);
  assert.equal(completed.state.sessionUpdates[0].status, "completed");

  const active = makeStore();
  await finalizeSessionCore(input({ currentStatus: "active", requestedStatus: "abandoned" }), active.deps);
  assert.equal(active.state.sessionUpdates[0].status, "abandoned");
});

test("mergeMistakes puts note-taken mistakes first, dedupes, and caps", () => {
  const noted: LearnerMistake[] = [{ said: "a", correct: "b", category: "tone" }];
  const fromModel: LearnerMistake[] = [
    { said: "a", correct: "b", category: "grammar" },
    { said: "c", correct: "d", category: "vocabulary" },
  ];
  assert.deepEqual(mergeMistakes(noted, fromModel), [
    { said: "a", correct: "b", category: "tone" },
    { said: "c", correct: "d", category: "vocabulary" },
  ]);

  const many: LearnerMistake[] = Array.from({ length: 30 }, (_, i) => ({ said: `s${i}`, correct: `c${i}`, category: "x" }));
  assert.equal(mergeMistakes([], many).length, 20);
});
