import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertCanManageCourse } from "@/lib/courses/course-auth-server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  AUTOPILOT_MAX_BATCH,
  resolveAutopilotTemplate,
  selectAutopilotLessons,
} from "@/lib/tutor/authoring/autopilot";
import {
  FLOW_DRAFT_JSON_SCHEMA,
  buildDraftFlowPrompt,
  defaultSceneForLesson,
  parseDraftedFlow,
  pickSkillPackForLesson,
  toScenarioBeatsPayload,
} from "@/lib/tutor/authoring/flow";
import {
  OBJECTIVES_JSON_SCHEMA,
  buildObjectivesPrompt,
  parseExtractedObjectives,
  summarizeLessonMaterial,
} from "@/lib/tutor/authoring/objectives";
import {
  generateAuthoringJson,
  loadLessonAuthoringContext,
} from "@/lib/tutor/authoring/server";
import { AUTHORING_TEMPLATE_IDS, getAuthoringTemplate } from "@/lib/tutor/authoring/templates";
import { parseTutorSessionBlock, sceneFromValue } from "@/lib/tutor/tutor-session-block";
import type { Json } from "@/types/database";

const bodySchema = z.object({
  courseId: z.string().uuid(),
  templateId: z.union([z.literal("auto"), z.enum(AUTHORING_TEMPLATE_IDS)]).default("auto"),
  personaId: z.string().uuid().optional().nullable(),
  lessonIds: z.array(z.string().uuid()).optional(),
  publish: z.boolean().default(false),
  attachBlock: z.boolean().default(true),
  maxBatch: z.number().int().min(1).max(AUTOPILOT_MAX_BATCH).default(AUTOPILOT_MAX_BATCH),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { courseId, templateId, personaId, lessonIds, publish, attachBlock, maxBatch } = parsed.data;

  try {
    await assertCanManageCourse(createClient(), courseId, userId);
    const db = createServiceClient();

    const [{ data: modulesData }, baseCtx] = await Promise.all([
      db
        .from("modules")
        .select("id, title, position")
        .eq("course_id", courseId)
        .order("position", { ascending: true }),
      loadLessonAuthoringContext({ userId, courseId }),
    ]);

    const modules = modulesData ?? [];
    const moduleIds = modules.map((m) => m.id);
    const moduleTitleById = new Map(modules.map((m) => [m.id, m.title]));

    const { data: lessonsData } =
      moduleIds.length > 0
        ? await db
            .from("lessons")
            .select("id, title, module_id, position")
            .in("module_id", moduleIds)
            .order("position", { ascending: true })
        : { data: [] as Array<{ id: string; title: string; module_id: string; position: number }> };

    const orderedLessons = [...(lessonsData ?? [])].sort((a, b) => {
      const mA = modules.findIndex((m) => m.id === a.module_id);
      const mB = modules.findIndex((m) => m.id === b.module_id);
      return mA !== mB ? mA - mB : a.position - b.position;
    });

    const allLessonIds = orderedLessons.map((l) => l.id);
    const { data: blockRows } =
      allLessonIds.length > 0
        ? await db
            .from("content_blocks")
            .select("lesson_id, type, content, position")
            .in("lesson_id", allLessonIds)
        : { data: [] as Array<{ lesson_id: string; type: string; content: unknown; position: number }> };

    const blockCountByLesson = new Map<string, number>();
    const hasTutorByLesson = new Set<string>();
    const maxPosByLesson = new Map<string, number>();

    for (const b of blockRows ?? []) {
      maxPosByLesson.set(b.lesson_id, Math.max(maxPosByLesson.get(b.lesson_id) ?? -1, b.position));
      if (b.type === "tutor_session" && parseTutorSessionBlock(b.content)) {
        hasTutorByLesson.add(b.lesson_id);
      } else if (b.type !== "tutor_session") {
        blockCountByLesson.set(b.lesson_id, (blockCountByLesson.get(b.lesson_id) ?? 0) + 1);
      }
    }

    const plan = selectAutopilotLessons(
      orderedLessons.map((l) => ({
        lessonId: l.id,
        lessonTitle: l.title,
        moduleTitle: moduleTitleById.get(l.module_id) ?? "Module",
        hasExistingTutorBlock: hasTutorByLesson.has(l.id),
        materialBlockCount: blockCountByLesson.get(l.id) ?? 0,
      })),
      { requestedLessonIds: lessonIds, maxBatch },
    );

    const chosenPersonaId = personaId ?? baseCtx.defaultPersonaId;
    let teacherName = baseCtx.defaultTeacherName;
    let personaDefaultScene = null;
    if (chosenPersonaId) {
      const { data: pRow } = await db
        .from("ai_personas")
        .select("name, display_name, default_scene")
        .eq("id", chosenPersonaId)
        .maybeSingle();
      if (pRow) {
        teacherName = pRow.display_name || pRow.name;
        personaDefaultScene = sceneFromValue(pRow.default_scene) ?? null;
      }
    }

    const results: Array<{
      lessonId: string;
      lessonTitle: string;
      scenarioId?: string;
      scenarioTitle?: string;
      status: "created" | "failed";
      error?: string;
    }> = [];

    for (const item of plan.selected) {
      try {
        const lessonCtx = await loadLessonAuthoringContext({
          userId,
          courseId,
          lessonId: item.lessonId,
        });

        const materialText = summarizeLessonMaterial({
          lessonTitle: item.lessonTitle,
          blocks: lessonCtx.blocks,
          quizQuestions: lessonCtx.quizQuestions,
        });

        // 1. Extract measurable objectives
        const objPrompt = buildObjectivesPrompt({
          courseTitle: lessonCtx.course.title,
          moduleTitle: item.moduleTitle,
          lessonTitle: item.lessonTitle,
          materialText,
        });
        const objAi = await generateAuthoringJson({
          systemInstruction: objPrompt.systemInstruction,
          prompt: objPrompt.prompt,
          responseJsonSchema: OBJECTIVES_JSON_SCHEMA,
          companyId: lessonCtx.course.company_id,
          userId,
          temperature: 0.35,
        });
        const objParsed = parseExtractedObjectives(objAi.text);
        if (!objParsed.ok) {
          throw new Error(objParsed.error);
        }

        // 2. Draft the flow using chosen/auto template
        const resolvedTplId = resolveAutopilotTemplate(templateId, item.lessonTitle);
        const tpl = getAuthoringTemplate(resolvedTplId);
        const skillPack = pickSkillPackForLesson({
          courseTitle: lessonCtx.course.title,
          category: lessonCtx.course.category,
          lessonTitle: item.lessonTitle,
        });
        const defaultScene = defaultSceneForLesson({
          templateId: tpl.id,
          courseTitle: lessonCtx.course.title,
          category: lessonCtx.course.category,
          personaDefaultScene,
        });

        const draftPrompt = buildDraftFlowPrompt({
          courseTitle: lessonCtx.course.title,
          courseCategory: lessonCtx.course.category,
          courseLevel: lessonCtx.course.level,
          lessonTitle: item.lessonTitle,
          objectives: objParsed.objectives,
          templateId: tpl.id,
          skillPack,
          defaultScene,
          materialText,
          teacherName,
        });
        const draftAi = await generateAuthoringJson({
          systemInstruction: draftPrompt.systemInstruction,
          prompt: draftPrompt.prompt,
          responseJsonSchema: FLOW_DRAFT_JSON_SCHEMA,
          companyId: lessonCtx.course.company_id,
          userId,
          temperature: 0.45,
        });
        const flowParsed = parseDraftedFlow(draftAi.text);
        if (!flowParsed.ok) {
          throw new Error(flowParsed.error);
        }

        const scenarioStatus =
          publish || lessonCtx.course.status === "published" ? "published" : "draft";

        const { data: createdScenario, error: scenarioErr } = await db
          .from("practice_scenarios")
          .insert({
            company_id: lessonCtx.course.company_id,
            course_id: courseId,
            lesson_id: item.lessonId,
            persona_id: chosenPersonaId,
            skill_pack: flowParsed.flow.skillPack,
            title: flowParsed.flow.title,
            goal: flowParsed.flow.goal,
            beats: toScenarioBeatsPayload(flowParsed.flow.steps) as unknown as Json,
            target_items: flowParsed.flow.targetItems as unknown as Json,
            max_minutes: flowParsed.flow.maxMinutes,
            allowed_modes: ["voice", "text"],
            scene: flowParsed.flow.scene,
            visibility: "course",
            style: flowParsed.flow.style,
            status: scenarioStatus,
            created_by: userId,
          })
          .select("id, title")
          .single();

        if (scenarioErr || !createdScenario) {
          throw new Error(scenarioErr?.message ?? "Failed to save scenario");
        }

        if (attachBlock) {
          const nextPos = (maxPosByLesson.get(item.lessonId) ?? -1) + 1;
          await db.from("content_blocks").insert({
            lesson_id: item.lessonId,
            type: "tutor_session",
            position: nextPos,
            content: {
              scenarioId: createdScenario.id,
              title: createdScenario.title,
              required: false,
            } as unknown as Json,
          });
        }

        results.push({
          lessonId: item.lessonId,
          lessonTitle: item.lessonTitle,
          scenarioId: createdScenario.id,
          scenarioTitle: createdScenario.title,
          status: "created",
        });
      } catch (err) {
        results.push({
          lessonId: item.lessonId,
          lessonTitle: item.lessonTitle,
          status: "failed",
          error: err instanceof Error ? err.message : "Failed to generate flow",
        });
      }
    }

    return NextResponse.json({
      results,
      skippedAlreadyConfigured: plan.skippedAlreadyConfigured,
      skippedEmpty: plan.skippedEmpty,
      remainingPendingCount: plan.remainingPendingCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Autopilot failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
