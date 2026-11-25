"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { assertCanManageCourse, assertCanManageLesson } from "@/lib/courses/course-auth-server";
import { ZEDAI_TENANT_ID } from "@/lib/tenants/constants";
import { courseTenantId } from "@/lib/authz/refs";
import { assertTenantRefs } from "@/lib/authz/refs-server";
import { requireTenantStaff } from "@/lib/authz/context-server";
import {
  FACE_STYLES,
  HAIR_STYLES,
  OUTFIT_STYLES,
  PROPS,
} from "@/lib/tutor/contract.generated";
import { SCENE_ARTBOARDS, type SceneArtboard } from "@/lib/tutor/rive-driver";
import { buildFixItFlowFromMisconception } from "@/lib/tutor/authoring/fix-it";
import { parsePronunciationGlossary, type PronunciationEntry } from "@/lib/tutor/pronunciation";
import {
  ALL_SKILL_PACKS,
  MODES,
  SCENARIO_STYLES,
  SCENARIO_VISIBILITIES,
  scenarioBeatSchema,
  scenarioTargetItemSchema,
} from "@/lib/tutor/scenario";
import {
  personaLookFromVariant,
  sceneFromValue,
  type TutorPersonaLook,
} from "@/lib/tutor/tutor-session-block";
import { ALL_PERSONA_PRESETS } from "@/components/tutor/avatar/persona-presets";
import { isSchemaUnavailableError } from "@/lib/tutor/mastery/server";
import { planRestore, type ScenarioVersionSummary } from "@/lib/tutor/authoring/versions";
import {
  archiveScenario,
  listScenarioVersionSummaries,
  loadScenarioVersions,
  recordScenarioVersion,
  withoutArchived,
} from "@/lib/tutor/authoring/versions-server";
import type { Database, Json } from "@/types/database";

// ─── Shared Auth Helpers ──────────────────────────────────────────────────────

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
  voice: {
    provider?: string;
    voiceName?: string;
    speakingRate?: number;
    pronunciationGlossary?: PronunciationEntry[];
  };
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
  default_persona_id?: string | null;
  brand_look?: Partial<TutorPersonaLook> | null;
};

export type TeacherSessionReview = {
  notes: string;
  reviewed_by: string;
  reviewed_by_name: string | null;
  reviewed_at: string;
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
  has_teacher_review?: boolean;
  teacher_review_notes?: string | null;
  teacher_reviewed_at?: string | null;
};

export type TutorTurnTranscriptItem = {
  id: string;
  idx: number;
  learner_text: string | null;
  learner_audio_ms: number | null;
  latency_ms: number | null;
  created_at: string;
  teacher_says: Array<{
    text: string;
    romanization?: string;
    translation?: string;
  }>;
  mistakes_noted: Array<{
    said: string;
    correct: string;
    category: string;
  }>;
  other_events: Array<{
    type: string;
    summary: string;
  }>;
};

export type StaffTutorSessionDetail = {
  id: string;
  company_id: string;
  user_id: string;
  origin: string;
  mode: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  learner_speaking_ms: number;
  teacher_speaking_ms: number;
  shared_with_teacher: boolean;
  learner: {
    id: string;
    full_name: string;
    email: string | null;
    avatar_url: string | null;
  };
  scenario: {
    id: string | null;
    title: string;
    goal: string | null;
    skill_pack: string | null;
    style: string | null;
  };
  turns: TutorTurnTranscriptItem[];
  report: {
    scores: Record<string, number>;
    strengths: string[];
    mistakes: Array<{ said: string; correct: string; category: string; note?: string }>;
    teacher_review: TeacherSessionReview | null;
  } | null;
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
  pronunciationGlossary: z
    .array(
      z.object({
        term: z.string().trim().min(1).max(60),
        spoken: z.string().trim().min(1).max(80),
      }),
    )
    .max(30)
    .optional(),
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
  skillPack: z.enum(ALL_SKILL_PACKS),
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
  defaultPersonaId: z.string().uuid().nullable().optional(),
  brandLook: z.record(z.string(), z.unknown()).nullable().optional(),
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
      pronunciationGlossary: parsePronunciationGlossary(voiceRaw.pronunciationGlossary),
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
  mwila: {
    displayName: "Mwila",
    languages: ["en", "bem"],
    voiceName: "Kore",
    defaultScene: "Scene_Studio",
    personalityPrompt:
      "You are Mwila, a sharp practical AI workflow coach from Lusaka. Guide learners with real Zambian SME, farming, and office examples, short prompt challenges, and crisp feedback.",
  },
  banda: {
    displayName: "Banda",
    languages: ["en", "ny"],
    voiceName: "Charon",
    defaultScene: "Scene_Classroom",
    personalityPrompt:
      "You are Banda, a steady, encouraging mentor who checks foundational concepts step by step using everyday commerce, finance, and workplace analogies.",
  },
  amina: {
    displayName: "Amina",
    languages: ["en", "fr"],
    voiceName: "Aoede",
    defaultScene: "Scene_Studio",
    personalityPrompt:
      "You are Amina, an articulate communication and entrepreneurship coach who helps learners defend ideas clearly, structure persuasive answers, and shine in oral checks.",
  },
  chanda: {
    displayName: "Chanda",
    languages: ["en", "bem", "tog"],
    voiceName: "Fenrir",
    defaultScene: "Scene_Classroom",
    personalityPrompt:
      "You are Chanda, a hands-on technical and numeracy coach who breaks tricky problems into simple steps and celebrates clear reasoning.",
  },
};

