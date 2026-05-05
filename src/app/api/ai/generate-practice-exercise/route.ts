import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { GEMINI_MODEL, gemini } from "@/lib/ai/gemini";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient();

  const { lessonId, courseId } = await req.json();

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
      { error: "No lesson content found to generate exercise from" },
      { status: 422 }
    );
  }

  const lessonContent = contentParts.join("\n\n").slice(0, 8000);

  const systemInstruction = `You are an expert instructional designer for professional training products.

Return only valid JSON. Do not wrap it in markdown fences or add commentary.`;

  const prompt = `Based on the lesson content below, generate a comprehensive practice exercise.
The exercise should challenge the learner to apply what they've learned practically.

Return ONLY a valid JSON object with this exact structure:
{
  "title": "A short, engaging title for the exercise",
  "brief": "A 1-2 paragraph description of the problem statement and why it matters.",
  "mode": "one of: 'text_response', 'file_upload', 'combined', or 'studio_submission'",
  "estimated_minutes": number,
  "instructions": [
    "Step 1...",
    "Step 2...",
    "Step 3..."
  ],
  "rubric": [
    { "criterion": "Name of the criterion to grade on", "weight": 20 }
  ]
}

Lesson content:
${lessonContent}`;

  try {
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction,
        maxOutputTokens: 2048,
        temperature: 0.7,
        responseMimeType: "application/json",
      },
    });

    const raw = response.text ?? "{}";
    
    // Attempt to parse JSON directly
    let exercise;
    try {
      exercise = JSON.parse(raw);
    } catch (e) {
      // Fallback: extract JSON if it was wrapped in markdown despite instructions
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        exercise = JSON.parse(match[0]);
      } else {
        throw new Error("Failed to parse JSON");
      }
    }

    return Response.json({ exercise });
  } catch (err) {
    console.error("Practice exercise generation error:", err);
    return Response.json({ error: "Failed to generate exercise" }, { status: 500 });
  }
}
