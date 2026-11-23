"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { assertCanManageCourse, assertCanManageLesson } from "@/lib/courses/course-auth-server";
import { ZEDAI_TENANT_ID } from "@/lib/tenants/constants";
import {
  FACE_STYLES,
  HAIR_STYLES,
  OUTFIT_STYLES,
  PROPS,
} from "@/lib/tutor/contract.generated";
import { SCENE_ARTBOARDS, type SceneArtboard } from "@/lib/tutor/rive-driver";
import {
  MODES,
  SCENARIO_STYLES,
  SCENARIO_VISIBILITIES,
  SKILL_PACKS,
  scenarioBeatSchema,
  scenarioTargetItemSchema,
} from "@/lib/tutor/scenario";
import {
  personaLookFromVariant,
  sceneFromValue,
  type TutorPersonaLook,
} from "@/lib/tutor/tutor-session-block";
import { PERSONA_PRESETS } from "@/components/tutor/avatar/persona-presets";
import type { Json } from "@/types/database";

// ─── Shared Auth Helpers ──────────────────────────────────────────────────────

async function assertTenantStaff(companyId: string, userId: string): Promise<{ isSuperAdmin: boolean }> {
  const db = createServiceClient();

  const [{ data: profile }, { data: company }, { data: member }] = await Promise.all([
    db.from("profiles").select("role").eq("id", userId).maybeSingle(),
    db.from("companies").select("admin_id").eq("id", companyId).maybeSingle(),
    db
      .from("company_members")
      .select("role, status")
      .eq("company_id", companyId)
      .eq("profile_id", userId)
      .maybeSingle(),
  ]);

  if (profile?.role === "super_admin") return { isSuperAdmin: true };
  if (company?.admin_id === userId) return { isSuperAdmin: false };
  if (
    member?.status === "active" &&
    ["company_admin", "teacher", "instructor"].includes(member.role)
  ) {
    return { isSuperAdmin: false };
  }

  throw new Error("Unauthorized");
}

/** Resolves the primary academy/company ID for a creator who visits `/creator/ai-teachers`. */
export async function resolveCreatorCompanyContext(): Promise<{
  companyId: string;
  companyName: string;
  companySlug: string;
  isSuperAdmin: boolean;
}> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const db = createServiceClient();
  const [{ data: profile }, { data: membership }] = await Promise.all([
    db.from("profiles").select("role").eq("id", userId).maybeSingle(),
    db
      .from("company_members")
      .select("company_id")
      .eq("profile_id", userId)
      .eq("status", "active")
      .in("role", ["company_admin", "teacher", "instructor"])
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const isSuperAdmin = profile?.role === "super_admin";
  if (membership?.company_id) {
    const { data: comp } = await db
      .from("companies")
      .select("id, name, slug")
      .eq("id", membership.company_id)
      .maybeSingle();
    if (comp) {
      return {
        companyId: comp.id,
        companyName: comp.name,
        companySlug: comp.slug,
        isSuperAdmin,
      };
    }
  }

  // Fallback to platform tenant for platform instructors / super admins
  const { data: zedai } = await db
    .from("companies")
    .select("id, name, slug")
    .eq("id", ZEDAI_TENANT_ID)
    .maybeSingle();

  return {
    companyId: zedai?.id ?? ZEDAI_TENANT_ID,
    companyName: zedai?.name ?? "Zed AI Academy",
    companySlug: zedai?.slug ?? "zedai",
    isSuperAdmin,
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type PersonaRecord = {
  id: string;
  company_id: string;
  name: string;
  display_name: string | null;
  languages: string[];
  rive_variant: Partial<TutorPersonaLook>;
  voice: { provider?: string; voiceName?: string; speakingRate?: number };
  personality_prompt: string;
  default_scene: SceneArtboard | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ScenarioRecord = {
  id: string;
  company_id: string;
  course_id: string | null;
  lesson_id: string | null;
  skill_pack: string;
  persona_id: string | null;
  title: string;
  goal: string;
  beats: Array<{
    id: string;
    goal: string;
    targetItems?: string[];
    boardContent?: string;
    checkQuestion?: string;
  }>;
  target_items: Array<{ text: string; pron?: string; meaning?: string }>;
  level: string | null;
  exam_task: string | null;
  max_minutes: number;
  allowed_modes: ("live" | "voice" | "text")[];
  scene: SceneArtboard | null;
  visibility: "course" | "tenant_library" | "platform";
  style: "scene" | "guided_lesson" | "oral_check";
  status: "draft" | "published" | "archived";
  created_at: string;
  updated_at: string;
  persona: {
    id: string;
    name: string;
    display_name: string | null;
    look: Partial<TutorPersonaLook> | undefined;
  } | null;
};

export type TutorSettingsRecord = {
  company_id: string;
  practice_room_enabled: boolean;
  free_practice_minutes_per_month: number;
  allowed_modes: ("live" | "voice" | "text")[];
  enabled_persona_ids: string[] | null;
};

export type StaffTutorSessionSummary = {
  id: string;
  origin: string;
  mode: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  learner_speaking_ms: number;
  teacher_speaking_ms: number;
  shared_with_teacher: boolean;
  learner_name: string;
  scenario_title: string;
  scores: Record<string, number> | null;
};

export type StaffTutorSessionDetail = StaffTutorSessionSummary & {
  turns: Array<{
    idx: number;
    learner_text: string | null;
    teacher_lines: string[];
    created_at: string;
  }>;
  strengths: string[];
  mistakes: Array<{ said: string; correct: string; category: string; note?: string }>;
};

export type TutorAssignmentSummary = {
  id: string;
  scenario_id: string;
  scenario_title: string;
  group_id: string | null;
  group_name: string | null;
  due_at: string | null;
  created_at: string;
};

export type TenantAiUsageSummary = {
  periodDays: number;
  totalCostUsd: number;
  totalEvents: number;
  byKind: Array<{ kind: string; events: number; units: number; costUsd: number }>;
};

export type StudentSpeakingMetric = {
  sessionsCompleted: number;
  speakingMinutes: number;
  avgScore: number | null;
};

// ─── Validation Schemas ───────────────────────────────────────────────────────

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a 6-digit hex color");

const personaInputSchema = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(80),
  displayName: z.string().trim().max(80).optional().nullable(),
  languages: z.array(z.string().trim().min(1)).default([]),
  look: z.object({
    skinColor: hexColor,
    skinShadeColor: hexColor,
    hairColor: hexColor,
    outfitPrimary: hexColor,
    outfitSecondary: hexColor,
    accentColor: hexColor,
    hairStyle: z.enum(HAIR_STYLES),
    outfitStyle: z.enum(OUTFIT_STYLES),
    prop: z.enum(PROPS),
    faceStyle: z.enum(FACE_STYLES),
    engine: z.enum(["rive", "three", "placeholder"]).optional(),
    glbUrl: z.string().trim().max(500).optional(),
  }),
  voiceName: z.string().trim().min(1).max(60).default("Kore"),
  speakingRate: z.number().min(0.6).max(1.4).default(1.0),
  personalityPrompt: z.string().trim().min(10, "Personality prompt should be at least 10 characters").max(4000),
  defaultScene: z.enum(SCENE_ARTBOARDS).optional().nullable(),
  isActive: z.boolean().default(true),
});

export type UpsertPersonaInput = z.infer<typeof personaInputSchema>;

const authoringBeatSchema = scenarioBeatSchema.extend({
  boardContent: z.string().trim().max(500).optional(),
  checkQuestion: z.string().trim().max(300).optional(),
});

const scenarioInputSchema = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().min(1),
  courseId: z.string().uuid().optional().nullable(),
  lessonId: z.string().uuid().optional().nullable(),
  skillPack: z.enum(SKILL_PACKS),
  personaId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(2, "Title is required").max(140),
  goal: z.string().trim().min(5, "Goal is required").max(600),
  beats: z.array(authoringBeatSchema).default([]),
  targetItems: z.array(scenarioTargetItemSchema).default([]),
  level: z.string().trim().max(40).optional().nullable(),
  examTask: z.string().trim().max(80).optional().nullable(),
  maxMinutes: z.number().int().min(1).max(30).default(8),
  allowedModes: z.array(z.enum(MODES)).min(1).default(["voice", "text"]),
  scene: z.enum(SCENE_ARTBOARDS).optional().nullable(),
  visibility: z.enum(SCENARIO_VISIBILITIES).default("course"),
  style: z.enum(SCENARIO_STYLES).default("scene"),
  status: z.enum(["draft", "published", "archived"]).default("published"),
});