// ─── Persona Actions ──────────────────────────────────────────────────────────

export async function listPersonasForTenant(companyId: string): Promise<PersonaRecord[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  await requireTenantStaff(companyId, userId);

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
  await requireTenantStaff(parsed.companyId, userId);

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
      ...(parsed.pronunciationGlossary && parsed.pronunciationGlossary.length > 0
        ? { pronunciationGlossary: parsed.pronunciationGlossary }
        : {}),
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
  await requireTenantStaff(companyId, userId);

  const db = createServiceClient();
  const { error } = await db
    .from("ai_personas")
    .delete()
    .eq("id", personaId)
    .eq("company_id", companyId);

  if (error) throw new Error(error.message);
  revalidatePath("/creator/ai-teachers");
}

const fixItSchema = z.object({
  companyId: z.string().min(1),
  courseId: z.string().uuid().optional().nullable(),
  objectiveText: z.string().trim().min(2).max(200),
  sampleDetails: z.array(z.string().max(400)).max(8).default([]),
  misconceptionCount: z.number().int().min(0).default(0),
  partialCount: z.number().int().min(0).default(0),
});

/**
 * 1-click Remediation Action from Teacher Insights:
 * Builds and publishes a targeted 3-minute Fix-It micro-flow from a recurring misconception cluster.
 */
export async function createFixItFlowFromMisconception(
  input: z.input<typeof fixItSchema>,
): Promise<{ id: string; title: string }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = fixItSchema.parse(input);
  await requireTenantStaff(parsed.companyId, userId);
  await assertTenantRefs(parsed.companyId, { courseId: parsed.courseId ?? null });

  const db = createServiceClient();
  const { data: personaRow } = await db
    .from("ai_personas")
    .select("id")
    .eq("company_id", parsed.companyId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const generated = buildFixItFlowFromMisconception({
    objectiveText: parsed.objectiveText,
    sampleDetails: parsed.sampleDetails,
    misconceptionCount: parsed.misconceptionCount,
    partialCount: parsed.partialCount,
  });

  const { data, error } = await db
    .from("practice_scenarios")
    .insert({
      company_id: parsed.companyId,
      course_id: parsed.courseId ?? null,
      persona_id: personaRow?.id ?? null,
      skill_pack: generated.skillPack,
      title: generated.title,
      goal: generated.goal,
      beats: generated.beats as unknown as Json,
      target_items: generated.targetItems as unknown as Json,
      level: generated.level,
      max_minutes: generated.maxMinutes,
      allowed_modes: ["voice", "text"],
      scene: generated.scene,
      visibility: parsed.courseId ? "course" : "tenant_library",
      style: generated.style,
      status: "published",
      created_by: userId,
    })
    .select("id, title")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Could not create Fix-It flow");

  revalidatePath("/creator/ai-teachers");
  revalidatePath("/practice");
  return { id: String(data.id), title: String(data.title) };
}

