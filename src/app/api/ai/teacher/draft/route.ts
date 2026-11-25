import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import {
  FLOW_DRAFT_JSON_SCHEMA,
  buildDraftFlowPrompt,
  defaultSceneForLesson,
  parseDraftedFlow,
  pickSkillPackForLesson,
} from "@/lib/tutor/authoring/flow";
import { lessonObjectiveSchema, summarizeLessonMaterial } from "@/lib/tutor/authoring/objectives";
import { AUTHORING_TEMPLATE_IDS, getAuthoringTemplate } from "@/lib/tutor/authoring/templates";
import { generateAuthoringJson, loadLessonAuthoringContext } from "@/lib/tutor/authoring/server";
import { sceneFromValue } from "@/lib/tutor/tutor-session-block";
import { assertTenantRefs, tenantRefErrorResponse } from "@/lib/authz/refs-server";

const bodySchema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid().optional().nullable(),
  objectives: z.array(lessonObjectiveSchema).min(1).max(6),
  templateId: z.enum(AUTHORING_TEMPLATE_IDS).default("explain_check"),
  personaId: z.string().uuid().optional().nullable(),
  skillPack: z.string().optional().nullable(),
  instructions: z.string().max(600).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const ctx = await loadLessonAuthoringContext({
      userId,
      courseId: parsed.data.courseId,
      lessonId: parsed.data.lessonId,
    });

    try {
      await assertTenantRefs(ctx.course.company_id, { personaId: parsed.data.personaId ?? null });
    } catch (err) {
      const denied = tenantRefErrorResponse(err);
      if (denied) return denied;
      throw err;
    }
    const personaId = parsed.data.personaId ?? ctx.defaultPersonaId;
    let teacherName = ctx.defaultTeacherName;
    let personaDefaultScene = null;

    if (personaId) {
      const { data: persona } = await createServiceClient()
        .from("ai_personas")
        .select("name, display_name, default_scene")
        .eq("id", personaId)
        .maybeSingle();
      if (persona) {
        teacherName = persona.display_name || persona.name;
        personaDefaultScene = sceneFromValue(persona.default_scene) ?? null;
      }
    }

    const template = getAuthoringTemplate(parsed.data.templateId);
    const skillPack = pickSkillPackForLesson({
      courseTitle: ctx.course.title,
      category: ctx.course.category,
      lessonTitle: ctx.lesson?.title,
      explicit: parsed.data.skillPack,
    });
    const defaultScene = defaultSceneForLesson({
      templateId: template.id,
      courseTitle: ctx.course.title,
      category: ctx.course.category,
      personaDefaultScene,
    });

    const lessonTitle = ctx.lesson?.title ?? ctx.course.title;
    const materialText = summarizeLessonMaterial({
      lessonTitle,
      blocks: ctx.blocks,
      quizQuestions: ctx.quizQuestions,
    });

    const { systemInstruction, prompt } = buildDraftFlowPrompt({
      courseTitle: ctx.course.title,
      courseCategory: ctx.course.category,
      courseLevel: ctx.course.level,
      lessonTitle,
      objectives: parsed.data.objectives,
      templateId: template.id,
      skillPack,
      defaultScene,
      materialText,
      teacherName,
      instructions: parsed.data.instructions,
    });

    const result = await generateAuthoringJson({
      systemInstruction,
      prompt,
      responseJsonSchema: FLOW_DRAFT_JSON_SCHEMA,
      companyId: ctx.course.company_id,
      userId,
      temperature: 0.45,
    });

    const drafted = parseDraftedFlow(result.text, {
      style: template.style,
      scene: defaultScene,
      skillPack,
      maxMinutes: template.maxMinutes,
    });
    if (!drafted.ok) {
      return NextResponse.json({ error: drafted.error }, { status: 502 });
    }

    return NextResponse.json({
      flow: drafted.flow,
      personaId,
      teacherName,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not draft flow";
    const status = msg === "Unauthorized" ? 403 : msg.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
