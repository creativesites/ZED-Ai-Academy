import "server-only";
import { ThinkingLevel } from "@google/genai";
import { gemini } from "@/lib/ai/gemini";
import { modelFor } from "@/lib/ai/models";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { assertCanManageCourse } from "@/lib/courses/course-auth-server";
import { ZEDAI_TENANT_ID } from "@/lib/tenants/constants";
import { describeGeminiError, worthTryingAnotherModel } from "@/lib/tutor/gemini-errors";
import { isSchemaUnavailableError } from "@/lib/tutor/mastery/server";
import { recordUsage } from "@/lib/tutor/server/usage";
import {
  DEFAULT_TEACHER_NAME,
  courseTeacher,
} from "@/lib/tutor/course-teacher";
import {
  scenarioViewFromRow,
  type TutorScenarioRow,
} from "@/lib/tutor/tutor-session-block";
import type { LessonSourceBlock, QuizQuestionSource } from "./objectives";

const AUTHORING_FALLBACKS = ["gemini-3.5-flash-lite", "gemini-2.5-flash"];

function thinkingFor(model: string) {
  return /^gemini-3/.test(model) ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {};
}

export async function generateAuthoringJson(input: {
  systemInstruction: string;
  prompt: string;
  responseJsonSchema: Record<string, unknown>;
  companyId: string;
  userId: string;
  temperature?: number;
}): Promise<{ text: string | undefined; model: string }> {
  const primary = modelFor("teacherAuthoring");
  const models = [primary, ...AUTHORING_FALLBACKS.filter((m) => m !== primary)];
  let firstError: unknown;

  for (const model of models) {
    try {
      const response = await gemini.models.generateContent({
        model,
        contents: input.prompt,
        config: {
          systemInstruction: input.systemInstruction,
          responseMimeType: "application/json",
          responseJsonSchema: input.responseJsonSchema,
          temperature: input.temperature ?? 0.4,
          ...thinkingFor(model),
          maxOutputTokens: 8192,
        },
      });

      const tokens = response.usageMetadata?.totalTokenCount ?? 0;
      await recordUsage({
        companyId: input.companyId,
        userId: input.userId,
        sessionId: null,
        model,
        kind: "llm",
        units: tokens,
        unit: "tokens",
      });

      return { text: response.text, model };
    } catch (err) {
      const info = describeGeminiError(err);
      console.warn(`[teacher-authoring] Gemini ${model} failed (${info.code}): ${info.detail}`);
      firstError ??= err;
      if (!worthTryingAnotherModel(info)) break;
    }
  }
  throw firstError;
}

export type LessonAuthoringContext = {
  course: {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    level: string | null;
    company_id: string;
    status: string;
  };
  lesson: {
    id: string;
    title: string;
    moduleTitle: string | null;
  } | null;
  blocks: LessonSourceBlock[];
  quizQuestions: QuizQuestionSource[];
  defaultPersonaId: string | null;
  defaultTeacherName: string;
};

