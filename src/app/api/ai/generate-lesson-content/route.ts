import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { GEMINI_MODEL, gemini } from "@/lib/ai/gemini";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { lessonId, courseId, brief } = await req.json();
  if (!lessonId || !courseId) {
    return Response.json({ error: "Missing lessonId or courseId" }, { status: 400 });
  }

  const supabase = createClient();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("title, module_id")
    .eq("id", lessonId)
    .single();
  if (!lesson) return Response.json({ error: "Lesson not found" }, { status: 404 });

  const { data: mod } = await supabase
    .from("modules")
    .select("title, course_id")
    .eq("id", lesson.module_id)
    .single();
  if (!mod || mod.course_id !== courseId) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { data: course } = await supabase
    .from("courses")
    .select("title, description, level, instructor_id")
    .eq("id", courseId)
    .single();
  if (!course || course.instructor_id !== userId) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const prompt = `You are writing lesson content for a professional online AI course.

Course: "${course.title}" (${course.level || "beginner"} level)
Module: "${mod.title}"
Lesson: "${lesson.title}"
${brief ? `Creator's notes: ${brief}` : ""}

Generate a complete, ready-to-publish lesson content package. Return ONLY valid JSON:
{
  "blocks": [
    {
      "type": "text",
      "content": {
        "html": "<p>...</p><p>...</p><p>...</p>"
      }
    },
    {
      "type": "callout",
      "content": {
        "variant": "tip",
        "title": "Quick Win",
        "body": "..."
      }
    },
    {
      "type": "steps",
      "content": {
        "title": "How to ...",
        "steps": [
          { "title": "Step 1 title", "body": "Step 1 description..." },
          { "title": "Step 2 title", "body": "Step 2 description..." },
          { "title": "Step 3 title", "body": "Step 3 description..." }
        ]
      }
    },
    {
      "type": "key_takeaway",
      "content": {
        "title": "Key Takeaways",
        "points": ["Point 1", "Point 2", "Point 3", "Point 4"]
      }
    },
    {
      "type": "ai_prompt",
      "content": {
        "prompt": "A full prompt the learner can copy-paste into an AI tool",
        "tool": "ChatGPT",
        "label": "Try This Now"
      }
    }
  ]
}

Content rules:
- text: 3–4 paragraphs. Direct, practical, workplace-applicable. Use <p> tags only.
- callout: a genuinely time-saving tip. variant must be exactly "tip".
- steps: 3–5 numbered steps the learner can follow right now.
- key_takeaway: 3–5 bullet points that capture the most important ideas.
- ai_prompt: a real, complete prompt they can paste into ChatGPT or Claude. Make it specific to this lesson's topic.
- Tone: professional, direct, Africa-aware where natural.
- Return EXACTLY these 5 blocks in this order. No extra blocks.`;

  try {
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { maxOutputTokens: 3500, responseMimeType: "application/json" },
    });

    const raw = response.text ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return Response.json({ error: "Invalid response" }, { status: 500 });

    const { blocks } = JSON.parse(match[0]);
    if (!Array.isArray(blocks) || blocks.length === 0) {
      return Response.json({ error: "No blocks generated" }, { status: 500 });
    }

    return Response.json({ blocks });
  } catch (error) {
    console.error("Lesson content generation error:", error);
    return Response.json({ error: "Failed to generate content" }, { status: 500 });
  }
}
