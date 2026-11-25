import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canManageCourse } from "@/lib/courses/course-auth-server";
import { blocksToText } from "@/lib/course-blocks/block-to-text";
import { gemini } from "@/lib/ai/gemini";
import { modelFor } from "@/lib/ai/models";
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
  const { allowed } = await canManageCourse(supabase, body.courseId, userId);
  if (!allowed) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
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
    const response = await gemini.models.generateContent({
      model: modelFor("practiceExercise"),
      contents: prompt,
      config: {
        systemInstruction,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    });

    const raw = response.text?.trim() ?? "";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    const scene =
      typeof parsed.scene === "string" && (SCENE_ARTBOARDS as readonly string[]).includes(parsed.scene)
        ? parsed.scene
        : "Scene_TeaHouse";

    return Response.json({
      scenario: {
        title: typeof parsed.title === "string" ? parsed.title : "Speaking practice",
        goal: typeof parsed.goal === "string" ? parsed.goal : "Practise the key concepts from this lesson out loud.",
        level: typeof parsed.level === "string" ? parsed.level : level,
        max_minutes: typeof parsed.max_minutes === "number" ? Math.min(30, Math.max(2, Math.round(parsed.max_minutes))) : 6,
        scene,
        beats: Array.isArray(parsed.beats) ? parsed.beats : [],
        target_items: Array.isArray(parsed.target_items) ? parsed.target_items : [],
      },
    });
  } catch (err) {
    console.error("[generate-tutor-scenario] error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Could not generate scenario" },
      { status: 500 }
    );
  }
}