export type UpsertScenarioInput = z.infer<typeof scenarioInputSchema>;

const tutorSettingsSchema = z.object({
  companyId: z.string().min(1),
  practiceRoomEnabled: z.boolean(),
  freePracticeMinutesPerMonth: z.number().int().min(0).max(10000),
  allowedModes: z.array(z.enum(MODES)).min(1),
  enabledPersonaIds: z.array(z.string().uuid()).nullable(),
});

export type UpsertTutorSettingsInput = z.infer<typeof tutorSettingsSchema>;

// ─── Row Mappers ──────────────────────────────────────────────────────────────

function mapPersonaRow(row: Record<string, unknown>): PersonaRecord {
  const voiceRaw = (row.voice ?? {}) as Record<string, unknown>;
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    name: String(row.name),
    display_name: (row.display_name as string | null) ?? null,
    languages: Array.isArray(row.languages) ? (row.languages as string[]) : [],
    rive_variant: personaLookFromVariant(row.rive_variant) ?? {},
    voice: {
      provider: typeof voiceRaw.provider === "string" ? voiceRaw.provider : "gemini",
      voiceName: typeof voiceRaw.voiceName === "string" ? voiceRaw.voiceName : "Kore",
      speakingRate: typeof voiceRaw.speakingRate === "number" ? voiceRaw.speakingRate : 1.0,
    },
    personality_prompt: String(row.personality_prompt ?? ""),
    default_scene: sceneFromValue(row.default_scene) ?? null,
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function mapScenarioRow(row: Record<string, unknown>): ScenarioRecord {
  const rawPersona = row.ai_personas as Record<string, unknown> | null | undefined;
  const modes = Array.isArray(row.allowed_modes)
    ? (row.allowed_modes as string[]).filter((m): m is "live" | "voice" | "text" =>
        m === "live" || m === "voice" || m === "text"
      )
    : (["voice", "text"] as ("live" | "voice" | "text")[]);

  return {
    id: String(row.id),
    company_id: String(row.company_id),
    course_id: (row.course_id as string | null) ?? null,
    lesson_id: (row.lesson_id as string | null) ?? null,
    skill_pack: String(row.skill_pack ?? "general-tutor"),
    persona_id: (row.persona_id as string | null) ?? null,
    title: String(row.title ?? ""),
    goal: String(row.goal ?? ""),
    beats: Array.isArray(row.beats) ? (row.beats as ScenarioRecord["beats"]) : [],
    target_items: Array.isArray(row.target_items) ? (row.target_items as ScenarioRecord["target_items"]) : [],
    level: (row.level as string | null) ?? null,
    exam_task: (row.exam_task as string | null) ?? null,
    max_minutes: typeof row.max_minutes === "number" ? row.max_minutes : 8,
    allowed_modes: modes.length > 0 ? modes : ["voice", "text"],
    scene: sceneFromValue(row.scene) ?? null,
    visibility: (row.visibility as ScenarioRecord["visibility"]) ?? "course",
    style: (row.style as ScenarioRecord["style"]) ?? "scene",
    status: (row.status as ScenarioRecord["status"]) ?? "draft",
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    persona: rawPersona
      ? {
          id: String(rawPersona.id),
          name: String(rawPersona.name),
          display_name: (rawPersona.display_name as string | null) ?? null,
          look: personaLookFromVariant(rawPersona.rive_variant),
        }
      : null,
  };
}

// ─── Starter Cast Definitions ─────────────────────────────────────────────────

const STARTER_PERSONA_META: Record<
  string,
  {
    displayName: string;
    languages: string[];
    voiceName: string;
    defaultScene: SceneArtboard;
    personalityPrompt: string;
  }
> = {
  lin: {
    displayName: "Lín Lǎoshī",
    languages: ["zh", "en"],
    voiceName: "Kore",
    defaultScene: "Scene_TeaHouse",
    personalityPrompt:
      "You are Lín Lǎoshī, a warm, encouraging Mandarin Chinese teacher who meets learners in a sunlit tea house. Speak clearly, model tones gently, celebrate progress, and keep each turn short and conversational.",
  },
  sofia: {
    displayName: "Sofía",
    languages: ["es", "en"],
    voiceName: "Aoede",
    defaultScene: "Scene_Cafe",
    personalityPrompt:
      "You are Sofía, an upbeat, patient Spanish teacher from Seville hosting conversations at a neighbourhood café. Use natural everyday Spanish, recast errors gently, and keep learners speaking confidently.",
  },
  camille: {
    displayName: "Camille",
    languages: ["fr", "en"],
    voiceName: "Leda",
    defaultScene: "Scene_Rooftop",
    personalityPrompt:
      "You are Camille, a friendly French teacher in Paris who loves practical everyday dialogues. Guide pronunciation, liaison, and polite register with warmth and clarity.",
  },
  tendai: {
    displayName: "Nurse Tendai",
    languages: ["en"],
    voiceName: "Sulafat",
    defaultScene: "Scene_Clinic",
    personalityPrompt:
      "You are Nurse Tendai, an empathetic clinical communication trainer in a modern clinic. Coach learners through calm, clear patient intake and workplace communication scenarios.",
  },
  tinashe: {
    displayName: "Tinashe",
    languages: ["en"],
    voiceName: "Puck",
    defaultScene: "Scene_Classroom",
    personalityPrompt:
      "You are Tinashe, an insightful study coach and tutor who helps learners explain concepts out loud, verify understanding, and apply lessons to real-world work.",
  },
};

// ─── Persona Actions ──────────────────────────────────────────────────────────

export async function listPersonasForTenant(companyId: string): Promise<PersonaRecord[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  await assertTenantStaff(companyId, userId);

  const db = createServiceClient();
  const { data, error } = await db
    .from("ai_personas")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapPersonaRow(row as unknown as Record<string, unknown>));
}