/** Seeds any missing starter cast personas (Lín Lǎoshī, Sofía, Camille, Nurse Tendai, Tinashe) for a tenant. */
export async function seedStarterPersonas(companyId: string): Promise<PersonaRecord[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  await requireTenantStaff(companyId, userId);

  const db = createServiceClient();
  const { data: existing } = await db
    .from("ai_personas")
    .select("name")
    .eq("company_id", companyId);

  const existingNames = new Set((existing ?? []).map((p) => p.name.toLowerCase()));

  const toInsert = ALL_PERSONA_PRESETS.filter((preset) => {
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
  const { data, error } = await withoutArchived((hideArchived) => {
    const query = db.from("practice_scenarios").select(SCENARIO_FULL_SELECT).eq("course_id", courseId);
    return (hideArchived ? query.is("archived_at", null) : query).order("created_at", { ascending: false });
  });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapScenarioRow(row as unknown as Record<string, unknown>));
}

export async function listScenariosForTenant(companyId: string): Promise<ScenarioRecord[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  await requireTenantStaff(companyId, userId);

  const db = createServiceClient();
  const { data, error } = await withoutArchived((hideArchived) => {
    const query = db.from("practice_scenarios").select(SCENARIO_FULL_SELECT).eq("company_id", companyId);
    return (hideArchived ? query.is("archived_at", null) : query).order("updated_at", { ascending: false });
  });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapScenarioRow(row as unknown as Record<string, unknown>));
}

export async function upsertScenario(input: UpsertScenarioInput): Promise<ScenarioRecord> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = scenarioInputSchema.parse(input);

  // Authorize via course ownership if courseId is given, otherwise tenant staff check. The tenant is
  // derived from the course, never taken from the client, so a course manager cannot write into
  // another academy by passing its companyId.
  let companyId = parsed.companyId;
  if (parsed.courseId) {
    const supabase = createClient();
    const course = await assertCanManageCourse(supabase, parsed.courseId, userId);
    companyId = courseTenantId(course.company_id, ZEDAI_TENANT_ID);
  } else {
    await requireTenantStaff(companyId, userId);
  }
  await assertTenantRefs(companyId, {
    courseId: parsed.courseId ?? null,
    lessonId: parsed.lessonId ?? null,
    personaId: parsed.personaId ?? null,
  });

  if (parsed.id && parsed.courseId) {
    // Course managers may only edit flows of their own course; other tenant flows need tenant staff.
    const { data: existing } = await createServiceClient()
      .from("practice_scenarios")
      .select("course_id")
      .eq("id", parsed.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!existing) throw new Error("Scenario not found");
    if (existing.course_id && existing.course_id !== parsed.courseId) {
      await requireTenantStaff(companyId, userId);
    }
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
      .eq("company_id", companyId)
      .select(SCENARIO_FULL_SELECT)
      .single();
    data = res.data;
    error = res.error;
  } else {
    const res = await db
      .from("practice_scenarios")
      .insert({
        ...updatePayload,
        company_id: companyId,
        created_by: userId,
      })
      .select(SCENARIO_FULL_SELECT)
      .single();
    data = res.data;
    error = res.error;
  }

  if (error || !data) throw new Error(error?.message ?? "Failed to save scenario");

  // Every save is a new published version; running sessions stay on the version they pinned.
  await recordScenarioVersion(db, { row: data as Record<string, unknown>, userId });

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
  await requireTenantStaff(companyId, userId);

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
  await requireTenantStaff(companyId, userId);

  const db = createServiceClient();
  // Soft delete, so sessions, reports and history that reference the flow keep working.
  // Before the versioning migration is applied there is no archived_at column: hard delete as before.
  const archived = await archiveScenario(db, { scenarioId, companyId });
  if (!archived) {
    const { error } = await db
      .from("practice_scenarios")
      .delete()
      .eq("id", scenarioId)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/practice");
  revalidatePath("/creator/ai-teachers");
}

// ─── Flow Versions ────────────────────────────────────────────────────────────

/**
 * Loads a flow and checks the caller may edit it. The tenant comes from the flow row, never the client:
 * course flows need course management rights, other flows need tenant staff.
 */
async function authorizeScenarioEditor(
  scenarioId: string,
  userId: string,
): Promise<{ companyId: string; courseId: string | null }> {
  const { data } = await createServiceClient()
    .from("practice_scenarios")
    .select("id, company_id, course_id")
    .eq("id", scenarioId)
    .maybeSingle();
  if (!data) throw new Error("Scenario not found");
  if (data.course_id) {
    await assertCanManageCourse(createClient(), data.course_id, userId);
  } else {
    await assertTenantStaff(data.company_id, userId);
  }
  return { companyId: data.company_id, courseId: data.course_id };
}

