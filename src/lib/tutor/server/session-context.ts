import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { blocksToText } from "@/lib/course-blocks/block-to-text";
import type { Database } from "@/types/database";
import { DEFAULT_TEACHER_NAME } from "../course-teacher.ts";
import { loadSessionMemoryNotes, loadWeakMasteryRows } from "../mastery/server.ts";
import { buildRevisionSprintScenario } from "../mastery/sprint.ts";
import { parseMemory } from "../memory.ts";
import { profileLanguage } from "../progress.ts";
import { skillPackLanguage } from "../skill-packs.ts";
import type { PromptLearnerProfile, PromptPersona, PromptScenario } from "./prompt.ts";
import type { HistoryTurn } from "./turn-pipeline.ts";

// Everything a turn needs about a session, loaded with the service client. Ownership is checked
// by the caller before this runs.

type Tables = Database["public"]["Tables"];
export type TutorSessionRow = Tables["tutor_sessions"]["Row"];
export type ScenarioRow = Tables["practice_scenarios"]["Row"];
export type PersonaRow = Tables["ai_personas"]["Row"];

export const LESSON_CONTEXT_MAX_CHARS = 24_000;

export function toPromptScenario(scenario: ScenarioRow): PromptScenario {
  const beats = Array.isArray(scenario.beats) ? (scenario.beats as { id?: unknown; goal?: unknown }[]) : [];
  const targets = Array.isArray(scenario.target_items)
    ? (scenario.target_items as { text?: unknown; pron?: unknown; meaning?: unknown }[])
    : [];
  return {
    title: scenario.title,
    goal: scenario.goal,
    beats: beats
      .filter((b) => typeof b.id === "string" && typeof b.goal === "string")
      .map((b) => ({ id: b.id as string, goal: b.goal as string })),
    targetItems: targets
      .filter((t) => typeof t.text === "string")
      .map((t) => ({
        text: t.text as string,
        pron: typeof t.pron === "string" ? t.pron : undefined,
        meaning: typeof t.meaning === "string" ? t.meaning : undefined,
      })),
    level: scenario.level,
    examTask: scenario.exam_task,
    maxMinutes: scenario.max_minutes,
  };
}

export function toPromptPersona(persona: PersonaRow): PromptPersona {
  return {
    name: persona.name,
    displayName: persona.display_name,
    languages: persona.languages,
    personalityPrompt: persona.personality_prompt,
  };
}

/** Voice name for TTS and Live, from the persona's voice JSON. Defaults to a prebuilt voice. */
export function personaVoiceName(persona: PersonaRow): string {
  const voice = typeof persona.voice === "object" && persona.voice !== null ? (persona.voice as Record<string, unknown>) : {};
  return typeof voice.voiceName === "string" && voice.voiceName.trim() ? voice.voiceName.trim() : "Kore";
}

export type SessionContext = {
  session: TutorSessionRow;
  scenario: ScenarioRow;
  persona: PersonaRow;
  courseId: string | null;
  skillLanguage: "zh" | "es" | "fr" | null;
  profileLanguage: string;
  learnerProfile: PromptLearnerProfile;
  lessonText: string;
  history: HistoryTurn[];
};

type SprintContextSnapshot = {
  kind?: string;
  courseId?: string | null;
  courseTitle?: string | null;
  focusObjective?: string | null;
  personaId?: string | null;
  teacherName?: string | null;
  scenario?: {
    title?: string;
    goal?: string;
    beats?: unknown;
    target_items?: unknown;
  };
};

export async function resolveDefaultPersona(
  supabase: ReturnType<typeof createServiceClient>,
  companyId: string,
  preferredPersonaId?: string | null,
): Promise<PersonaRow> {
  if (preferredPersonaId) {
    const { data } = await supabase.from("ai_personas").select("*").eq("id", preferredPersonaId).maybeSingle();
    if (data) return data;
  }

  // Check academy-branded default teacher on tutor_settings when configured.
  const settingsRes = await (supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: unknown) => {
          maybeSingle: () => Promise<{
            data: { default_persona_id?: string | null } | null;
            error: { code?: string; message?: string } | null;
          }>;
        };
      };
    };
  })
    .from("tutor_settings")
    .select("default_persona_id")
    .eq("company_id", companyId)
    .maybeSingle();

  const defaultPersonaId = settingsRes.error ? null : settingsRes.data?.default_persona_id ?? null;
  if (defaultPersonaId) {
    const { data: configured } = await supabase
      .from("ai_personas")
      .select("*")
      .eq("id", defaultPersonaId)
      .maybeSingle();
    if (configured) return configured;
  }

  const { data: tinasheCompany } = await supabase
    .from("ai_personas")
    .select("*")
    .eq("company_id", companyId)
    .ilike("name", DEFAULT_TEACHER_NAME)
    .limit(1)
    .maybeSingle();
  if (tinasheCompany) return tinasheCompany;

  const { data: anyCompany } = await supabase
    .from("ai_personas")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (anyCompany) return anyCompany;

  const { data: tinasheAny } = await supabase
    .from("ai_personas")
    .select("*")
    .ilike("name", DEFAULT_TEACHER_NAME)
    .limit(1)
    .maybeSingle();
  if (tinasheAny) return tinasheAny;

  const { data: anyPersona } = await supabase.from("ai_personas").select("*").limit(1).maybeSingle();
  if (anyPersona) return anyPersona;

  const now = new Date().toISOString();
  return {
    id: "00000000-0000-4000-8000-000000000001",
    company_id: companyId,
    name: DEFAULT_TEACHER_NAME,
    display_name: DEFAULT_TEACHER_NAME,
    languages: ["en"],
    rive_variant: {},
    voice: { voiceName: "Kore" },
    personality_prompt: "Warm, patient Zambian AI teacher who teaches through short examples and quick checks.",
    default_scene: "Scene_Classroom",
    is_active: true,
    created_at: now,
    updated_at: now,
  };
}