export async function listAvailablePersonasForCourse(courseId: string): Promise<{
  companyId: string;
  personas: PersonaRecord[];
}> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  const course = await assertCanManageCourse(supabase, courseId, userId);
  const companyId = course.company_id ?? ZEDAI_TENANT_ID;

  const db = createServiceClient();
  const companyIds = companyId === ZEDAI_TENANT_ID ? [ZEDAI_TENANT_ID] : [companyId, ZEDAI_TENANT_ID];

  const { data, error } = await db
    .from("ai_personas")
    .select("*")
    .in("company_id", companyIds)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return {
    companyId,
    personas: (data ?? []).map((row) => mapPersonaRow(row as unknown as Record<string, unknown>)),
  };
}

export async function upsertPersona(input: UpsertPersonaInput): Promise<PersonaRecord> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = personaInputSchema.parse(input);
  await assertTenantStaff(parsed.companyId, userId);

  const db = createServiceClient();
  const payload = {
    company_id: parsed.companyId,
    name: parsed.name,
    display_name: parsed.displayName || parsed.name,
    languages: parsed.languages,
    rive_variant: parsed.look as unknown as Json,
    voice: {
      provider: "gemini",
      voiceName: parsed.voiceName,
      speakingRate: parsed.speakingRate,
    } as unknown as Json,
    personality_prompt: parsed.personalityPrompt,
    default_scene: parsed.defaultScene ?? "Scene_TeaHouse",
    is_active: parsed.isActive,
  };

  let data: unknown;
  let error: { message: string } | null;

  if (parsed.id) {
    const res = await db
      .from("ai_personas")
      .update(payload)
      .eq("id", parsed.id)
      .eq("company_id", parsed.companyId)
      .select("*")
      .single();
    data = res.data;
    error = res.error;
  } else {
    const res = await db.from("ai_personas").insert(payload).select("*").single();
    data = res.data;
    error = res.error;
  }

  if (error || !data) throw new Error(error?.message ?? "Failed to save AI teacher persona");

  revalidatePath("/creator/ai-teachers");
  revalidatePath("/practice");
  return mapPersonaRow(data as Record<string, unknown>);
}

