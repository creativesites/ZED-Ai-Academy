import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gemini } from "@/lib/ai/gemini";
import { modelFor } from "@/lib/ai/models";
import { canManageCourse } from "@/lib/courses/course-auth-server";

export type CourseReviewResult = {
  overall_score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  sequencing_suggestions: string[];
  suggested_lessons: {
    module_title: string;
    lesson_title: string;
    rationale: string;
  }[];
};

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { courseId } = (await req.json()) as { courseId?: string };
  if (!courseId) {
    return Response.json({ error: "Missing courseId" }, { status: 400 });
  }

  const supabase = createClient();
  const { allowed } = await canManageCourse(supabase, courseId, userId);
  if (!allowed) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const [{ data: course }, { data: modulesRaw }] = await Promise.all([
    supabase
      .from("courses")
      .select("title, description, category, level")
      .eq("id", courseId)
      .single(),
    supabase
      .from("modules")
      .select("title, position, lessons(title, position, is_preview)")
      .eq("course_id", courseId)
      .order("position", { ascending: true }),
  ]);

  if (!course) {
    return Response.json({ error: "Course not found" }, { status: 404 });
  }

  const modules = (modulesRaw ?? []).map((m: any) => ({
    title: m.title,
    lessons: ((m.lessons ?? []) as { title: string; position: number; is_preview: boolean }[])
      .sort((a, b) => a.position - b.position)
      .map((l) => `${l.title}${l.is_preview ? " (Preview)" : ""}`),
  }));

  const prompt = `You are a senior instructional designer reviewing a course curriculum for clarity, pacing, practical outcomes, and learner progression.

Course Title: "${course.title}"
Category: ${course.category || "Not specified"}
Level: ${course.level || "Not specified"}
Description: ${course.description || "Not provided"}

Current Curriculum:
${
  modules.length > 0
    ? modules
        .map(
          (m, idx) =>
            `Module ${idx + 1}: ${m.title}\n` +
            (m.lessons.length > 0
              ? m.lessons.map((l, li) => `  ${idx + 1}.${li + 1} ${l}`).join("\n")
              : "  (No lessons yet)")
        )
        .join("\n\n")
    : "(No modules created yet)"
}

Return ONLY valid JSON with this exact schema:
{
  "overall_score": 0-100,
  "summary": "2-3 sentence constructive assessment of the course structure",
  "strengths": ["strength 1", "strength 2"],
  "gaps": ["gap or missing outcome 1", "gap 2"],
  "sequencing_suggestions": ["concrete sequencing or pacing improvement"],
  "suggested_lessons": [
    {
      "module_title": "Target module name",
      "lesson_title": "Specific suggested lesson title",
      "rationale": "Why this addition strengthens learner outcomes"
    }
  ]
}

Rules:
- Be specific to this course's actual modules and lessons.
- Keep arrays concise (2-4 items each).`;

  try {
    const response = await gemini.models.generateContent({
      model: modelFor("courseBlueprint"),
      contents: prompt,
      config: {
        maxOutputTokens: 1500,
        responseMimeType: "application/json",
      },
    });

    const raw = response.text ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      return Response.json({ error: "Invalid AI review response" }, { status: 500 });
    }

    const parsed = JSON.parse(match[0]) as CourseReviewResult;
    return Response.json(parsed);
  } catch (error) {
    console.error("Course review error:", error);
    return Response.json({ error: "Failed to review course" }, { status: 500 });
  }
}
