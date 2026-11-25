import "server-only";
import { after } from "next/server";
import { modelFor } from "@/lib/ai/models";
import type { TurnPipelineResult, ContextExtras, HistoryTurn } from "../server/turn-pipeline.ts";
import { buildPromptParts } from "../server/prompt.ts";
import { createSharedPromptCache, lookupSharedPromptCache } from "../server/prompt-cache.ts";
import {
  toPromptPersona,
  toPromptScenario,
  type SessionContext,
} from "../server/session-context.ts";
import type { InteractionInput } from "./interactions.ts";
import { commitTurn, planTurn } from "./plan.ts";
import type { Move } from "./strategies.ts";
import {
  beatIdsOf,
  claimAndRecordGrade,
  directivesEnabledFor,
  gradeHeldInteraction,
  loadPrerequisites,
  loadRuntimeState,
  objectiveResolver,
  personaPhilosophy,
  saveRuntimeState,
  strategiesBlockFor,
  summariseAndStoreIfDue,
  vocabularyOf,
} from "./server.ts";

// The adaptive runtime's hooks around one Voice/Text session turn (Architecture §9.1). turn-runner.ts calls
// `prepareRuntimeTurn` before the pipeline and `finish` after it; everything else stays in the pipeline, so the
// streaming runner (Stream E) can call the same two hooks.

export type RuntimeTurn = {
  /** Cached prefix (P2-06): shared by every learner of this flow version. */
  systemInstruction: string;
  /** Learner brief + rolling summary first; grading result + policy directive last. */
  context: ContextExtras;
  /** Turns sent verbatim (the window). */
  history: HistoryTurn[];
  /** The learner's words: their text, or a description of their interaction answer. */
  learnerText: string | null;
  policyMove: Move | null;
  /** Context-cache handle when one already exists; otherwise one is created after the response. */
  cachedContent: () => Promise<string | undefined>;
  /** After the turn is stored: state, held checks' evidence, summary, cache. Never throws. */
  finish: (result: TurnPipelineResult) => Promise<void>;
};

/** Runs `job` after the response when inside a request; otherwise (scripts) just starts it. */
function later(job: () => Promise<unknown>): void {
  try {
    after(job);
  } catch {
    void job().catch(() => undefined);
  }
}

export async function prepareRuntimeTurn(input: {
  ctx: SessionContext;
  mode: "voice" | "text";
  learnerText: string | null;
  interaction?: InteractionInput | null;
}): Promise<RuntimeTurn> {
  const { ctx } = input;
  const graded = input.interaction ? await gradeHeldInteraction(ctx, input.interaction) : null;
  // A graded value with no typed words: the transcript and history show a description of the answer.
  // Not gradable (unknown/closed check, keys not held): the teacher judges the plain answer, as in v2.
  const learnerText =
    input.learnerText ??
    graded?.learnerText ??
    (input.interaction ? `My answer: ${[input.interaction.value].flat().join(", ")}`.slice(0, 1000) : null);

  const { state, persisted } = loadRuntimeState(ctx);
  const directivesEnabled = directivesEnabledFor(ctx.session.company_id);
  const prerequisites = directivesEnabled ? await loadPrerequisites(ctx) : {};
  const startedAt = Date.parse(ctx.session.started_at);
  const parts = buildPromptParts({
    scenario: { ...toPromptScenario(ctx.scenario), objectives: ctx.objectives },
    persona: toPromptPersona(ctx.persona),
    skillPack: ctx.scenario.skill_pack,
    learnerProfile: ctx.learnerProfile,
    lessonText: ctx.lessonText,
    mode: input.mode,
    strategies: strategiesBlockFor(ctx),
  });

  const plan = planTurn({
    state,
    statePersisted: persisted,
    history: ctx.history,
    learnerText,
    graded: graded?.graded ?? null,
    gradedObjectiveId: graded?.objectiveId ?? null,
    vocabulary: vocabularyOf(ctx),
    brief: { level: ctx.learnerProfile.levelEstimate, philosophy: personaPhilosophy(ctx) },
    flow: {
      origin: ctx.session.origin,
      timeLeftMs: startedAt + ctx.scenario.max_minutes * 60_000 - Date.now(),
      prerequisites,
    },
    directivesEnabled,
    objectiveText: (id) => ctx.objectives.find((o) => o.id === id)?.text ?? null,
    learnerBlock: parts.learner,
  });

  const model = modelFor("tutorTurn");
  let cacheHit = false;

  return {
    systemInstruction: parts.prefix,
    context: { prelude: plan.prelude, teacherNote: plan.teacherNote },
    history: plan.window,
    learnerText,
    policyMove: plan.directive?.move ?? null,
    cachedContent: async () => {
      const name = await lookupSharedPromptCache(model, parts.prefix);
      cacheHit = !!name;
      return name;
    },
    finish: async (result) => {
      try {
        const resolveObjective = objectiveResolver(ctx.objectives);
        const next = commitTurn(plan, { events: result.events, checks: result.checks }, { beatIds: beatIdsOf(ctx), resolveObjective });
        // Awaited (one small update) so the next turn's policy reads this turn's state.
        if (persisted) await saveRuntimeState(ctx.session.id, next);
        const history = [...ctx.history, { idx: result.idx, learner_text: result.learnerText ?? learnerText, events: result.events }];
        later(async () => {
          if (graded) await claimAndRecordGrade(ctx, graded, plan.state.currentObjectiveId);
          if (persisted) await summariseAndStoreIfDue(ctx, next, history);
          // First turn on this prefix (or an expired cache): create it now; later turns use it.
          if (!cacheHit) await createSharedPromptCache(model, parts.prefix);
        });
      } catch (err) {
        console.warn("[tutor/runtime] finish failed:", err instanceof Error ? err.message : err);
      }
    },
  };
}