export async function deletePersona(companyId: string, personaId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  await assertTenantStaff(companyId, userId);

  const db = createServiceClient();
  const { error } = await db
    .from("ai_personas")
    .delete()
    .eq("id", personaId)
    .eq("company_id", companyId);

  if (error) throw new Error(error.message);
  revalidatePath("/creator/ai-teachers");
}

/** Seeds any missing starter cast personas (Lín Lǎoshī, Sofía, Camille, Nurse Tendai, Tinashe) for a tenant. */
export async function seedStarterPersonas(companyId: string): Promise<PersonaRecord[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  await assertTenantStaff(companyId, userId);

  const db = createServiceClient();
  const { data: existing } = await db
    .from("ai_personas")
    .select("name")
    .eq("company_id", companyId);

  const existingNames = new Set((existing ?? []).map((p) => p.name.toLowerCase()));

  const toInsert = PERSONA_PRESETS.filter((preset) => {
    const meta = STARTER_PERSONA_META[preset.key];
    return meta && !existingNames.has(meta.displayName.toLowerCase()) && !existingNames.has(preset.label.toLowerCase());
  }).map((preset) => {
    const meta = STARTER_PERSONA_META[preset.key];
    return {
      company_id: companyId,
      name: meta.displayName,
      display_name: meta.displayName,
      languages: meta.languages,
      rive_variant: preset.look as unknown as Json,
      voice: {
        provider: "gemini",
        voiceName: meta.voiceName,
        speakingRate: 1.0,
      } as unknown as Json,
      personality_prompt: meta.personalityPrompt,
      default_scene: meta.defaultScene,
      is_active: true,
    };
  });

  if (toInsert.length > 0) {
    const { error } = await db.from("ai_personas").insert(toInsert);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/creator/ai-teachers");
  return listPersonasForTenant(companyId);
}

// ─── Scenario Actions ─────────────────────────────────────────────────────────

const SCENARIO_FULL_SELECT =
  "id, company_id, course_id, lesson_id, skill_pack, persona_id, title, goal, beats, target_items, level, exam_task, max_minutes, allowed_modes, scene, visibility, style, status, created_at, updated_at, ai_personas(id, name, display_name, rive_variant)";

export async function listScenariosForCourseStudio(courseId: string): Promise<ScenarioRecord[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await assertCanManageCourse(supabase, courseId, userId);

  const db = createServiceClient();
  const { data, error } = await db
    .from("practice_scenarios")
    .select(SCENARIO_FULL_SELECT)
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapScenarioRow(row as unknown as Record<string, unknown>));
}

export async function listScenariosForTenant(companyId: string): Promise<ScenarioRecord[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  await assertTenantStaff(companyId, userId);

  const db = createServiceClient();
  const { data, error } = await db
    .from("practice_scenarios")
    .select(SCENARIO_FULL_SELECT)
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapScenarioRow(row as unknown as Record<string, unknown>));
}

export async function upsertScenario(input: UpsertScenarioInput): Promise<ScenarioRecord> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = scenarioInputSchema.parse(input);

  // Authorize via course ownership if courseId is given, otherwise tenant staff check.
  if (parsed.courseId) {
    const supabase = createClient();
    await assertCanManageCourse(supabase, parsed.courseId, userId);
  } else {
    await assertTenantStaff(parsed.companyId, userId);
  }

  // Only super admins can publish platform-wide scenarios.
  let visibility = parsed.visibility;
  if (visibility === "platform") {
    const dbCheck = createServiceClient();
    const { data: profile } = await dbCheck.from("profiles").select("role").eq("id", userId).maybeSingle();
    if (profile?.role !== "super_admin") {
      visibility = "tenant_library";
    }
  }

  const db = createServiceClient();
  const updatePayload = {
    course_id: parsed.courseId ?? null,
    lesson_id: parsed.lessonId ?? null,
    skill_pack: parsed.skillPack,
    persona_id: parsed.personaId ?? null,
    title: parsed.title,
    goal: parsed.goal,
    beats: parsed.beats as unknown as Json,
    target_items: parsed.targetItems as unknown as Json,
    level: parsed.level || null,
    exam_task: parsed.examTask || null,
    max_minutes: parsed.maxMinutes,
    allowed_modes: parsed.allowedModes,
    scene: parsed.scene ?? "Scene_TeaHouse",
    visibility,
    style: parsed.style,
    status: parsed.status,
  };

  let data: unknown;
  let error: { message: string } | null;

  if (parsed.id) {
    const res = await db
      .from("practice_scenarios")
      .update(updatePayload)
      .eq("id", parsed.id)
      .eq("company_id", parsed.companyId)
      .select(SCENARIO_FULL_SELECT)
      .single();
    data = res.data;
    error = res.error;
  } else {
    const res = await db
      .from("practice_scenarios")
      .insert({
        ...updatePayload,
        company_id: parsed.companyId,
        created_by: userId,
      })
      .select(SCENARIO_FULL_SELECT)
      .single();
    data = res.data;
    error = res.error;
  }

  if (error || !data) throw new Error(error?.message ?? "Failed to save scenario");

  revalidatePath("/practice");
  revalidatePath("/creator/ai-teachers");
  if (parsed.courseId) {
    revalidatePath(`/creator/courses/${parsed.courseId}`);
  }
  return mapScenarioRow(data as Record<string, unknown>);
}

