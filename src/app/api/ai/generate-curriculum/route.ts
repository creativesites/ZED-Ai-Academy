import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { aiJson } from "@/lib/ai/call";
import { CURRICULUM_SCHEMA } from "@/lib/ai/generation/schemas";
import { validCurriculum } from "@/lib/ai/generation/parse";
import { ZEDAI_TENANT_ID } from "@/lib/tenants/constants";
import { NextRequest } from "next/server";
import { getCourseDomainPreset } from "@/lib/course-domain-presets";
import { canManageCourse } from "@/lib/courses/course-auth-server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { courseId, brief, domainPreset } = await req.json();
  if (!courseId) return Response.json({ error: "Missing courseId" }, { status: 400 });
  const preset = getCourseDomainPreset(domainPreset);

  const supabase = createClient();
  const { allowed, course: owned } = await canManageCourse(supabase, courseId, userId);
  if (!allowed || !owned) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { data: course } = await supabase
    .from("courses")
    .select("title, description, category, level")
    .eq("id", courseId)
    .single();

  if (!course) {
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
    const { data } = await aiJson(
      "curriculum",
      { contents: prompt, responseJsonSchema: CURRICULUM_SCHEMA, maxOutputTokens: 2000 },
      { meter: { companyId: owned.company_id ?? ZEDAI_TENANT_ID, userId } },
    );
    const parsed = validCurriculum(data);
    if (!parsed) {
      return Response.json({ error: "Invalid curriculum structure" }, { status: 500 });
    }

    return Response.json(parsed);
  } catch (error) {
    console.error("Curriculum generation error:", error);
    return Response.json({ error: "Failed to generate curriculum" }, { status: 500 });
  }
}
