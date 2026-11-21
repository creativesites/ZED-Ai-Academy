import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  FLOW_DRAFT_JSON_SCHEMA,
  buildReviseFlowPrompt,
  computeFlowDiff,
  draftedFlowSchema,
  parseDraftedFlow,
} from "@/lib/tutor/authoring/flow";
import { lessonObjectiveSchema, summarizeLessonMaterial } from "@/lib/tutor/authoring/objectives";
import { generateAuthoringJson, loadLessonAuthoringContext } from "@/lib/tutor/authoring/server";

const bodySchema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid().optional().nullable(),
  flow: draftedFlowSchema,
  instruction: z.string().trim().min(2).max(400),
  objectives: z.array(lessonObjectiveSchema).max(6).optional(),
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

    const materialText = ctx.lesson
      ? summarizeLessonMaterial({
          lessonTitle: ctx.lesson.title,
          blocks: ctx.blocks,
          quizQuestions: ctx.quizQuestions,
          maxChars: 5000,
        })
      : "";

    const { systemInstruction, prompt } = buildReviseFlowPrompt({
      currentFlow: parsed.data.flow,
      instruction: parsed.data.instruction,
      objectives: parsed.data.objectives,
      lessonTitle: ctx.lesson?.title ?? ctx.course.title,
      materialText,
    });

    const result = await generateAuthoringJson({
      systemInstruction,
      prompt,
      responseJsonSchema: FLOW_DRAFT_JSON_SCHEMA,
      companyId: ctx.course.company_id,
      userId,
      temperature: 0.35,
    });

    const revised = parseDraftedFlow(result.text, {
      style: parsed.data.flow.style,
      scene: parsed.data.flow.scene,
      skillPack: parsed.data.flow.skillPack,
      maxMinutes: parsed.data.flow.maxMinutes,
    });
    if (!revised.ok) {
      return NextResponse.json({ error: revised.error }, { status: 502 });
    }

    const diff = computeFlowDiff(parsed.data.flow, revised.flow);
    return NextResponse.json({ flow: revised.flow, diff });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not revise flow";
    const status = msg === "Unauthorized" ? 403 : msg.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