export async function updateScenarioQuick(
  companyId: string,
  scenarioId: string,
  patch: {
    status?: "draft" | "published" | "archived";
    visibility?: "course" | "tenant_library" | "platform";
  }
): Promise<ScenarioRecord> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  await assertTenantStaff(companyId, userId);

  const db = createServiceClient();
  const { data, error } = await db
    .from("practice_scenarios")
    .update(patch)
    .eq("id", scenarioId)
    .eq("company_id", companyId)
    .select(SCENARIO_FULL_SELECT)
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to update scenario");
  revalidatePath("/practice");
  revalidatePath("/creator/ai-teachers");
  return mapScenarioRow(data as unknown as Record<string, unknown>);
}

export async function deleteScenario(companyId: string, scenarioId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  await assertTenantStaff(companyId, userId);

  const db = createServiceClient();
  const { error } = await db
    .from("practice_scenarios")
    .delete()
    .eq("id", scenarioId)
    .eq("company_id", companyId);

  if (error) throw new Error(error.message);
  revalidatePath("/practice");
  revalidatePath("/creator/ai-teachers");
}

// ─── Tutor Settings Actions ───────────────────────────────────────────────────

export async function getTutorSettings(companyId: string): Promise<TutorSettingsRecord> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  await assertTenantStaff(companyId, userId);

  const db = createServiceClient();
  const { data } = await db
    .from("tutor_settings")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  if (!data) {
    return {
      company_id: companyId,
      practice_room_enabled: true,
      free_practice_minutes_per_month: 60,
      allowed_modes: ["voice", "text"],
      enabled_persona_ids: null,
    };
  }

  return {
    company_id: data.company_id,
    practice_room_enabled: data.practice_room_enabled,
    free_practice_minutes_per_month: data.free_practice_minutes_per_month,
    allowed_modes: (data.allowed_modes as ("live" | "voice" | "text")[]) ?? ["voice", "text"],
    enabled_persona_ids: data.enabled_persona_ids ?? null,
  };
}

export async function upsertTutorSettings(input: UpsertTutorSettingsInput): Promise<TutorSettingsRecord> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = tutorSettingsSchema.parse(input);
  await assertTenantStaff(parsed.companyId, userId);

  const db = createServiceClient();
  const { data, error } = await db
    .from("tutor_settings")
    .upsert(
      {
        company_id: parsed.companyId,
        practice_room_enabled: parsed.practiceRoomEnabled,
        free_practice_minutes_per_month: parsed.freePracticeMinutesPerMonth,
        allowed_modes: parsed.allowedModes,
        enabled_persona_ids: parsed.enabledPersonaIds,
      },
      { onConflict: "company_id" }
    )
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to save tutor settings");
  revalidatePath("/practice");
  return {
    company_id: data.company_id,
    practice_room_enabled: data.practice_room_enabled,
    free_practice_minutes_per_month: data.free_practice_minutes_per_month,
    allowed_modes: (data.allowed_modes as ("live" | "voice" | "text")[]) ?? ["voice", "text"],
    enabled_persona_ids: data.enabled_persona_ids ?? null,
  };
}

// ─── Staff-Visible Tutor Sessions ─────────────────────────────────────────────

export async function listStaffVisibleTutorSessions(
  companyId: string,
  limit = 25
): Promise<StaffTutorSessionSummary[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  await assertTenantStaff(companyId, userId);

  const db = createServiceClient();
  // Privacy split: staff only see lesson/assignment sessions, shared sessions, or flagged sessions.
  const { data, error } = await db
    .from("tutor_sessions")
    .select(
      "id, origin, mode, status, started_at, ended_at, learner_speaking_ms, teacher_speaking_ms, shared_with_teacher, profiles(full_name, email), practice_scenarios(title), tutor_reports(scores)"
    )
    .eq("company_id", companyId)
    .or("origin.in.(lesson,assignment),shared_with_teacher.eq.true,status.eq.flagged")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const r = row as unknown as Record<string, unknown>;
    const prof = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as
      | { full_name?: string | null; email?: string | null }
      | null
      | undefined;
    const scen = (Array.isArray(r.practice_scenarios) ? r.practice_scenarios[0] : r.practice_scenarios) as
      | { title?: string | null }
      | null
      | undefined;
    const rep = (Array.isArray(r.tutor_reports) ? r.tutor_reports[0] : r.tutor_reports) as
      | { scores?: Record<string, number> | null }
      | null
      | undefined;

    return {
      id: String(r.id),
      origin: String(r.origin),
      mode: String(r.mode),
      status: String(r.status),
      started_at: String(r.started_at),
      ended_at: (r.ended_at as string | null) ?? null,
      learner_speaking_ms: Number(r.learner_speaking_ms ?? 0),
      teacher_speaking_ms: Number(r.teacher_speaking_ms ?? 0),
      shared_with_teacher: Boolean(r.shared_with_teacher),
      learner_name: prof?.full_name || prof?.email || "Learner",
      scenario_title: scen?.title || "Free practice",
      scores: rep?.scores ?? null,
    };
  });
}

// ─── Staff Session Transcript & Report Detail ─────────────────────────────────

