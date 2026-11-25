import "server-only";
import { aiCall } from "@/lib/ai/call";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizeObjectiveKey } from "../mastery/evidence.ts";
import { isSchemaUnavailableError, persistSessionMastery } from "../mastery/server";
import { loose } from "../learner/loose-db.ts";
import { objectiveKeyForId, resolveObjectiveRef, type ObjectiveRef } from "../learner/objectives.ts";
import type { SessionContext } from "../server/session-context.ts";
import {
  sanitiseSummary,
  summaryRequestText,
  SUMMARY_SYSTEM_PROMPT,
  turnsToSummarise,
} from "./context.ts";
import {
  gradePendingCheck,
  interactionLearnerText,
  isCheckOpen,
  parseAnswerSpec,
  type GradedInteraction,
  type InteractionInput,
  type PendingCheck,
} from "./interactions.ts";
import { policyDirectivesEnabled } from "./policy.ts";
import { initialSessionState, parseSessionState, recomputeSessionState, type SessionState } from "./state.ts";
import { chooseBaseStrategy, parseTeachingPhilosophy, strategyPromptBlock, type TeachingPhilosophy } from "./strategies.ts";

// Database glue for the adaptive runtime (P2-04/05/06). Every read/write of a Stream F table or column catches
// isSchemaUnavailableError and falls back to today's behaviour: no held checks (answers ungraded), no stored
// state (recomputed from turns each turn, no summary), no shared cache. Not unit-tested (needs a database); the
// rules it applies live in the pure modules next to it.

const logWarn = (msg: string, err?: unknown) =>
  console.warn(`[tutor/runtime] ${msg}`, err instanceof Error ? err.message : (err as { message?: string })?.message ?? "");

// ---- persona / flow inputs ----

export function personaPhilosophy(ctx: SessionContext): TeachingPhilosophy {
  return parseTeachingPhilosophy((ctx.persona as unknown as { teaching_philosophy?: unknown }).teaching_philosophy);
}

export function strategiesBlockFor(ctx: SessionContext): string {
  return strategyPromptBlock({
    origin: ctx.session.origin,
    skillPack: ctx.scenario.skill_pack,
    philosophy: personaPhilosophy(ctx),
  });
}

export function beatIdsOf(ctx: SessionContext): string[] {
  const beats = Array.isArray(ctx.scenario.beats) ? (ctx.scenario.beats as { id?: unknown }[]) : [];
  return beats.map((b) => b.id).filter((id): id is string => typeof id === "string");
}

export function vocabularyOf(ctx: SessionContext): string[] {
  const beats = Array.isArray(ctx.scenario.beats) ? (ctx.scenario.beats as { goal?: unknown }[]) : [];
  return [
    ctx.scenario.title,
    ctx.scenario.goal,
    ...beats.map((b) => b.goal).filter((g): g is string => typeof g === "string"),
    ...ctx.objectives.map((o) => o.text),
  ];
}

export function objectiveResolver(objectives: readonly ObjectiveRef[]): (raw: string) => string | null {
  return (raw) => resolveObjectiveRef(raw, objectives)?.id ?? null;
}

export function directivesEnabledFor(companyId: string): boolean {
  return policyDirectivesEnabled(companyId, process.env);
}

/** Registered prerequisites of the session's objectives (same tenant). Empty when unavailable. */
export async function loadPrerequisites(ctx: SessionContext): Promise<Record<string, string[]>> {
  const ids = ctx.objectives.map((o) => o.id);
  if (ids.length === 0) return {};
  try {
    const { data, error } = await loose(createServiceClient())
      .from("objective_prerequisites")
      .select("objective_id, requires_id")
      .eq("company_id", ctx.session.company_id)
      .in("objective_id", ids);
    if (error || !Array.isArray(data)) return {};
    const out: Record<string, string[]> = {};
    for (const row of data as { objective_id: string; requires_id: string }[]) {
      (out[row.objective_id] ??= []).push(row.requires_id);
    }
    return out;
  } catch {
    return {};
  }
}

// ---- session state ----

