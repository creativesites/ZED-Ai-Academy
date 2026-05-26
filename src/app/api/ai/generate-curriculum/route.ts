import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { GEMINI_MODEL, gemini } from "@/lib/ai/gemini";
import { NextRequest } from "next/server";
import { getCourseDomainPreset } from "@/lib/course-domain-presets";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { courseId, brief, domainPreset } = await req.json();
  if (!courseId) return Response.json({ error: "Missing courseId" }, { status: 400 });
  const preset = getCourseDomainPreset(domainPreset);

  const supabase = createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("title, description, category, level, instructor_id")
    .eq("id", courseId)
    .single();

  if (!course || course.instructor_id !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const prompt = `You are a curriculum designer for a premium online academy. Create strong course structures that match the subject domain instead of forcing every course into an AI-business framing.

Course: "${course.title}"
Level: ${course.level || "beginner"}
Category: ${course.category || "AI & Technology"}
Domain preset: ${preset.label}
Domain guidance: ${preset.description}
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
- Exactly 4 modules.
- The module arc must match the domain preset:
  - AI & Digital Skills: quick win, frameworks, workflow build, quality control
  - Technical & Vocational: orientation, core procedure, applied troubleshooting, supervised task/project
  - Mining Safety: hazard awareness, safe procedure, field scenarios, compliance review
  - Primary School: foundation, guided practice, applied activity, recap/review
  - Secondary School: concept building, worked examples, practice/application, assessment/review
- Each module: 3–5 lessons
- Module titles: outcome-focused ("Getting Results from ChatGPT in 20 Minutes")
- Lesson titles: action-oriented ("Write Prompts That Get Usable Output")
- No filler lessons. Every lesson must deliver a usable learning outcome for the selected domain and age/context.`;

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
