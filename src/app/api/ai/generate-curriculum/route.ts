import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { GEMINI_MODEL, gemini } from "@/lib/ai/gemini";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { courseId, brief } = await req.json();
  if (!courseId) return Response.json({ error: "Missing courseId" }, { status: 400 });

  const supabase = createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("title, description, category, level, instructor_id")
    .eq("id", courseId)
    .single();

  if (!course || course.instructor_id !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const prompt = `You are a curriculum designer for a premium online AI academy targeting working professionals in Africa.

Course: "${course.title}"
Level: ${course.level || "beginner"}
Category: ${course.category || "AI & Technology"}
Description: ${course.description || "(not provided)"}
${brief ? `Creator's additional notes: ${brief}` : ""}

Design a complete course curriculum. Return ONLY valid JSON:
{
  "modules": [
    {
      "title": "Module title (outcome-focused)",
      "lessons": [
        { "title": "Lesson title (action-oriented)" },
        { "title": "Lesson title (action-oriented)" }
      ]
    }
  ]
}

Rules:
- Exactly 4 modules following this arc:
  1. Quick Win — get a real result in the first session
  2. Core Frameworks — the tools, models, and mental models
  3. Workflow Build — applying it in a real work scenario
  4. Capstone & Quality Control — final project + accuracy/safety check
- Each module: 3–5 lessons
- Module titles: outcome-focused ("Getting Results from ChatGPT in 20 Minutes")
- Lesson titles: action-oriented ("Write Prompts That Get Usable Output")
- No filler lessons. Every lesson must deliver something learners can use at work.`;

  try {
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { maxOutputTokens: 2000, responseMimeType: "application/json" },
    });

    const raw = response.text ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return Response.json({ error: "Invalid response" }, { status: 500 });

    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed.modules) || parsed.modules.length === 0) {
      return Response.json({ error: "Invalid curriculum structure" }, { status: 500 });
    }

    return Response.json(parsed);
  } catch (error) {
    console.error("Curriculum generation error:", error);
    return Response.json({ error: "Failed to generate curriculum" }, { status: 500 });
  }
}
