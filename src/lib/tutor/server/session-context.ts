import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { blocksToText } from "@/lib/course-blocks/block-to-text";
import type { Database } from "@/types/database";
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

export type LearnerMemory = {
  recentMistakes: { said: string; correct: string; category: string }[];
  notes: string[];
};

export const LESSON_CONTEXT_MAX_CHARS = 24_000;

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
  skillLanguage: "zh" | "es" | "fr" | null;
  profileLanguage: string;
  learnerProfile: PromptLearnerProfile;
  lessonText: string;
  history: HistoryTurn[];
};

export async function loadSessionContext(session: TutorSessionRow): Promise<SessionContext> {
  const supabase = createServiceClient();
  if (!session.scenario_id) throw new Error("session has no scenario");

  const { data: scenario, error: scenarioError } = await supabase
    .from("practice_scenarios")
    .select("*")
    .eq("id", session.scenario_id)
    .single();
  if (scenarioError || !scenario) throw new Error("scenario not found for session");

  const { data: persona, error: personaError } = scenario.persona_id
    ? await supabase.from("ai_personas").select("*").eq("id", scenario.persona_id).single()
    : { data: null, error: new Error("scenario has no persona") };
  if (personaError || !persona) throw new Error("persona not found for scenario");

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

  return {
    session,
    scenario,
    persona,
    skillLanguage,
    profileLanguage: language,
    learnerProfile: {
      levelEstimate: profile?.level_estimate ?? scenario.level ?? null,
      recentMistakes: memory.recentMistakes,
      memoryNotes: memory.notes,
    },
    lessonText: blocksToText(blocks ?? [], { maxChars: LESSON_CONTEXT_MAX_CHARS }),
    history: (turns ?? []).map((t) => ({ idx: t.idx, learner_text: t.learner_text, events: t.events })),
  };
}
