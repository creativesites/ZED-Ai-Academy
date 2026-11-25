import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { DEFAULT_TEACHER_NAME, safeTeacherName } from "../course-teacher.ts";
import { isSchemaUnavailableError } from "../mastery/server.ts";
import { currentStreakDays } from "../habits.ts";
import { localDateString } from "../progress.ts";
import { resolveDefaultPersona } from "../server/session-context.ts";
import { staffVisibility, type StaffVisibility } from "./memory-actions.ts";
import { loadLearnerHabits, loadLearnerMemories, looseDb, type LooseDb } from "./memory-server.ts";
import type { LearnerMemoryRecord } from "./memory.ts";
import type { LearnerPreferences } from "./preferences.ts";
import { loadLearnerPreferences } from "./preferences-server.ts";

// Read model for the "What my teacher knows" page (P1-08). Everything is filtered by the signed-in
// user's id and the academy of the page; objective states and evidence are read only (Stream C owns
// the mastery writers).

export type TeacherKnowsMemory = LearnerMemoryRecord & { courseTitle: string | null; visibility: StaffVisibility };

export type TeacherKnowsEvidence = {
  result: "correct" | "partial" | "misconception";
  detail: string | null;
  createdAt: string;
};

export type TeacherKnowsObjective = {
  objectiveKey: string;
  objectiveText: string;
  level: number;
  lastResult: string | null;
  lastEvidenceAt: string | null;
  courseTitle: string | null;
  evidence: TeacherKnowsEvidence[];
  visibility: StaffVisibility;
};

export type TeacherKnowsData = {
  /** False before the memory migration is applied: the page shows a "coming soon" state. */
  available: boolean;
  teacherName: string;
  memories: TeacherKnowsMemory[];
  objectives: TeacherKnowsObjective[];
  preferences: LearnerPreferences | null;
  habits: { streakDays: number; longestStreakDays: number; totalPracticeMinutes: number } | null;
  /** Courses this learner has memories or objective states for in this academy (for "forget this course"). */
  courses: Array<{ id: string; title: string }>;
};

const EVIDENCE_PER_OBJECTIVE = 5;

type Res<T> = { data: T | null; error: { code?: string; message?: string } | null };

export async function loadWhatTeacherKnows(userId: string, companyId: string): Promise<TeacherKnowsData> {
  const supabase = createServiceClient();
  const db: LooseDb = looseDb(supabase);

  const [memRes, prefRes, habitRes, masteryRes, evidenceRes, persona] = await Promise.all([
    loadLearnerMemories({ db, userId, companyId, statuses: ["active", "hidden"], limit: 300 }),
    loadLearnerPreferences(userId, db),
    loadLearnerHabits(userId, db).catch(() => ({ available: false, habits: null })),
    db
      .from("learner_mastery")
      .select("objective_key, objective_text, level, last_result, last_evidence_at, course_id")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .order("level", { ascending: true })
      .limit(100) as PromiseLike<
      Res<Array<{ objective_key: string; objective_text: string; level: number; last_result: string | null; last_evidence_at: string | null; course_id: string | null }>>
    >,
    db
      .from("learner_evidence")
      .select("objective_key, result, detail, created_at")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(400) as PromiseLike<
      Res<Array<{ objective_key: string; result: TeacherKnowsEvidence["result"]; detail: string | null; created_at: string }>>
    >,
    resolveDefaultPersona(supabase, companyId).catch(() => null),
  ]);

  if (masteryRes.error && !isSchemaUnavailableError(masteryRes.error)) {
    console.warn("[tutor/teacher-knows] mastery read failed:", masteryRes.error.message);
  }
  const masteryRows = masteryRes.error ? [] : (masteryRes.data ?? []);
  const evidenceRows = evidenceRes.error ? [] : (evidenceRes.data ?? []);

  const courseIds = Array.from(
    new Set(
      [...memRes.memories.map((m) => m.courseId), ...masteryRows.map((r) => r.course_id)].filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      ),
    ),
  );
  const courseTitle = new Map<string, string>();
  if (courseIds.length > 0) {
    const { data } = await supabase.from("courses").select("id, title").in("id", courseIds);
    for (const c of data ?? []) courseTitle.set(c.id, c.title);
  }

  const evidenceByKey = new Map<string, TeacherKnowsEvidence[]>();
  for (const e of evidenceRows) {
    const list = evidenceByKey.get(e.objective_key) ?? [];
    if (list.length < EVIDENCE_PER_OBJECTIVE) {
      list.push({ result: e.result, detail: e.detail, createdAt: e.created_at });
      evidenceByKey.set(e.objective_key, list);
    }
  }

  const habits = habitRes.habits;
  return {
    available: memRes.available,
    teacherName:
      safeTeacherName(persona?.display_name) ?? safeTeacherName(persona?.name) ?? DEFAULT_TEACHER_NAME,
    memories: memRes.memories.map((m) => ({
      ...m,
      courseTitle: m.courseId ? (courseTitle.get(m.courseId) ?? null) : null,
      visibility: staffVisibility({ type: "memory", visibleToStaff: m.visibleToStaff }),
    })),
    objectives: masteryRows.map((r) => ({
      objectiveKey: r.objective_key,
      objectiveText: r.objective_text,
      level: r.level,
      lastResult: r.last_result,
      lastEvidenceAt: r.last_evidence_at,
      courseTitle: r.course_id ? (courseTitle.get(r.course_id) ?? null) : null,
      evidence: evidenceByKey.get(r.objective_key) ?? [],
      visibility: staffVisibility({ type: "objective" }),
    })),
    preferences: prefRes.preferences,
    habits: habits
      ? {
          streakDays: currentStreakDays(habits, localDateString(new Date())),
          longestStreakDays: habits.longestStreakDays,
          totalPracticeMinutes: Math.round(habits.totalPracticeMs / 60_000),
        }
      : null,
    courses: courseIds.map((id) => ({ id, title: courseTitle.get(id) ?? "Untitled course" })),
  };
}