export async function listScenarioVersions(scenarioId: string): Promise<{
  available: boolean;
  publishedVersion: number | null;
  versions: ScenarioVersionSummary[];
}> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const id = z.string().uuid().parse(scenarioId);
  await authorizeScenarioEditor(id, userId);
  return listScenarioVersionSummaries(createServiceClient(), id);
}

/** Restores an old version by publishing its snapshot as a new version. History is never rewritten. */
export async function restoreScenarioVersion(scenarioId: string, version: number): Promise<ScenarioRecord> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const id = z.string().uuid().parse(scenarioId);
  const target = z.number().int().min(1).parse(version);
  const { companyId, courseId } = await authorizeScenarioEditor(id, userId);

  const db = createServiceClient();
  const { available, rows } = await loadScenarioVersions(db, id);
  if (!available) throw new Error("Flow versions are not available yet.");
  const plan = planRestore({ target, versions: rows });
  if (!plan.ok) throw new Error(plan.reason === "version_not_found" ? "Version not found" : "That version cannot be restored");

  const patch: Record<string, unknown> = { ...plan.snapshot };
  if (typeof patch.persona_id === "string") {
    // The old persona may have been deleted or moved; keep the current one rather than failing the restore.
    try {
      await assertTenantRefs(companyId, { personaId: patch.persona_id });
    } catch {
      delete patch.persona_id;
    }
  }

  const { data, error } = await db
    .from("practice_scenarios")
    .update(patch as Database["public"]["Tables"]["practice_scenarios"]["Update"])
    .eq("id", id)
    .eq("company_id", companyId)
    .select(SCENARIO_FULL_SELECT)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to restore version");

  await recordScenarioVersion(db, { row: data as unknown as Record<string, unknown>, userId, note: plan.note, forceNew: true });

  revalidatePath("/practice");
  revalidatePath("/creator/ai-teachers");
  if (courseId) revalidatePath(`/creator/courses/${courseId}`);
  return mapScenarioRow(data as unknown as Record<string, unknown>);
}

// ─── Tutor Settings Actions ───────────────────────────────────────────────────

export async function getTutorSettings(companyId: string): Promise<TutorSettingsRecord> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  await requireTenantStaff(companyId, userId);

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
      default_persona_id: null,
      brand_look: null,
    };
  }

  const rawRow = data as unknown as Record<string, unknown>;
  return {
    company_id: data.company_id,
    practice_room_enabled: data.practice_room_enabled,
    free_practice_minutes_per_month: data.free_practice_minutes_per_month,
    allowed_modes: (data.allowed_modes as ("live" | "voice" | "text")[]) ?? ["voice", "text"],
    enabled_persona_ids: data.enabled_persona_ids ?? null,
    default_persona_id: (rawRow.default_persona_id as string | null) ?? null,
    brand_look: personaLookFromVariant(rawRow.brand_look) ?? null,
  };
}

export async function upsertTutorSettings(input: UpsertTutorSettingsInput): Promise<TutorSettingsRecord> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = tutorSettingsSchema.parse(input);
  await requireTenantStaff(parsed.companyId, userId);

  const db = createServiceClient();
  const basePayload = {
    company_id: parsed.companyId,
    practice_room_enabled: parsed.practiceRoomEnabled,
    free_practice_minutes_per_month: parsed.freePracticeMinutesPerMonth,
    allowed_modes: parsed.allowedModes,
    enabled_persona_ids: parsed.enabledPersonaIds,
  };

  let res = await db
    .from("tutor_settings")
    .upsert(
      {
        ...basePayload,
        ...(parsed.defaultPersonaId !== undefined ? { default_persona_id: parsed.defaultPersonaId } : {}),
        ...(parsed.brandLook !== undefined ? { brand_look: (parsed.brandLook ?? {}) as Json } : {}),
      } as typeof basePayload,
      { onConflict: "company_id" }
    )
    .select("*")
    .single();

  if (res.error && isSchemaUnavailableError(res.error)) {
    res = await db
      .from("tutor_settings")
      .upsert(basePayload, { onConflict: "company_id" })
      .select("*")
      .single();
  }

  if (res.error || !res.data) throw new Error(res.error?.message ?? "Failed to save tutor settings");
  const rawRow = res.data as unknown as Record<string, unknown>;
  revalidatePath("/practice");
  return {
    company_id: res.data.company_id,
    practice_room_enabled: res.data.practice_room_enabled,
    free_practice_minutes_per_month: res.data.free_practice_minutes_per_month,
    allowed_modes: (res.data.allowed_modes as ("live" | "voice" | "text")[]) ?? ["voice", "text"],
    enabled_persona_ids: res.data.enabled_persona_ids ?? null,
    default_persona_id: (rawRow.default_persona_id as string | null) ?? null,
    brand_look: personaLookFromVariant(rawRow.brand_look) ?? null,
  };
}