export async function loadLessonAuthoringContext(input: {
  userId: string;
  courseId: string;
  lessonId?: string | null;
}): Promise<LessonAuthoringContext> {
  const supabase = createClient();
  await assertCanManageCourse(supabase, input.courseId, input.userId);

  const db = createServiceClient();
  const { data: courseRow } = await db
    .from("courses")
    .select("id, title, description, category, level, company_id, status")
    .eq("id", input.courseId)
    .single();
  if (!courseRow) throw new Error("Course not found.");

  const companyId = courseRow.company_id ?? ZEDAI_TENANT_ID;

  let lessonInfo: LessonAuthoringContext["lesson"] = null;
  let blocks: LessonSourceBlock[] = [];
  let quizQuestions: QuizQuestionSource[] = [];

  if (input.lessonId) {
    const { data: lessonRow } = await db
      .from("lessons")
      .select("id, title, module_id")
      .eq("id", input.lessonId)
      .maybeSingle();
    if (!lessonRow) throw new Error("Lesson not found.");

    const { data: modRow } = await db
      .from("modules")
      .select("title, course_id")
      .eq("id", lessonRow.module_id)
      .maybeSingle();
    if (!modRow || modRow.course_id !== input.courseId) {
      throw new Error("Lesson does not belong to this course.");
    }

    lessonInfo = {
      id: lessonRow.id,
      title: lessonRow.title,
      moduleTitle: modRow.title,
    };

    const [{ data: blockRows }, { data: quizRow }] = await Promise.all([
      db
        .from("content_blocks")
        .select("id, type, content")
        .eq("lesson_id", input.lessonId)
        .order("position", { ascending: true }),
      db
        .from("quizzes")
        .select("id, quiz_questions(question, options, correct_indices, explanation, position)")
        .eq("lesson_id", input.lessonId)
        .maybeSingle(),
    ]);

    blocks = (blockRows ?? []).map((b) => ({
      id: b.id,
      type: b.type,
      content: b.content,
    }));

    const rawQuestions = (quizRow as { quiz_questions?: unknown[] } | null)?.quiz_questions;
    if (Array.isArray(rawQuestions)) {
      quizQuestions = [...rawQuestions]
        .sort((a, b) => Number((a as { position?: number }).position ?? 0) - Number((b as { position?: number }).position ?? 0))
        .map((q) => {
          const item = q as Record<string, unknown>;
          return {
            question: String(item.question ?? ""),
            options: Array.isArray(item.options) ? (item.options as string[]) : [],
            correct_indices: Array.isArray(item.correct_indices) ? (item.correct_indices as number[]) : [],
            explanation: typeof item.explanation === "string" ? item.explanation : null,
          };
        });
    }
  }

  // Pick default course teacher using courseTeacher() from existing course scenarios,
  // else academy default persona (`tutor_settings.default_persona_id`), else Tinashe.
  const companyIds = companyId === ZEDAI_TENANT_ID ? [ZEDAI_TENANT_ID] : [companyId, ZEDAI_TENANT_ID];
  const [{ data: courseScenarios }, { data: personas }, settingsDefaultRes] = await Promise.all([
    db
      .from("practice_scenarios")
      .select("id, title, goal, style, scene, max_minutes, allowed_modes, persona_id, ai_personas(name, display_name, rive_variant)")
      .eq("course_id", input.courseId)
      .order("created_at", { ascending: true })
      .limit(5),
    db
      .from("ai_personas")
      .select("id, company_id, name, display_name")
      .in("company_id", companyIds)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    (db as unknown as {
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
      .maybeSingle(),
  ]);

  const tenantDefaultPersonaId =
    !settingsDefaultRes.error || !isSchemaUnavailableError(settingsDefaultRes.error)
      ? settingsDefaultRes.data?.default_persona_id ?? null
      : null;

  const scenarioRows = (courseScenarios ?? []) as unknown as (TutorScenarioRow & { persona_id: string | null })[];
  const resolvedTeacher = courseTeacher(scenarioRows.map(scenarioViewFromRow));
  const firstPersonaId = scenarioRows.find((s) => s.persona_id)?.persona_id ?? null;

  const personaList = personas ?? [];
  const preferredPersona =
    (firstPersonaId ? personaList.find((p) => p.id === firstPersonaId) : undefined) ??
    (tenantDefaultPersonaId ? personaList.find((p) => p.id === tenantDefaultPersonaId) : undefined) ??
    personaList.find(
      (p) =>
        p.company_id === companyId &&
        (p.name.toLowerCase() === DEFAULT_TEACHER_NAME.toLowerCase() ||
          p.display_name?.toLowerCase() === DEFAULT_TEACHER_NAME.toLowerCase()),
    ) ??
    personaList.find(
      (p) =>
        p.name.toLowerCase() === DEFAULT_TEACHER_NAME.toLowerCase() ||
        p.display_name?.toLowerCase() === DEFAULT_TEACHER_NAME.toLowerCase(),
    ) ??
    personaList.find((p) => p.company_id === companyId) ??
    personaList[0];

  return {
    course: {
      id: courseRow.id,
      title: courseRow.title,
      description: courseRow.description,
      category: courseRow.category,
      level: courseRow.level,
      company_id: companyId,
      status: courseRow.status,
    },
    lesson: lessonInfo,
    blocks,
    quizQuestions,
    defaultPersonaId: preferredPersona?.id ?? null,
    defaultTeacherName: preferredPersona?.display_name ?? preferredPersona?.name ?? resolvedTeacher.name,
  };
}