export async function loadSessionContext(
  session: TutorSessionRow,
  sprintFallback?: SprintContextSnapshot | null,
): Promise<SessionContext> {
  const supabase = createServiceClient();
  let scenario: ScenarioRow;
  let persona: PersonaRow;
  let courseId: string | null = null;

  if (session.scenario_id) {
    const { data: scenarioRow, error: scenarioError } = await supabase
      .from("practice_scenarios")
      .select("*")
      .eq("id", session.scenario_id)
      .single();
    if (scenarioError || !scenarioRow) throw new Error("scenario not found for session");
    scenario = scenarioRow;
    courseId = scenario.course_id ?? null;

    const { data: personaRow, error: personaError } = scenario.persona_id
      ? await supabase.from("ai_personas").select("*").eq("id", scenario.persona_id).single()
      : { data: null, error: new Error("scenario has no persona") };
    if (personaError || !personaRow) throw new Error("persona not found for scenario");
    persona = personaRow;
  } else {
    // Synthetic Revision Sprint session (scenario_id = null).
    const rawSprint =
      (session as unknown as { sprint_context?: SprintContextSnapshot | null }).sprint_context ??
      sprintFallback ??
      null;
    courseId = rawSprint?.courseId ?? null;
    persona = await resolveDefaultPersona(supabase, session.company_id, rawSprint?.personaId ?? null);
    const teacherName = rawSprint?.teacherName ?? persona.display_name ?? persona.name ?? DEFAULT_TEACHER_NAME;

    let synthetic =
      rawSprint?.scenario?.title && rawSprint?.scenario?.goal
        ? {
            title: rawSprint.scenario.title,
            goal: rawSprint.scenario.goal,
            beats: rawSprint.scenario.beats ?? [],
            target_items: rawSprint.scenario.target_items ?? [],
          }
        : null;

    if (!synthetic) {
      const weak = await loadWeakMasteryRows({
        supabase,
        userId: session.user_id,
        companyId: session.company_id,
        courseId,
        limit: 6,
      });
      const built = buildRevisionSprintScenario({
        personaId: persona.id,
        teacherName,
        weakObjectives: weak,
        courseTitle: rawSprint?.courseTitle ?? null,
        focusObjective: rawSprint?.focusObjective ?? null,
      });
      synthetic = {
        title: built.title,
        goal: built.goal,
        beats: built.beats,
        target_items: built.target_items,
      };
    }

    const now = new Date().toISOString();
    scenario = {
      id: `sprint-${session.id}`,
      company_id: session.company_id,
      course_id: courseId,
      lesson_id: session.lesson_id,
      persona_id: persona.id,
      skill_pack: "general-tutor",
      title: synthetic.title,
      goal: synthetic.goal,
      beats: synthetic.beats as ScenarioRow["beats"],
      target_items: synthetic.target_items as ScenarioRow["target_items"],
      level: null,
      exam_task: null,
      max_minutes: 5,
      allowed_modes: ["voice", "text"],
      scene: "Scene_Classroom",
      visibility: "platform",
      style: "guided_lesson",
      status: "published",
      created_by: session.user_id,
      created_at: now,
      updated_at: now,
    };
  }

  if (!courseId && (session.lesson_id ?? scenario.lesson_id)) {
    const targetLessonId = (session.lesson_id ?? scenario.lesson_id) as string;
    const { data: lessonRow } = await supabase
      .from("lessons")
      .select("module_id")
      .eq("id", targetLessonId)
      .maybeSingle();
    if (lessonRow?.module_id) {
      const { data: moduleRow } = await supabase
        .from("modules")
        .select("course_id")
        .eq("id", lessonRow.module_id)
        .maybeSingle();
      if (moduleRow?.course_id) courseId = moduleRow.course_id;
    }
  }

  const skillLanguage = skillPackLanguage(scenario.skill_pack);
  const language = profileLanguage(skillLanguage, persona.languages);

  const [{ data: profile }, { data: blocks }, { data: turns }] = await Promise.all([
    supabase
      .from("learner_language_profiles")
      .select("level_estimate, memory")
      .eq("company_id", session.company_id)
      .eq("user_id", session.user_id)
      .eq("language", language)
      .maybeSingle(),
    (session.lesson_id ?? scenario.lesson_id)
      ? supabase
          .from("content_blocks")
          .select("type, content")
          .eq("lesson_id", (session.lesson_id ?? scenario.lesson_id) as string)
          .order("position", { ascending: true })
      : Promise.resolve({ data: [] as { type: string; content: unknown }[] }),
    supabase
      .from("tutor_turns")
      .select("idx, learner_text, events")
      .eq("session_id", session.id)
      .order("idx", { ascending: true }),
  ]);

  const memory = parseMemory(profile?.memory);
  const memoryNotes = await loadSessionMemoryNotes({
    supabase,
    userId: session.user_id,
    companyId: session.company_id,
    courseId,
    existingNotes: memory.notes,
  });

  return {
    session,
    scenario,
    persona,
    courseId,
    skillLanguage,
    profileLanguage: language,
    learnerProfile: {
      levelEstimate: profile?.level_estimate ?? scenario.level ?? null,
      recentMistakes: memory.recentMistakes,
      memoryNotes,
    },
    lessonText: blocksToText(blocks ?? [], { maxChars: LESSON_CONTEXT_MAX_CHARS }),
    history: (turns ?? []).map((t) => ({ idx: t.idx, learner_text: t.learner_text, events: t.events })),
  };
}