/** Fetches the academy primary brand color for 1-click teacher outfit branding. */
export async function getTenantBrandColor(companyId: string): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  await requireTenantStaff(companyId, userId);

  const db = createServiceClient();
  const { data } = await db
    .from("companies")
    .select("primary_color")
    .eq("id", companyId)
    .maybeSingle();
  return data?.primary_color ?? null;
}

/** Reads and updates Certificate Viva gating configuration on a course (graceful if un-migrated). */
export async function getCourseVivaConfig(courseId: string): Promise<{
  available: boolean;
  requireCertificateViva: boolean;
  vivaScenarioId: string | null;
}> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  await assertCanManageCourse(createClient(), courseId, userId);

  const db = createServiceClient();
  const loose = db as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: unknown) => {
          maybeSingle: () => Promise<{
            data: { require_certificate_viva?: boolean | null; viva_scenario_id?: string | null } | null;
            error: { code?: string; message?: string } | null;
          }>;
        };
      };
    };
  };

  const { data, error } = await loose
    .from("courses")
    .select("require_certificate_viva, viva_scenario_id")
    .eq("id", courseId)
    .maybeSingle();

  if (error) {
    if (isSchemaUnavailableError(error)) {
      return { available: false, requireCertificateViva: false, vivaScenarioId: null };
    }
    throw new Error(error.message);
  }

  return {
    available: true,
    requireCertificateViva: Boolean(data?.require_certificate_viva),
    vivaScenarioId: data?.viva_scenario_id ?? null,
  };
}

export async function updateCourseVivaConfig(input: {
  courseId: string;
  requireCertificateViva: boolean;
  vivaScenarioId?: string | null;
}): Promise<{ available: boolean; requireCertificateViva: boolean; vivaScenarioId: string | null }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const parsed = z
    .object({
      courseId: z.string().uuid(),
      requireCertificateViva: z.boolean(),
      vivaScenarioId: z.string().uuid().nullable().optional(),
    })
    .parse(input);

  const course = await assertCanManageCourse(createClient(), parsed.courseId, userId);
  if (parsed.vivaScenarioId) {
    await assertTenantRefs(courseTenantId(course.company_id, ZEDAI_TENANT_ID), {
      scenarioId: parsed.vivaScenarioId,
    });
  }

  const db = createServiceClient();
  const loose = db as unknown as {
    from: (t: string) => {
      update: (vals: Record<string, unknown>) => {
        eq: (k: string, v: unknown) => {
          select: (c: string) => {
            single: () => Promise<{
              data: { require_certificate_viva?: boolean | null; viva_scenario_id?: string | null } | null;
              error: { code?: string; message?: string } | null;
            }>;
          };
        };
      };
    };
  };

  const payload: Record<string, unknown> = {
    require_certificate_viva: parsed.requireCertificateViva,
  };
  if (parsed.vivaScenarioId !== undefined) {
    payload.viva_scenario_id = parsed.vivaScenarioId;
  }

  const { data, error } = await loose
    .from("courses")
    .update(payload)
    .eq("id", parsed.courseId)
    .select("require_certificate_viva, viva_scenario_id")
    .single();

  if (error) {
    if (isSchemaUnavailableError(error)) {
      return { available: false, requireCertificateViva: false, vivaScenarioId: null };
    }
    throw new Error(error.message);
  }

  revalidatePath(`/creator/courses/${parsed.courseId}`);
  return {
    available: true,
    requireCertificateViva: Boolean(data?.require_certificate_viva),
    vivaScenarioId: data?.viva_scenario_id ?? null,
  };
}

// ─── Staff-Visible Tutor Sessions ─────────────────────────────────────────────

function parseTeacherReview(toneStats: unknown): TeacherSessionReview | null {
  if (!toneStats || typeof toneStats !== "object" || Array.isArray(toneStats)) return null;
  const raw = (toneStats as Record<string, unknown>).teacher_review;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const notes = typeof obj.notes === "string" ? obj.notes.trim() : "";
  if (!notes) return null;
  return {
    notes,
    reviewed_by: typeof obj.reviewed_by === "string" ? obj.reviewed_by : "",
    reviewed_by_name: typeof obj.reviewed_by_name === "string" ? obj.reviewed_by_name : null,
    reviewed_at: typeof obj.reviewed_at === "string" ? obj.reviewed_at : "",
  };
}