export async function getStaffTutorSessionDetail(
  companyId: string,
  sessionId: string,
): Promise<StaffTutorSessionDetail | null> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  await assertTenantStaff(companyId, userId);

  const db = createServiceClient();
  const { data: session } = await db
    .from("tutor_sessions")
    .select(
      "id, company_id, user_id, scenario_id, origin, mode, status, started_at, ended_at, learner_speaking_ms, teacher_speaking_ms, shared_with_teacher",
    )
    .eq("id", sessionId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!session) return null;
  const visible =
    session.origin === "lesson" ||
    session.origin === "assignment" ||
    session.shared_with_teacher ||
    session.status === "flagged";
  if (!visible) throw new Error("Session is private to the learner");

  const [{ data: profile }, { data: scenario }, { data: report }, { data: turns }] = await Promise.all([
    db.from("profiles").select("full_name, email").eq("id", session.user_id).maybeSingle(),
    session.scenario_id
      ? db.from("practice_scenarios").select("title").eq("id", session.scenario_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from("tutor_reports")
      .select("scores, strengths, mistakes")
      .eq("session_id", sessionId)
      .maybeSingle(),
    db
      .from("tutor_turns")
      .select("idx, learner_text, events, created_at")
      .eq("session_id", sessionId)
      .order("idx", { ascending: true }),
  ]);

  const parsedScores: Record<string, number> | null =
    report?.scores && typeof report.scores === "object" && !Array.isArray(report.scores)
      ? Object.fromEntries(
          Object.entries(report.scores as Record<string, unknown>).filter(
            (entry): entry is [string, number] => typeof entry[1] === "number",
          ),
        )
      : null;

  const parsedTurns = (turns ?? []).map((t) => {
    const rawEvents = Array.isArray(t.events) ? (t.events as Array<Record<string, unknown>>) : [];
    const teacherLines = rawEvents
      .filter((ev) => ev?.type === "say" && typeof ev.text === "string")
      .map((ev) => String(ev.text));
    return {
      idx: t.idx,
      learner_text: t.learner_text,
      teacher_lines: teacherLines,
      created_at: t.created_at,
    };
  });

  return {
    id: session.id,
    origin: session.origin,
    mode: session.mode,
    status: session.status,
    started_at: session.started_at,
    ended_at: session.ended_at,
    learner_speaking_ms: session.learner_speaking_ms,
    teacher_speaking_ms: session.teacher_speaking_ms,
    shared_with_teacher: session.shared_with_teacher,
    learner_name: profile?.full_name || profile?.email || "Learner",
    scenario_title: scenario?.title || "Free practice",
    scores: parsedScores,
    turns: parsedTurns,
    strengths: Array.isArray(report?.strengths)
      ? (report.strengths as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
    mistakes: Array.isArray(report?.mistakes)
      ? (report.mistakes as Array<{ said: string; correct: string; category: string; note?: string }>)
      : [],
  };
}

// ─── Tutor Assignments (Teacher -> Class/Academy) ─────────────────────────────

export async function listClassroomGroupsForTenant(
  companyId: string,
): Promise<Array<{ id: string; name: string }>> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  await assertTenantStaff(companyId, userId);

  const db = createServiceClient();
  const { data } = await db
    .from("classroom_groups")
    .select("id, name")
    .eq("company_id", companyId)
    .order("name", { ascending: true });

  return (data ?? []).map((g) => ({ id: g.id, name: g.name }));
}

