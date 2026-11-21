import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  OBJECTIVES_JSON_SCHEMA,
  buildObjectivesPrompt,
  parseExtractedObjectives,
  summarizeLessonMaterial,
} from "@/lib/tutor/authoring/objectives";
import { generateAuthoringJson, loadLessonAuthoringContext } from "@/lib/tutor/authoring/server";

const bodySchema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing or invalid courseId or lessonId" }, { status: 400 });
  }

  try {
    const ctx = await loadLessonAuthoringContext({
      userId,
      courseId: parsed.data.courseId,
      lessonId: parsed.data.lessonId,
    });

    const lessonTitle = ctx.lesson?.title ?? "Lesson";
    const materialText = summarizeLessonMaterial({
      lessonTitle,
      blocks: ctx.blocks,
      quizQuestions: ctx.quizQuestions,
    });

    const { systemInstruction, prompt } = buildObjectivesPrompt({
      courseTitle: ctx.course.title,
      moduleTitle: ctx.lesson?.moduleTitle,
      lessonTitle,
      materialText,
    });

    const result = await generateAuthoringJson({
      systemInstruction,
      prompt,
      responseJsonSchema: OBJECTIVES_JSON_SCHEMA,
      companyId: ctx.course.company_id,
      userId,
      temperature: 0.3,
    });

    const extracted = parseExtractedObjectives(result.text);
    if (!extracted.ok) {
      return NextResponse.json({ error: extracted.error }, { status: 502 });
    }

    return NextResponse.json({
      objectives: extracted.objectives,
      defaultPersonaId: ctx.defaultPersonaId,
      defaultTeacherName: ctx.defaultTeacherName,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not extract objectives";
    const status = msg === "Unauthorized" ? 403 : msg.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