function summarizeTurnEvent(ev: Record<string, unknown>): { type: string; summary: string } | null {
  const type = typeof ev.type === "string" ? ev.type : "";
  if (!type || type === "say" || type === "note_mistake") return null;
  if (type === "show_card" && ev.item && typeof ev.item === "object") {
    const item = ev.item as Record<string, unknown>;
    return { type, summary: `Flashcard: ${String(item.text ?? "")}` };
  }
  if (type === "show_text" && typeof ev.text === "string") {
    return { type, summary: `Prompt text: ${ev.text}` };
  }
  if (type === "advance_scene" && typeof ev.beat === "string") {
    return { type, summary: `Beat advanced: ${ev.beat}` };
  }
  if (type === "board" && typeof ev.title === "string") {
    return { type, summary: `Board: ${ev.title}` };
  }
  if (type === "note_evidence" && typeof ev.concept === "string") {
    return { type, summary: `Evidence (${String(ev.result ?? "checked")}): ${ev.concept}` };
  }
  if (type === "end_session") {
    return { type, summary: typeof ev.summary === "string" && ev.summary ? ev.summary : "Session ended" };
  }
  return null;
}

export async function listStaffVisibleTutorSessions(
  companyId: string,
  limit = 40
): Promise<StaffTutorSessionSummary[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  await requireTenantStaff(companyId, userId);

  const db = createServiceClient();
  // Privacy split: staff only see lesson/assignment sessions, shared sessions, or flagged sessions.
  const { data, error } = await db
    .from("tutor_sessions")
    .select(
      "id, origin, mode, status, started_at, ended_at, learner_speaking_ms, teacher_speaking_ms, shared_with_teacher, profiles(full_name, email), practice_scenarios(title), tutor_reports(scores, tone_stats)"
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
      | { scores?: Record<string, number> | null; tone_stats?: unknown }
      | null
      | undefined;
    const review = parseTeacherReview(rep?.tone_stats);

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
      has_teacher_review: Boolean(review),
      teacher_review_notes: review?.notes ?? null,
      teacher_reviewed_at: review?.reviewed_at ?? null,
    };
  });
}

