import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { GEMINI_MODEL, gemini } from "@/lib/ai/gemini";
import { NextRequest } from "next/server";

type GeneratedQuestion = {
  question: string;
  options: string[];
  correct_indices: number[];
  explanation: string;
};

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient();

  const { lessonId, courseId, count = 3 } = await req.json();

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

  const { data: course } = await supabase
    .from("courses")
    .select("instructor_id")
    .eq("id", courseId)
    .single();

  if (!course || course.instructor_id !== userId) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Gather lesson content
  const { data: blocks } = await supabase
    .from("content_blocks")
    .select("type, content")
    .eq("lesson_id", lessonId)
    .order("position", { ascending: true });

  const contentParts: string[] = [];
  for (const block of blocks ?? []) {
    const content = block.content as Record<string, unknown>;
    if (block.type === "text" && typeof content.html === "string") {
      const text = content.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (text) contentParts.push(text);
    } else if (block.type === "video") {
      const title = typeof content.title === "string" ? content.title : "";
      if (title) contentParts.push(`Video lesson: ${title}`);
    }
  }

  if (contentParts.length === 0) {
    return Response.json(
      { error: "No lesson content found to generate questions from" },
      { status: 422 }
    );
  }

  const lessonContent = contentParts.join("\n\n").slice(0, 8000);

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
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    });

    const raw = response.text ?? "";

    // Extract JSON array from response
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) {
      return Response.json({ error: "Failed to parse generated questions" }, { status: 500 });
    }

    const questions: GeneratedQuestion[] = JSON.parse(match[0]);

    if (!Array.isArray(questions)) {
      return Response.json({ error: "Invalid response format" }, { status: 500 });
    }

    // Validate each question
    const valid = questions.every(
      (q) =>
        typeof q.question === "string" &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        Array.isArray(q.correct_indices) &&
        q.correct_indices.length > 0
    );

    if (!valid) {
      return Response.json({ error: "Generated questions failed validation" }, { status: 500 });
    }

    return Response.json({ questions });
  } catch (err) {
    console.error("Quiz generation error:", err);
    return Response.json({ error: "Failed to generate questions" }, { status: 500 });
  }
}
