import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { computeLearnerHabits, type LearnerHabitSummary } from "../habits.ts";
import { summarizeDeck, type DeckSummary } from "../srs.ts";
import { personaLookFromVariant, type TutorPersonaLook } from "../tutor-session-block.ts";

export type LearnerLanguageStat = {
  language: string;
  levelEstimate: string | null;
  framework: string | null;
  streakDays: number;
  totalSpeakingMinutes: number;
  lastPracticeDate: string | null;
};

export type LearnerAssignedScenario = {
  assignmentId: string;
  scenarioId: string;
  title: string;
  goal: string;
  skillPack: string;
  level: string | null;
  maxMinutes: number;
  dueAt: string | null;
  completed: boolean;
  personaName: string | null;
  personaLook?: Partial<TutorPersonaLook>;
};

export type LearnerTutorOverview = {
  streakDays: number;
  totalSpeakingMinutes: number;
  weeklyMinutes: number;
  completedSessionsCount: number;
  habits: LearnerHabitSummary;
  languages: LearnerLanguageStat[];
  deck: DeckSummary;
  assignments: LearnerAssignedScenario[];
};

export type LearnerDeckCard = {
  vocabId: string;
  companyId: string;
  language: string;
  term: string;
  pron: string | null;
  meaning: string | null;
  level: string | null;
  source: "lesson" | "mistake" | "manual";
  dueAt: string;
  intervalDays: number;
  ease: number;
  reps: number;
  lapses: number;
};

export type LearnerSessionHistoryItem = {
  sessionId: string;
  scenarioId: string | null;
  scenarioTitle: string;
  skillPack: string | null;
  level: string | null;
  origin: string;
  mode: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  learnerSpeakingMs: number;
  sharedWithTeacher: boolean;
  personaName: string | null;
  personaLook?: Partial<TutorPersonaLook>;
  report: {
    scores: Record<string, number>;
    strengths: string[];
    mistakes: Array<{ said: string; correct: string; category: string; note?: string }>;
  } | null;
};

