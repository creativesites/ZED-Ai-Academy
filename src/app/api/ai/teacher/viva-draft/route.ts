import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertCanManageCourse } from "@/lib/courses/course-auth-server";
import { blocksToText } from "@/lib/course-blocks/block-to-text";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  FLOW_DRAFT_JSON_SCHEMA,
  parseDraftedFlow,
  toScenarioBeatsPayload,
} from "@/lib/tutor/authoring/flow";
import { generateAuthoringJson, loadLessonAuthoringContext } from "@/lib/tutor/authoring/server";
import { isSchemaUnavailableError } from "@/lib/tutor/mastery/server";
import { buildCourseVivaPrompt } from "@/lib/tutor/viva";
import type { Json } from "@/types/database";
import { assertTenantRefs, tenantRefErrorResponse } from "@/lib/tenants/tenant-refs-server";

const bodySchema = z.object({
  courseId: z.string().uuid(),
  personaId: z.string().uuid().optional().nullable(),
  enableVivaGate: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    await assertCanManageCourse(createClient(), parsed.data.courseId, userId);
    const db = createServiceClient();

    const baseCtx = await loadLessonAuthoringContext({
      userId,
      courseId: parsed.data.courseId,
    });
    try {
      await assertTenantRefs(baseCtx.course.company_id, { personaId: parsed.data.personaId ?? null });
    } catch (err) {
      const denied = tenantRefErrorResponse(err);
      if (denied) return denied;
      throw err;
    }
    const personaId = parsed.data.personaId ?? baseCtx.defaultPersonaId;
    let teacherName = baseCtx.defaultTeacherName;
    if (personaId) {
      const { data: p } = await db
        .from("ai_personas")
        .select("name, display_name")
        .eq("id", personaId)
        .maybeSingle();
      if (p) teacherName = p.display_name || p.name;
    }

    const { data: modules } = await db
      .from("modules")
      .select("id")
      .eq("course_id", parsed.data.courseId)
      .order("position", { ascending: true });
    const moduleIds = (modules ?? []).map((m) => m.id);

    const { data: lessons } =
      moduleIds.length > 0
        ? await db
            .from("lessons")
            .select("id, title, position")
            .in("module_id", moduleIds)
            .order("position", { ascending: true })
            .limit(12)
        : { data: [] as Array<{ id: string; title: string; position: number }> };

    const lessonIds = (lessons ?? []).map((l) => l.id);
    const { data: blocks } =
      lessonIds.length > 0
        ? await db
            .from("content_blocks")
            .select("lesson_id, type, content")
            .in("lesson_id", lessonIds)
            .order("position", { ascending: true })
        : { data: [] as Array<{ lesson_id: string; type: string; content: unknown }> };

    const byLesson = new Map<string, Array<{ type: string; content: unknown }>>();
    for (const b of blocks ?? []) {
      const list = byLesson.get(b.lesson_id) ?? [];
      list.push({ type: b.type, content: b.content });
      byLesson.set(b.lesson_id, list);
    }

    const lessonSummaries = (lessons ?? []).map((l) => ({
      title: l.title,
      summary: blocksToText(byLesson.get(l.id) ?? [], { maxChars: 600 }).replace(/\s+/g, " ").trim(),
    }));

    const prompt = buildCourseVivaPrompt({
      courseTitle: baseCtx.course.title,
      courseDescription: baseCtx.course.description,
      lessonSummaries,
      teacherName,
    });

    const ai = await generateAuthoringJson({
      systemInstruction:
        "You design end-of-course Certificate Viva oral checks for educators. Return ONLY JSON matching the schema.",
      prompt,
      responseJsonSchema: FLOW_DRAFT_JSON_SCHEMA,
      companyId: baseCtx.course.company_id,
      userId,
      temperature: 0.4,
    });

    const drafted = parseDraftedFlow(ai.text);
    if (!drafted.ok) {
      return NextResponse.json({ error: drafted.error }, { status: 502 });
    }

    const { data: savedScenario, error: insertErr } = await db
      .from("practice_scenarios")
      .insert({
        company_id: baseCtx.course.company_id,
        course_id: parsed.data.courseId,
        lesson_id: null,
        persona_id: personaId,
        skill_pack: "general-tutor",
        title: drafted.flow.title.includes("Viva")
          ? drafted.flow.title
          : `Certificate Viva · ${drafted.flow.title}`,
        goal: drafted.flow.goal,
        beats: toScenarioBeatsPayload(drafted.flow.steps) as unknown as Json,
        target_items: drafted.flow.targetItems as unknown as Json,
        exam_task: "certificate_viva",
        max_minutes: 8,
        allowed_modes: ["voice", "text"],
        scene: "Scene_Studio",
        visibility: "course",
        style: "oral_check",
        status: baseCtx.course.status === "published" ? "published" : "draft",
        created_by: userId,
      })
      .select("id, title")
      .single();

    if (insertErr || !savedScenario) {
      throw new Error(insertErr?.message ?? "Failed to create viva flow");
    }

    let vivaLinked = false;
    const loose = db as unknown as {
      from: (t: string) => {
        update: (vals: Record<string, unknown>) => {
          eq: (k: string, v: unknown) => Promise<{ error: { code?: string; message?: string } | null }>;
        };
      };
    };
    const updateRes = await loose
      .from("courses")
      .update({
        viva_scenario_id: savedScenario.id,
        require_certificate_viva: parsed.data.enableVivaGate,
      })
      .eq("id", parsed.data.courseId);

    if (!updateRes.error) {
      vivaLinked = true;
    } else if (!isSchemaUnavailableError(updateRes.error)) {
      throw new Error(updateRes.error.message);
    }

    return NextResponse.json({
      scenarioId: savedScenario.id,
      title: savedScenario.title,
      vivaLinked,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not generate Certificate Viva";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