/** Stored state, or one recomputed from the turns (teacher judgement only). `persisted` = the column exists. */
export function loadRuntimeState(ctx: SessionContext): { state: SessionState; persisted: boolean } {
  const row = ctx.session as unknown as { state?: unknown };
  const persisted = "state" in row;
  const stored = persisted ? parseSessionState(row.state) : null;
  if (stored) return { state: stored, persisted };
  const initial = initialSessionState({
    objectiveIds: ctx.objectives.map((o) => o.id),
    flowVersion: ctx.session.scenario_version ?? null,
    strategy: chooseBaseStrategy({
      origin: ctx.session.origin,
      skillPack: ctx.scenario.skill_pack,
      style: ctx.scenario.style,
      level: ctx.learnerProfile.levelEstimate,
      philosophy: personaPhilosophy(ctx),
    }),
  });
  const state = recomputeSessionState(initial, ctx.history, {
    beatIds: beatIdsOf(ctx),
    resolveObjective: objectiveResolver(ctx.objectives),
  });
  return { state, persisted };
}

export async function saveRuntimeState(sessionId: string, state: SessionState): Promise<void> {
  try {
    const { error } = await loose(createServiceClient()).from("tutor_sessions").update({ state }).eq("id", sessionId);
    if (error && !isSchemaUnavailableError(error)) logWarn("could not save session state", error);
  } catch (err) {
    logWarn("could not save session state", err);
  }
}

// ---- held checks (P2-04) ----

/** Holds the answer keys of a turn's checks. Returns false when they could not be held (answers stay ungraded). */
export async function holdChecks(sessionId: string, checks: readonly PendingCheck[]): Promise<boolean> {
  if (checks.length === 0) return true;
  try {
    const { error } = await loose(createServiceClient())
      .from("tutor_pending_checks")
      .upsert(
        checks.map((c) => ({
          session_id: sessionId,
          check_id: c.id,
          turn_idx: c.turnIdx,
          kind: c.kind,
          prompt: c.prompt.slice(0, 400),
          objective: c.objective,
          spec: c.spec,
        })),
        { onConflict: "session_id,check_id" },
      );
    if (error) {
      if (!isSchemaUnavailableError(error)) logWarn("could not hold checks", error);
      return false;
    }
    return true;
  } catch (err) {
    logWarn("could not hold checks", err);
    return false;
  }
}

export type GradedTurnInput = {
  graded: GradedInteraction;
  /** Registered objective id (tenant-checked: one of the session's objectives), or null. */
  objectiveId: string | null;
  learnerText: string;
};

/**
 * Grades the learner's answer to a held check. Null when there is no such open check (unknown id, an older turn,
 * already answered, schema missing) or the value is malformed: the caller then treats the reply as plain text.
 * Does not mark the check answered: `claimAndRecordGrade` does that after the turn is stored.
 */
export async function gradeHeldInteraction(
  ctx: SessionContext,
  interaction: InteractionInput,
): Promise<GradedTurnInput | null> {
  try {
    const { data, error } = await loose(createServiceClient())
      .from("tutor_pending_checks")
      .select("check_id, turn_idx, kind, prompt, objective, spec, answered_at")
      .eq("session_id", ctx.session.id)
      .eq("check_id", interaction.id)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as {
      check_id: string;
      turn_idx: number;
      kind: PendingCheck["kind"];
      prompt: string;
      objective: string | null;
      spec: unknown;
      answered_at: string | null;
    };
    if (!isCheckOpen({ turnIdx: row.turn_idx, answeredAt: row.answered_at }, ctx.history)) return null;
    const spec = parseAnswerSpec(row.spec);
    if (!spec) return null;
    const check: PendingCheck = {
      id: row.check_id,
      turnIdx: row.turn_idx,
      kind: spec.kind,
      prompt: row.prompt,
      objective: row.objective,
      spec,
    };
    const graded = gradePendingCheck(check, interaction.value);
    if ("error" in graded) return null;
    const objectiveId = row.objective ? (resolveObjectiveRef(row.objective, ctx.objectives)?.id ?? null) : null;
    return { graded, objectiveId, learnerText: interactionLearnerText(check, interaction.value) };
  } catch {
    return null;
  }
}

/**
 * After the turn is stored: claims the check (single use, race-safe) and records server-verified `interaction`
 * evidence. Objective: the registered one the check names; otherwise its free text; otherwise the state's current
 * objective; otherwise no evidence (the grade still reached the model). Never throws.
 */
