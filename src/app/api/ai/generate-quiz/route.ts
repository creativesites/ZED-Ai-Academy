import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { aiJson } from "@/lib/ai/call";
import { QUIZ_QUESTIONS_SCHEMA } from "@/lib/ai/generation/schemas";
import { quizQuestionCount, validQuizQuestions } from "@/lib/ai/generation/parse";
import { ZEDAI_TENANT_ID } from "@/lib/tenants/constants";
import { blocksToText } from "@/lib/course-blocks/block-to-text";
import { canManageCourse } from "@/lib/courses/course-auth-server";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient();

  const { lessonId, courseId, count: rawCount } = await req.json();
  const count = quizQuestionCount(rawCount ?? 3);

  if (!lessonId || !courseId) {
    return Response.json({ error: "Missing lessonId or courseId" }, { status: 400 });
  }

  // Verify the user owns this course
  const { data: lesson } = await supabase
    .from("lessons")
    .select("module_id")
    .eq("id", lessonId)
    .single();

  if (!lesson) return Response.json({ error: "Lesson not found" }, { status: 404 });

  const { data: mod } = await supabase
    .from("modules")
    .select("course_id")
    .eq("id", lesson.module_id)
    .single();

  if (!mod || mod.course_id !== courseId) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { allowed, course } = await canManageCourse(supabase, courseId, userId);
  if (!allowed || !course) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Gather lesson content
  const { data: blocks } = await supabase
    .from("content_blocks")
    .select("type, content")
    .eq("lesson_id", lessonId)
    .order("position", { ascending: true });

  const lessonContent = blocksToText(blocks ?? [], { maxChars: 8000 });

  if (!lessonContent) {
    return Response.json(
      { error: "No lesson content found to generate questions from" },
      { status: 422 }
    );
  }

  const systemInstruction = `You are an expert quiz writer for professional training products.

Return only valid JSON. Do not wrap it in markdown fences or add commentary.`;

  const prompt = `Based on the lesson content below, generate exactly ${count} multiple-choice quiz questions.

Rules:
- Each question must test genuine understanding, not just memorisation of keywords
- Each question must have exactly 4 options
- Each question must have exactly 1 correct answer (correct_indices should have exactly one index: 0, 1, 2, or 3)
- Write a clear, brief explanation (1–2 sentences) of why the correct answer is right
- Questions should vary in difficulty (easy, medium, hard)

Return ONLY a valid JSON array with this exact structure:
[
  {
    "question": "...",
    "options": ["...", "...", "...", "..."],
    "correct_indices": [0],
    "explanation": "..."
  }
]

Lesson content:
${lessonContent}`;

  try {
    const { data } = await aiJson(
      "quiz",
      {
        contents: prompt,
        systemInstruction,
        responseJsonSchema: QUIZ_QUESTIONS_SCHEMA,
        maxOutputTokens: 2048,
      },
      { meter: { companyId: course.company_id ?? ZEDAI_TENANT_ID, userId }, shape: "array" },
    );

    const questions = validQuizQuestions(data);
    if (!questions) {
      return Response.json({ error: "Generated questions failed validation" }, { status: 500 });
    }

    return Response.json({ questions });
  } catch (err) {
    console.error("Quiz generation error:", err);
    return Response.json({ error: "Failed to generate questions" }, { status: 500 });
  }
}