export async function loadLearnerTutorOverview(
  userId: string,
  scope: { kind: "platform" } | { kind: "tenant"; companyId: string },
): Promise<LearnerTutorOverview> {
  const supabase = createServiceClient();

  const companyFilter = scope.kind === "tenant" ? scope.companyId : null;

  // 1. Language profiles
  let profileQuery = supabase
    .from("learner_language_profiles")
    .select("language, level_estimate, framework, streak_days, total_speaking_ms, last_practice_date")
    .eq("user_id", userId);
  if (companyFilter) profileQuery = profileQuery.eq("company_id", companyFilter);

  // 2. Deck summary rows
  let vocabQuery = supabase
    .from("learner_vocab")
    .select("due_at, interval_days, reps")
    .eq("user_id", userId);
  if (companyFilter) vocabQuery = vocabQuery.eq("company_id", companyFilter);

  // 3. Completed sessions count + weekly practice minutes (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let sessionsQuery = supabase
    .from("tutor_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "completed");
  if (companyFilter) sessionsQuery = sessionsQuery.eq("company_id", companyFilter);

  let weeklySessionsQuery = supabase
    .from("tutor_sessions")
    .select("started_at, ended_at, learner_speaking_ms, teacher_speaking_ms")
    .eq("user_id", userId)
    .eq("status", "completed")
    .gte("started_at", sevenDaysAgo);
  if (companyFilter) weeklySessionsQuery = weeklySessionsQuery.eq("company_id", companyFilter);

  // 4. Memberships & classroom groups for assignments
  const [profilesRes, vocabRes, sessionsRes, weeklyRes, membershipsRes, groupMembersRes] = await Promise.all([
    profileQuery,
    vocabQuery,
    sessionsQuery,
    weeklySessionsQuery,
    supabase
      .from("company_members")
      .select("company_id")
      .eq("profile_id", userId)
      .eq("status", "active"),
    supabase
      .from("classroom_group_members")
      .select("group_id")
      .eq("profile_id", userId),
  ]);

  const weeklyMs = (weeklyRes.data ?? []).reduce((sum, row) => {
    const spokenMs = (row.learner_speaking_ms ?? 0) + (row.teacher_speaking_ms ?? 0);
    const wallMs =
      row.ended_at && row.started_at
        ? Math.max(0, Math.min(30 * 60_000, Date.parse(row.ended_at) - Date.parse(row.started_at)))
        : 0;
    return sum + Math.max(spokenMs, wallMs, 60_000);
  }, 0);
  const weeklyMinutes = Math.round(weeklyMs / 60_000);

  const langRows = profilesRes.data ?? [];
  const languages: LearnerLanguageStat[] = langRows.map((r) => ({
    language: r.language,
    levelEstimate: r.level_estimate,
    framework: r.framework,
    streakDays: r.streak_days ?? 0,
    totalSpeakingMinutes: Math.round((r.total_speaking_ms ?? 0) / 60000),
    lastPracticeDate: r.last_practice_date,
  }));

  const streakDays = languages.reduce((max, l) => Math.max(max, l.streakDays), 0);
  const totalSpeakingMinutes = languages.reduce((sum, l) => sum + l.totalSpeakingMinutes, 0);

  const deck = summarizeDeck(
    (vocabRes.data ?? []).map((v) => ({
      dueAt: v.due_at,
      intervalDays: v.interval_days,
      reps: v.reps,
    })),
  );

  // 5. Load active assignments for learner's tenant(s) & groups
  const tenantIds = companyFilter
    ? [companyFilter]
    : (membershipsRes.data ?? []).map((m) => m.company_id);
  const groupIds = new Set((groupMembersRes.data ?? []).map((g) => g.group_id));

  let assignments: LearnerAssignedScenario[] = [];
  if (tenantIds.length > 0) {
    const { data: rawAssignments } = await supabase
      .from("tutor_assignments")
      .select("id, scenario_id, group_id, due_at")
      .in("company_id", tenantIds)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(12);

    const visibleAssignments = (rawAssignments ?? []).filter(
      (a) => a.group_id === null || groupIds.has(a.group_id),
    );

    const assignmentIds = visibleAssignments.map((a) => a.id);
    const scenarioIds = [...new Set(visibleAssignments.map((a) => a.scenario_id))];

    const [{ data: doneSessions }, { data: scenarioRows }] = await Promise.all([
      assignmentIds.length
        ? supabase
            .from("tutor_sessions")
            .select("assignment_id")
            .eq("user_id", userId)
            .eq("status", "completed")
            .in("assignment_id", assignmentIds)
        : Promise.resolve({ data: [] }),
      scenarioIds.length
        ? supabase
            .from("practice_scenarios")
            .select("id, title, goal, skill_pack, level, max_minutes, status, persona_id")
            .in("id", scenarioIds)
            .eq("status", "published")
        : Promise.resolve({ data: [] }),
    ]);

    const personaIds = [
      ...new Set(
        (scenarioRows ?? [])
          .map((s) => s.persona_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const { data: personaRows } = personaIds.length
      ? await supabase
          .from("ai_personas")
          .select("id, name, display_name, rive_variant")
          .in("id", personaIds)
      : { data: [] };

    const personaMap = new Map(
      (personaRows ?? []).map((p) => [
        p.id,
        {
          name: p.display_name ?? p.name,
          look: personaLookFromVariant(p.rive_variant),
        },
      ]),
    );
    const scenarioMap = new Map((scenarioRows ?? []).map((s) => [s.id, s]));
    const doneAssignmentIds = new Set(
      (doneSessions ?? []).map((s) => s.assignment_id).filter((id): id is string => Boolean(id)),
    );

    assignments = visibleAssignments
      .map((a): LearnerAssignedScenario | null => {
        const sc = scenarioMap.get(a.scenario_id);
        if (!sc) return null;
        const p = sc.persona_id ? personaMap.get(sc.persona_id) : undefined;
        return {
          assignmentId: a.id,
          scenarioId: sc.id,
          title: sc.title,
          goal: sc.goal,
          skillPack: sc.skill_pack,
          level: sc.level,
          maxMinutes: sc.max_minutes,
          dueAt: a.due_at,
          completed: doneAssignmentIds.has(a.id),
          personaName: p?.name ?? null,
          personaLook: p?.look,
        };
      })
      .filter((x): x is LearnerAssignedScenario => x !== null);
  }

  const completedSessionsCount = sessionsRes.count ?? 0;
  const effectiveTotalMinutes = Math.max(totalSpeakingMinutes, weeklyMinutes);
  const habits = computeLearnerHabits({
    streakDays,
    completedSessionsCount,
    totalPracticeMinutes: effectiveTotalMinutes,
    weeklyMinutes,
    deckDueCount: deck.dueNow,
    deckMasteredCount: deck.mastered,
  });

  return {
    streakDays,
    totalSpeakingMinutes: effectiveTotalMinutes,
    weeklyMinutes,
    completedSessionsCount,
    habits,
    languages,
    deck,
    assignments,
  };
}

export async function loadLearnerDeck(
  userId: string,
  companyId?: string,
): Promise<LearnerDeckCard[]> {
  const supabase = createServiceClient();

  let query = supabase
    .from("learner_vocab")
    .select("vocab_id, company_id, due_at, interval_days, ease, reps, lapses, source")
    .eq("user_id", userId)
    .order("due_at", { ascending: true });

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data: links, error } = await query;
  if (error) throw new Error(error.message);

  const rows = links ?? [];
  const vocabIds = [...new Set(rows.map((r) => r.vocab_id))];
  if (vocabIds.length === 0) return [];

  const { data: items, error: itemsErr } = await supabase
    .from("vocab_items")
    .select("id, language, term, pron, meaning, level")
    .in("id", vocabIds);

  if (itemsErr) throw new Error(itemsErr.message);

  const itemMap = new Map((items ?? []).map((i) => [i.id, i]));

  return rows
    .map((row): LearnerDeckCard | null => {
      const item = itemMap.get(row.vocab_id);
      if (!item) return null;
      return {
        vocabId: row.vocab_id,
        companyId: row.company_id,
        language: item.language,
        term: item.term,
        pron: item.pron,
        meaning: item.meaning,
        level: item.level,
        source: (row.source as "lesson" | "mistake" | "manual") ?? "manual",
        dueAt: row.due_at,
        intervalDays: row.interval_days,
        ease: row.ease,
        reps: row.reps,
        lapses: row.lapses,
      };
    })
    .filter((c): c is LearnerDeckCard => c !== null);
}

export async function loadLearnerSessionHistory(
  userId: string,
  scope: { kind: "platform" } | { kind: "tenant"; companyId: string },
  limit = 30,
): Promise<LearnerSessionHistoryItem[]> {
  const supabase = createServiceClient();

  let query = supabase
    .from("tutor_sessions")
    .select(
      "id, scenario_id, origin, mode, status, started_at, ended_at, learner_speaking_ms, shared_with_teacher",
    )
    .eq("user_id", userId)
    .in("status", ["completed", "abandoned"])
    .order("started_at", { ascending: false })
    .limit(limit);

  if (scope.kind === "tenant") {
    query = query.eq("company_id", scope.companyId);
  }

  const { data: sessions, error } = await query;
  if (error) throw new Error(error.message);

  const sessionRows = sessions ?? [];
  if (sessionRows.length === 0) return [];

  const sessionIds = sessionRows.map((s) => s.id);
  const scenarioIds = [
    ...new Set(sessionRows.map((s) => s.scenario_id).filter((id): id is string => Boolean(id))),
  ];

  const [{ data: reports }, { data: scenarios }] = await Promise.all([
    supabase
      .from("tutor_reports")
      .select("session_id, scores, strengths, mistakes")
      .in("session_id", sessionIds),
    scenarioIds.length
      ? supabase
          .from("practice_scenarios")
          .select("id, title, skill_pack, level, persona_id")
          .in("id", scenarioIds)
      : Promise.resolve({ data: [] }),
  ]);

  const personaIds = [
    ...new Set(
      (scenarios ?? []).map((s) => s.persona_id).filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: personas } = personaIds.length
    ? await supabase
        .from("ai_personas")
        .select("id, name, display_name, rive_variant")
        .in("id", personaIds)
    : { data: [] };

  const reportMap = new Map((reports ?? []).map((r) => [r.session_id, r]));
  const scenarioMap = new Map((scenarios ?? []).map((s) => [s.id, s]));
  const personaMap = new Map(
    (personas ?? []).map((p) => [
      p.id,
      {
        name: p.display_name ?? p.name,
        look: personaLookFromVariant(p.rive_variant),
      },
    ]),
  );

  return sessionRows.map((s) => {
    const sc = s.scenario_id ? scenarioMap.get(s.scenario_id) : undefined;
    const p = sc?.persona_id ? personaMap.get(sc.persona_id) : undefined;
    const rep = reportMap.get(s.id);

    const parsedScores: Record<string, number> = {};
    if (rep?.scores && typeof rep.scores === "object" && !Array.isArray(rep.scores)) {
      for (const [k, v] of Object.entries(rep.scores as Record<string, unknown>)) {
        if (typeof v === "number") parsedScores[k] = v;
      }
    }

    return {
      sessionId: s.id,
      scenarioId: s.scenario_id,
      scenarioTitle: sc?.title ?? "Speaking Practice",
      skillPack: sc?.skill_pack ?? null,
      level: sc?.level ?? null,
      origin: s.origin,
      mode: s.mode,
      status: s.status,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      learnerSpeakingMs: s.learner_speaking_ms,
      sharedWithTeacher: s.shared_with_teacher,
      personaName: p?.name ?? null,
      personaLook: p?.look,
      report: rep
        ? {
            scores: parsedScores,
            strengths: Array.isArray(rep.strengths)
              ? (rep.strengths as unknown[]).filter((x): x is string => typeof x === "string")
              : [],
            mistakes: Array.isArray(rep.mistakes)
              ? (rep.mistakes as Array<{
                  said: string;
                  correct: string;
                  category: string;
                  note?: string;
                }>)
              : [],
          }
        : null,
    };
  });
}
