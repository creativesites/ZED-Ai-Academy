import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertCanManageLesson, canManageCourse } from "@/lib/courses/course-auth-server";
import { blocksToText } from "@/lib/course-blocks/block-to-text";
import { aiJson } from "@/lib/ai/call";
import { normalizeTutorScenario } from "@/lib/ai/generation/parse";
import { tutorScenarioSchema } from "@/lib/ai/generation/schemas";
import { ZEDAI_TENANT_ID } from "@/lib/tenants/constants";
import { getAuthoringTemplate } from "@/lib/tutor/authoring/templates";
import { SCENE_ARTBOARDS } from "@/lib/tutor/rive-driver";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    courseId?: string;
    lessonId?: string;
    skillPack?: string;
    style?: string;
    level?: string;
    templateId?: string;
    instructions?: string;
  } | null;

  if (!body?.courseId) {
    return Response.json({ error: "Missing courseId" }, { status: 400 });
  }

  const supabase = createClient();
  const { allowed, course: owned } = await canManageCourse(supabase, body.courseId, userId);
  if (!allowed || !owned) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (body.lessonId) {
    // The lesson's content goes into the prompt: it must belong to the course the caller may manage.
    try {
      await assertCanManageLesson(supabase, body.lessonId, userId, body.courseId);
    } catch {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  const { data: course } = await supabase
    .from("courses")
    .select("title, description, category, level")
    .eq("id", body.courseId)
    .maybeSingle();

  let lessonTitle = "";
  let lessonContent = "";

  if (body.lessonId) {
    const { data: lesson } = await supabase
      .from("lessons")
      .select("title")
      .eq("id", body.lessonId)
      .maybeSingle();
    lessonTitle = lesson?.title ?? "";

    const { data: blocks } = await supabase
      .from("content_blocks")
      .select("type, content")
      .eq("lesson_id", body.lessonId)
      .order("position", { ascending: true });

    lessonContent = blocksToText(blocks ?? [], { maxChars: 6000 });
  }

  const skillPack = body.skillPack || "general-tutor";
  const template = body.templateId ? getAuthoringTemplate(body.templateId) : null;
  const style = body.style || template?.style || "scene";
  const level = body.level || course?.level || "A1";

  const systemInstruction = `You are an expert language and interactive tutor curriculum designer for CS Learn.
You design short, engaging, spoken practice scenarios for an animated 3D/Rive AI teacher.
Return ONLY valid JSON matching the requested schema. No markdown fences or extra commentary.`;

  const prompt = `Create a speaking practice scenario for the animated AI Teacher.

Context:
- Course: ${course?.title ?? "Course"} (${course?.category ?? "General"})
- Course summary: ${course?.description ?? "N/A"}
${lessonTitle ? `- Lesson: ${lessonTitle}` : ""}
- Skill Pack: ${skillPack}
- Session Style: ${style} (scene = role-play, guided_lesson = step-by-step teaching + mini role-play, oral_check = exam-style speaking check)
${template ? `- Template: ${template.label} — ${template.promptHints}` : ""}
- Level: ${level}
${body.instructions ? `- Teacher instructions: ${body.instructions}` : ""}
${lessonContent ? `\nLesson material:\n${lessonContent}` : ""}

Return ONLY a valid JSON object with this exact shape:
{
  "title": "Short engaging scenario title (max 80 chars)",
  "goal": "Clear 1-2 sentence learner goal describing what they will achieve out loud",
  "level": "${level}",
  "max_minutes": ${template?.maxMinutes ?? 6},
  "scene": "${template?.defaultScene ?? SCENE_ARTBOARDS[0]}",
  "beats": [
    { "id": "beat-1", "goal": "Warm greeting and setting the scene", "boardContent": "Key points on board", "checkQuestion": "Quick check question", "targetItems": ["phrase 1"] }
  ],
  "target_items": [
    { "text": "Target word or phrase", "pron": "pronunciation / pinyin (optional)", "meaning": "English meaning" }
  ]
}

Rules:
- "scene" MUST be one of: ${SCENE_ARTBOARDS.join(", ")}.
- Provide 3 to 4 concise beats and 4 to 6 practical target_items.
- For language-zh, include hanzi in "text" and tone-marked pinyin in "pron".
- For language-es or language-fr, include natural target-language phrases in "text" and helpful pronunciation notes in "pron".`;

  try {
    const { data } = await aiJson(
      "practiceExercise",
      {
        contents: prompt,
        systemInstruction,
        responseJsonSchema: tutorScenarioSchema(SCENE_ARTBOARDS),
        maxOutputTokens: 2048,
      },
      { meter: { companyId: owned.company_id ?? ZEDAI_TENANT_ID, userId } },
    );

    return Response.json({
      scenario: normalizeTutorScenario(data as Record<string, unknown>, { level, scenes: SCENE_ARTBOARDS }),
    });
  } catch (err) {
    console.error("[generate-tutor-scenario] error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Could not generate scenario" },
      { status: 500 }
    );
  }
}