export async function getStaffTutorSessionDetail(
  companyId: string,
  sessionId: string
): Promise<StaffTutorSessionDetail> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  await requireTenantStaff(companyId, userId);

  const db = createServiceClient();
  const { data: sessionRow, error: sessError } = await db
    .from("tutor_sessions")
    .select(
      "id, company_id, user_id, origin, mode, status, started_at, ended_at, learner_speaking_ms, teacher_speaking_ms, shared_with_teacher, profiles(id, full_name, email, avatar_url), practice_scenarios(id, title, goal, skill_pack, style)"
    )
    .eq("id", sessionId)
    .eq("company_id", companyId)
    .single();

  if (sessError || !sessionRow) {
    throw new Error(sessError?.message ?? "Speaking session not found");
  }

  const [{ data: turnRows, error: turnsError }, { data: reportRow }] = await Promise.all([
    db
      .from("tutor_turns")
      .select("id, idx, learner_text, learner_audio_ms, latency_ms, events, created_at")
      .eq("session_id", sessionId)
      .order("idx", { ascending: true }),
    db
      .from("tutor_reports")
      .select("session_id, scores, strengths, mistakes, tone_stats")
      .eq("session_id", sessionId)
      .maybeSingle(),
  ]);

  if (turnsError) throw new Error(turnsError.message);

  const r = sessionRow as unknown as Record<string, unknown>;
  const prof = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as
    | { id?: string; full_name?: string | null; email?: string | null; avatar_url?: string | null }
    | null
    | undefined;
  const scen = (Array.isArray(r.practice_scenarios) ? r.practice_scenarios[0] : r.practice_scenarios) as
    | { id?: string; title?: string | null; goal?: string | null; skill_pack?: string | null; style?: string | null }
    | null
    | undefined;

  const turns: TutorTurnTranscriptItem[] = (turnRows ?? []).map((t) => {
    const evList = Array.isArray(t.events) ? (t.events as Array<Record<string, unknown>>) : [];
    const teacher_says: TutorTurnTranscriptItem["teacher_says"] = [];
    const mistakes_noted: TutorTurnTranscriptItem["mistakes_noted"] = [];
    const other_events: TutorTurnTranscriptItem["other_events"] = [];

    for (const ev of evList) {
      if (!ev || typeof ev !== "object") continue;
      if (ev.type === "say" && typeof ev.text === "string") {
        teacher_says.push({
          text: ev.text,
          romanization: typeof ev.romanization === "string" ? ev.romanization : undefined,
          translation: typeof ev.translation === "string" ? ev.translation : undefined,
        });
      } else if (ev.type === "note_mistake" && typeof ev.correct === "string") {
        mistakes_noted.push({
          said: typeof ev.said === "string" ? ev.said : "",
          correct: ev.correct,
          category: typeof ev.category === "string" ? ev.category : "note",
        });
      } else {
        const extra = summarizeTurnEvent(ev);
        if (extra) other_events.push(extra);
      }
    }

    return {
      id: String(t.id),
      idx: t.idx,
      learner_text: t.learner_text,
      learner_audio_ms: t.learner_audio_ms,
      latency_ms: t.latency_ms,
      created_at: t.created_at,
      teacher_says,
      mistakes_noted,
      other_events,
    };
  });

  let parsedReport: StaffTutorSessionDetail["report"] = null;
  if (reportRow) {
    const rawScores =
      reportRow.scores && typeof reportRow.scores === "object" && !Array.isArray(reportRow.scores)
        ? (reportRow.scores as Record<string, unknown>)
        : {};
    const cleanScores: Record<string, number> = {};
    for (const [k, v] of Object.entries(rawScores)) {
      if (typeof v === "number" && Number.isFinite(v)) cleanScores[k] = v;
    }

    const strengths = Array.isArray(reportRow.strengths)
      ? reportRow.strengths.filter((s): s is string => typeof s === "string")
      : [];

    const mistakes = Array.isArray(reportRow.mistakes)
      ? (reportRow.mistakes as Array<Record<string, unknown>>)
          .filter((m) => m && typeof m === "object" && typeof m.correct === "string")
          .map((m) => ({
            said: typeof m.said === "string" ? m.said : "",
            correct: String(m.correct),
            category: typeof m.category === "string" ? m.category : "general",
            note: typeof m.note === "string" ? m.note : undefined,
          }))
      : [];

    parsedReport = {
      scores: cleanScores,
      strengths,
      mistakes,
      teacher_review: parseTeacherReview(reportRow.tone_stats),
    };
  }

  return {
    id: String(r.id),
    company_id: String(r.company_id),
    user_id: String(r.user_id),
    origin: String(r.origin),
    mode: String(r.mode),
    status: String(r.status),
    started_at: String(r.started_at),
    ended_at: (r.ended_at as string | null) ?? null,
    learner_speaking_ms: Number(r.learner_speaking_ms ?? 0),
    teacher_speaking_ms: Number(r.teacher_speaking_ms ?? 0),
    shared_with_teacher: Boolean(r.shared_with_teacher),
    learner: {
      id: prof?.id || String(r.user_id),
      full_name: prof?.full_name || prof?.email || "Learner",
      email: prof?.email ?? null,
      avatar_url: prof?.avatar_url ?? null,
    },
    scenario: {
      id: scen?.id ?? null,
      title: scen?.title || "Free practice",
      goal: scen?.goal ?? null,
      skill_pack: scen?.skill_pack ?? null,
      style: scen?.style ?? null,
    },
    turns,
    report: parsedReport,
  };
}

const saveSessionReviewSchema = z.object({
  companyId: z.string().min(1),
  sessionId: z.string().uuid(),
  status: z.enum(["completed", "flagged"]).optional(),
  feedbackNotes: z.string().trim().max(2000).default(""),
  notifyStudent: z.boolean().default(true),
});