export async function listTutorAssignmentsForTenant(
  companyId: string,
): Promise<TutorAssignmentSummary[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  await assertTenantStaff(companyId, userId);

  const db = createServiceClient();
  const { data: rows, error } = await db
    .from("tutor_assignments")
    .select("id, scenario_id, group_id, due_at, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  const list = rows ?? [];
  if (list.length === 0) return [];

  const scenarioIds = [...new Set(list.map((r) => r.scenario_id))];
  const groupIds = [...new Set(list.map((r) => r.group_id).filter((id): id is string => Boolean(id)))];

  const [{ data: scenarios }, { data: groups }] = await Promise.all([
    db.from("practice_scenarios").select("id, title").in("id", scenarioIds),
    groupIds.length
      ? db.from("classroom_groups").select("id, name").in("id", groupIds)
      : Promise.resolve({ data: [] }),
  ]);

  const scMap = new Map((scenarios ?? []).map((s) => [s.id, s.title]));
  const grMap = new Map((groups ?? []).map((g) => [g.id, g.name]));

  return list.map((r) => ({
    id: r.id,
    scenario_id: r.scenario_id,
    scenario_title: scMap.get(r.scenario_id) ?? "Speaking Scenario",
    group_id: r.group_id,
    group_name: r.group_id ? (grMap.get(r.group_id) ?? "Cohort") : null,
    due_at: r.due_at,
    created_at: r.created_at,
  }));
}

export async function createTutorAssignment(input: {
  companyId: string;
  scenarioId: string;
  groupId?: string | null;
  dueAt?: string | null;
}): Promise<TutorAssignmentSummary> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  await assertTenantStaff(input.companyId, userId);

  const db = createServiceClient();
  const { data, error } = await db
    .from("tutor_assignments")
    .insert({
      company_id: input.companyId,
      scenario_id: input.scenarioId,
      group_id: input.groupId || null,
      due_at: input.dueAt ? new Date(input.dueAt).toISOString() : null,
      assigned_by: userId,
    })
    .select("id, scenario_id, group_id, due_at, created_at")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Could not create speaking assignment");

  const [{ data: sc }, { data: gr }] = await Promise.all([
    db.from("practice_scenarios").select("title").eq("id", data.scenario_id).maybeSingle(),
    data.group_id
      ? db.from("classroom_groups").select("name").eq("id", data.group_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  revalidatePath("/practice");
  revalidatePath("/creator/ai-teachers");
  return {
    id: data.id,
    scenario_id: data.scenario_id,
    scenario_title: sc?.title ?? "Speaking Scenario",
    group_id: data.group_id,
    group_name: gr?.name ?? null,
    due_at: data.due_at,
    created_at: data.created_at,
  };
}

export async function deleteTutorAssignment(companyId: string, assignmentId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  await assertTenantStaff(companyId, userId);

  const db = createServiceClient();
  const { error } = await db
    .from("tutor_assignments")
    .delete()
    .eq("id", assignmentId)
    .eq("company_id", companyId);
  if (error) throw new Error(error.message);

  revalidatePath("/practice");
  revalidatePath("/creator/ai-teachers");
}

// ─── AI Usage & Cost Dashboard (Last 30 Days) ─────────────────────────────────

export async function getTenantAiUsageSummary(
  companyId: string,
  periodDays = 30,
): Promise<TenantAiUsageSummary> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  await assertTenantStaff(companyId, userId);

  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
  const db = createServiceClient();
  const { data } = await db
    .from("ai_usage_ledger")
    .select("kind, units, est_cost_usd")
    .eq("company_id", companyId)
    .gte("created_at", since)
    .limit(5000);

  const byKindMap = new Map<string, { events: number; units: number; costUsd: number }>();
  let totalCostUsd = 0;
  let totalEvents = 0;

  for (const row of data ?? []) {
    const cost = Number(row.est_cost_usd ?? 0);
    const units = Number(row.units ?? 0);
    totalCostUsd += cost;
    totalEvents += 1;
    const prev = byKindMap.get(row.kind) ?? { events: 0, units: 0, costUsd: 0 };
    byKindMap.set(row.kind, {
      events: prev.events + 1,
      units: prev.units + units,
      costUsd: prev.costUsd + cost,
    });
  }

  return {
    periodDays,
    totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
    totalEvents,
    byKind: [...byKindMap.entries()]
      .map(([kind, v]) => ({
        kind,
        events: v.events,
        units: v.units,
        costUsd: Math.round(v.costUsd * 10000) / 10000,
      }))
      .sort((a, b) => b.costUsd - a.costUsd),
  };
}

// ─── Gradebook Speaking Metrics per Student ───────────────────────────────────

export async function getTenantStudentSpeakingMetrics(
  companyId: string,
): Promise<Record<string, StudentSpeakingMetric>> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  await assertTenantStaff(companyId, userId);

  const db = createServiceClient();
  const { data: sessions } = await db
    .from("tutor_sessions")
    .select("id, user_id, learner_speaking_ms, status")
    .eq("company_id", companyId)
    .eq("status", "completed")
    .limit(2000);

  const rows = sessions ?? [];
  if (rows.length === 0) return {};

  const sessionIds = rows.map((r) => r.id);
  const { data: reports } = await db
    .from("tutor_reports")
    .select("session_id, scores")
    .in("session_id", sessionIds);

  const scoreBySession = new Map<string, number>();
  for (const rep of reports ?? []) {
    if (rep.scores && typeof rep.scores === "object" && !Array.isArray(rep.scores)) {
      const vals = Object.values(rep.scores as Record<string, unknown>).filter(
        (v): v is number => typeof v === "number",
      );
      if (vals.length > 0) {
        scoreBySession.set(rep.session_id, vals.reduce((a, b) => a + b, 0) / vals.length);
      }
    }
  }

  const acc = new Map<string, { count: number; ms: number; scoreSum: number; scoreCount: number }>();
  for (const s of rows) {
    const prev = acc.get(s.user_id) ?? { count: 0, ms: 0, scoreSum: 0, scoreCount: 0 };
    const sc = scoreBySession.get(s.id);
    acc.set(s.user_id, {
      count: prev.count + 1,
      ms: prev.ms + (s.learner_speaking_ms ?? 0),
      scoreSum: prev.scoreSum + (sc ?? 0),
      scoreCount: prev.scoreCount + (sc !== undefined ? 1 : 0),
    });
  }

  const out: Record<string, StudentSpeakingMetric> = {};
  for (const [uid, v] of acc.entries()) {
    out[uid] = {
      sessionsCompleted: v.count,
      speakingMinutes: Math.round(v.ms / 60000),
      avgScore: v.scoreCount > 0 ? Math.round(v.scoreSum / v.scoreCount) : null,
    };
  }
  return out;
}

// ─── Course Publish Sync & Teacher Moments ────────────────────────────────────

/**
 * Publishes any draft course-scoped flows (and teacher moments, if migrated) when a course is published.
 */
export async function publishCourseDraftFlows(courseId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await assertCanManageCourse(supabase, courseId, userId);

  const db = createServiceClient();
  await db
    .from("practice_scenarios")
    .update({ status: "published" })
    .eq("course_id", courseId)
    .eq("visibility", "course")
    .eq("status", "draft");

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .from("teacher_moments")
      .update({ status: "published" })
      .eq("course_id", courseId)
      .eq("status", "draft");
  } catch {
    // teacher_moments migration may not be applied yet; ignore safely.
  }

  revalidatePath(`/creator/courses/${courseId}`);
}