export async function claimAndRecordGrade(
  ctx: SessionContext,
  g: GradedTurnInput,
  fallbackObjectiveId: string | null,
): Promise<void> {
  try {
    const db = createServiceClient();
    const { data: claimed, error } = await loose(db)
      .from("tutor_pending_checks")
      .update({ answered_at: new Date().toISOString(), result: g.graded.grade.result, score: g.graded.grade.score })
      .eq("session_id", ctx.session.id)
      .eq("check_id", g.graded.check.id)
      .is("answered_at", null)
      .select("check_id");
    if (error || !Array.isArray(claimed) || claimed.length === 0) return; // already answered elsewhere

    const registered =
      (g.objectiveId ? ctx.objectives.find((o) => o.id === g.objectiveId) : null) ??
      (fallbackObjectiveId ? ctx.objectives.find((o) => o.id === fallbackObjectiveId) : null) ??
      null;
    // Ask dock (no registered objectives): key the evidence by lesson + question, as the legacy dock check did.
    const freeText = registered
      ? null
      : (g.graded.check.objective ??
        (ctx.session.origin === "ask" && ctx.courseId ? `${ctx.scenario.title}: ${g.graded.check.prompt}`.slice(0, 200) : null));
    if (!registered && !freeText) return;

    const grade = g.graded.grade;
    await persistSessionMastery({
      supabase: db,
      companyId: ctx.session.company_id,
      userId: ctx.session.user_id,
      courseId: ctx.courseId,
      scenarioId: ctx.session.scenario_id,
      sessionId: ctx.session.id,
      evidence: [
        {
          objectiveKey: registered
            ? objectiveKeyForId(registered.id)
            : normalizeObjectiveKey(freeText as string, { courseId: ctx.courseId, scenarioId: ctx.session.scenario_id }),
          objectiveText: registered ? registered.text : (freeText as string),
          objectiveId: registered?.id ?? null,
          result: grade.result,
          detail: `${g.graded.check.kind} check: answered "${grade.given.slice(0, 80)}" (${grade.result}).`,
          source: "interaction",
          serverVerified: true,
          score: grade.score,
          difficulty: null,
          itemRef: `tutor_check:${ctx.session.id}:${g.graded.check.id}`,
        },
      ],
    });
  } catch (err) {
    logWarn("could not record interaction evidence", err);
  }
}

// ---- rolling summary (P2-06) ----

/**
 * Meant for `after()`: folds turns that left the window into state.summary with the cheap model (`tutorSummary`,
 * metered to the session's tenant) and stores only the summary fields onto the latest stored state, so a turn that
 * finished meanwhile is not overwritten. Does nothing when nothing is due, state is not stored, or the call fails.
 */
export async function summariseAndStoreIfDue(
  ctx: SessionContext,
  state: SessionState,
  history: SessionContext["history"],
): Promise<void> {
  const next = await summariseIfDue(ctx, state, history);
  if (next === state || next.summarizedThroughIdx === undefined) return;
  try {
    const db = loose(createServiceClient());
    const { data, error } = await db.from("tutor_sessions").select("state").eq("id", ctx.session.id).maybeSingle();
    if (error) return;
    const latest = parseSessionState((data as { state?: unknown } | null)?.state) ?? state;
    if ((latest.summarizedThroughIdx ?? -1) >= next.summarizedThroughIdx) return;
    await saveRuntimeState(ctx.session.id, {
      ...latest,
      summary: next.summary,
      summarizedThroughIdx: next.summarizedThroughIdx,
    });
  } catch (err) {
    logWarn("could not store summary", err);
  }
}

async function summariseIfDue(
  ctx: SessionContext,
  state: SessionState,
  history: SessionContext["history"],
): Promise<SessionState> {
  const due = turnsToSummarise(history, state.summary ? state.summarizedThroughIdx : undefined);
  if (!due || due.length === 0) return state;
  try {
    const result = await aiCall(
      "tutorSummary",
      {
        systemInstruction: SUMMARY_SYSTEM_PROMPT,
        contents: [{ role: "user", parts: [{ text: summaryRequestText(state.summary, due) }] }],
        temperature: 0.2,
        thinking: "minimal",
        maxOutputTokens: 600,
      },
      { meter: { companyId: ctx.session.company_id, userId: ctx.session.user_id, sessionId: ctx.session.id } },
    );
    const summary = sanitiseSummary(result.text);
    if (!summary) return state;
    return { ...state, summary, summarizedThroughIdx: due[due.length - 1].idx };
  } catch (err) {
    logWarn("summary failed; the window stays verbatim", err);
    return state;
  }
}