export async function saveStaffSessionReview(
  input: z.infer<typeof saveSessionReviewSchema>
): Promise<{
  status: string;
  teacher_review: TeacherSessionReview | null;
}> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = saveSessionReviewSchema.parse(input);
  await requireTenantStaff(parsed.companyId, userId);

  const db = createServiceClient();
  const [{ data: sessionRow, error: sessError }, { data: reviewerProfile }, { data: existingReport }, { data: company }] =
    await Promise.all([
      db
        .from("tutor_sessions")
        .select("id, user_id, status, scenario_id")
        .eq("id", parsed.sessionId)
        .eq("company_id", parsed.companyId)
        .single(),
      db.from("profiles").select("full_name, email").eq("id", userId).maybeSingle(),
      db
        .from("tutor_reports")
        .select("session_id, tone_stats")
        .eq("session_id", parsed.sessionId)
        .maybeSingle(),
      db.from("companies").select("slug").eq("id", parsed.companyId).maybeSingle(),
    ]);

  if (sessError || !sessionRow) {
    throw new Error(sessError?.message ?? "Session not found");
  }

  let nextStatus = sessionRow.status;
  if (parsed.status && parsed.status !== sessionRow.status) {
    const { error: statusError } = await db
      .from("tutor_sessions")
      .update({ status: parsed.status, updated_at: new Date().toISOString() })
      .eq("id", parsed.sessionId)
      .eq("company_id", parsed.companyId);

    if (statusError) throw new Error(statusError.message);
    nextStatus = parsed.status;
  }

  let savedReview: TeacherSessionReview | null = null;
  const trimmedNotes = parsed.feedbackNotes.trim();
  const existingToneStats =
    existingReport?.tone_stats &&
    typeof existingReport.tone_stats === "object" &&
    !Array.isArray(existingReport.tone_stats)
      ? { ...(existingReport.tone_stats as Record<string, unknown>) }
      : {};

  if (trimmedNotes.length > 0) {
    savedReview = {
      notes: trimmedNotes,
      reviewed_by: userId,
      reviewed_by_name: reviewerProfile?.full_name || reviewerProfile?.email || "Instructor",
      reviewed_at: new Date().toISOString(),
    };
    existingToneStats.teacher_review = savedReview;

    if (existingReport) {
      const { error: repErr } = await db
        .from("tutor_reports")
        .update({ tone_stats: existingToneStats as unknown as Json })
        .eq("session_id", parsed.sessionId);
      if (repErr) throw new Error(repErr.message);
    } else {
      const { error: repInsertErr } = await db.from("tutor_reports").insert({
        session_id: parsed.sessionId,
        scores: {} as unknown as Json,
        strengths: [] as unknown as Json,
        mistakes: [] as unknown as Json,
        tone_stats: existingToneStats as unknown as Json,
      });
      if (repInsertErr) throw new Error(repInsertErr.message);
    }
  } else if (existingReport && "teacher_review" in existingToneStats) {
    delete existingToneStats.teacher_review;
    await db
      .from("tutor_reports")
      .update({ tone_stats: existingToneStats as unknown as Json })
      .eq("session_id", parsed.sessionId);
  }

  if (parsed.notifyStudent && trimmedNotes.length > 0 && sessionRow.user_id) {
    try {
      let scenarioTitle = "AI Speaking Practice";
      if (sessionRow.scenario_id) {
        const { data: scenRow } = await db
          .from("practice_scenarios")
          .select("title")
          .eq("id", sessionRow.scenario_id)
          .maybeSingle();
        if (scenRow?.title) scenarioTitle = scenRow.title;
      }
      const slug = company?.slug || "";
      await db.from("notifications").insert({
        user_id: sessionRow.user_id,
        type: "tutor_review",
        title: `Instructor Feedback: ${scenarioTitle}`,
        body: trimmedNotes.slice(0, 180),
        data: {
          session_id: parsed.sessionId,
          company_id: parsed.companyId,
          company_slug: slug,
          url: slug ? `/academy/${slug}/classroom?tab=progress` : "/dashboard",
        } as unknown as Json,
      } as any);
    } catch (notifErr) {
      console.warn("Unable to notify learner of tutor review:", notifErr);
    }
  }

  revalidatePath("/creator/ai-teachers");
  if (company?.slug) {
    revalidatePath(`/academy/${company.slug}/tutor`);
    revalidatePath(`/academy/${company.slug}/classroom`);
  }

  return { status: nextStatus, teacher_review: savedReview };
}

// ─── Tutor Assignments (Teacher -> Class/Academy) ─────────────────────────────

export async function listClassroomGroupsForTenant(
  companyId: string,
): Promise<Array<{ id: string; name: string }>> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  await requireTenantStaff(companyId, userId);

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
  await requireTenantStaff(companyId, userId);

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
  await requireTenantStaff(input.companyId, userId);
  await assertTenantRefs(input.companyId, { scenarioId: input.scenarioId, groupId: input.groupId || null });

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
  await requireTenantStaff(companyId, userId);

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
  await requireTenantStaff(companyId, userId);

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
  await requireTenantStaff(companyId, userId);

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
  await assertTenantRefs(companyId, { scenarioId: parsed.scenarioId });

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