export type TeacherMomentRecord = {
  id: string;
  company_id: string;
  course_id: string;
  lesson_id: string;
  scenario_id: string;
  after_block_id: string | null;
  position: number;
  title: string | null;
  prompt: string | null;
  required: boolean;
  status: "draft" | "published" | "archived";
  scenario_title: string | null;
  scenario_style: string | null;
  persona_name: string | null;
};

const teacherMomentInputSchema = z.object({
  id: z.string().uuid().optional(),
  courseId: z.string().uuid(),
  lessonId: z.string().uuid(),
  scenarioId: z.string().uuid(),
  afterBlockId: z.string().uuid().nullable().optional(),
  position: z.number().int().min(0).default(1),
  title: z.string().trim().max(120).optional().nullable(),
  prompt: z.string().trim().max(400).optional().nullable(),
  required: z.boolean().default(false),
  status: z.enum(["draft", "published", "archived"]).default("published"),
});

export type UpsertTeacherMomentInput = z.infer<typeof teacherMomentInputSchema>;

function isMissingRelationError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return err.code === "42P01" || Boolean(err.message?.includes("teacher_moments"));
}

function mapMomentRow(row: Record<string, unknown>): TeacherMomentRecord {
  const scen = (Array.isArray(row.practice_scenarios) ? row.practice_scenarios[0] : row.practice_scenarios) as
    | { title?: string | null; style?: string | null; ai_personas?: { display_name?: string | null; name?: string | null } | null }
    | null
    | undefined;
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    course_id: String(row.course_id),
    lesson_id: String(row.lesson_id),
    scenario_id: String(row.scenario_id),
    after_block_id: (row.after_block_id as string | null) ?? null,
    position: Number(row.position ?? 1),
    title: (row.title as string | null) ?? null,
    prompt: (row.prompt as string | null) ?? null,
    required: Boolean(row.required),
    status: (row.status as TeacherMomentRecord["status"]) ?? "published",
    scenario_title: scen?.title ?? null,
    scenario_style: scen?.style ?? null,
    persona_name: scen?.ai_personas?.display_name ?? scen?.ai_personas?.name ?? null,
  };
}

export async function listTeacherMomentsForLesson(
  lessonId: string,
  courseId: string,
): Promise<{ available: boolean; moments: TeacherMomentRecord[] }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await assertCanManageLesson(supabase, lessonId, userId, courseId);

  const db = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("teacher_moments")
    .select("id, company_id, course_id, lesson_id, scenario_id, after_block_id, position, title, prompt, required, status, practice_scenarios(title, style, ai_personas(name, display_name))")
    .eq("lesson_id", lessonId)
    .eq("course_id", courseId)
    .order("position", { ascending: true });

  if (error) {
    if (isMissingRelationError(error)) return { available: false, moments: [] };
    throw new Error(error.message);
  }

  return {
    available: true,
    moments: ((data ?? []) as Record<string, unknown>[]).map(mapMomentRow),
  };
}

export async function upsertTeacherMoment(input: UpsertTeacherMomentInput): Promise<TeacherMomentRecord> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = teacherMomentInputSchema.parse(input);
  const supabase = createClient();
  await assertCanManageLesson(supabase, parsed.lessonId, userId, parsed.courseId);

  const db = createServiceClient();
  const { data: course } = await db
    .from("courses")
    .select("company_id")
    .eq("id", parsed.courseId)
    .single();
  const companyId = course?.company_id ?? ZEDAI_TENANT_ID;

  const payload = {
    company_id: companyId,
    course_id: parsed.courseId,
    lesson_id: parsed.lessonId,
    scenario_id: parsed.scenarioId,
    after_block_id: parsed.afterBlockId ?? null,
    position: parsed.position,
    title: parsed.title?.trim() || null,
    prompt: parsed.prompt?.trim() || null,
    required: parsed.required,
    status: parsed.status,
  };

  const selectCols =
    "id, company_id, course_id, lesson_id, scenario_id, after_block_id, position, title, prompt, required, status, practice_scenarios(title, style, ai_personas(name, display_name))";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = (db as any).from("teacher_moments");
  const res = parsed.id
    ? await table.update(payload).eq("id", parsed.id).eq("lesson_id", parsed.lessonId).select(selectCols).single()
    : await table.insert({ ...payload, created_by: userId }).select(selectCols).single();

  if (res.error || !res.data) {
    if (isMissingRelationError(res.error)) {
      throw new Error("Teacher moments require applying migration 20261122000000_teacher_moments.sql first.");
    }
    throw new Error(res.error?.message ?? "Failed to save teacher moment");
  }

  revalidatePath(`/creator/courses/${parsed.courseId}/lessons/${parsed.lessonId}`);
  return mapMomentRow(res.data as Record<string, unknown>);
}

export async function deleteTeacherMoment(momentId: string, lessonId: string, courseId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await assertCanManageLesson(supabase, lessonId, userId, courseId);

  const db = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any)
    .from("teacher_moments")
    .delete()
    .eq("id", momentId)
    .eq("lesson_id", lessonId);

  if (error && !isMissingRelationError(error)) {
    throw new Error(error.message);
  }
  revalidatePath(`/creator/courses/${courseId}/lessons/${lessonId}`);
}

