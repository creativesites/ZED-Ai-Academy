import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { gemini } from "@/lib/ai/gemini";
import { modelFor } from "@/lib/ai/models";
import { NextRequest } from "next/server";
import { getCourseDomainPreset } from "@/lib/course-domain-presets";
import { canManageCourse } from "@/lib/courses/course-auth-server";

type CoAuthorMode = "full_lesson" | "practice_steps" | "summary_recap";

const MODE_INSTRUCTIONS: Record<CoAuthorMode, string> = {
  full_lesson:
    "Generate 5-7 varied blocks forming a complete lesson: start with learning_objectives or an intro text block, build core concepts with steps/comparison_table/case_study/callout, include a practical activity, and end with key_takeaway.",
  practice_steps:
    "Generate 3-4 hands-on blocks focused on application: steps, practice_exercise, checklist, and/or ai_prompt or assignment.",
  summary_recap:
    "Generate 3 concise recap blocks: key_takeaway, checklist, and glossary or callout to reinforce what was taught.",
};

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const {
    lessonId,
    courseId,
    brief,
    domainPreset,
    mode = "full_lesson",
    existingBlockTypes = [],
  } = (await req.json()) as {
    lessonId?: string;
    courseId?: string;
    brief?: string;
    domainPreset?: string;
    mode?: CoAuthorMode;
    existingBlockTypes?: string[];
  };

  if (!lessonId || !courseId) {
    return Response.json({ error: "Missing lessonId or courseId" }, { status: 400 });
  }
  const preset = getCourseDomainPreset(domainPreset);

  const supabase = createClient();

  const { allowed } = await canManageCourse(supabase, courseId, userId);
  if (!allowed) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

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
    .select("title, description, level")
    .eq("id", courseId)
    .single();
  if (!course) {
    return Response.json({ error: "Course not found" }, { status: 404 });
  }

  const modeRule = MODE_INSTRUCTIONS[mode] ?? MODE_INSTRUCTIONS.full_lesson;
  const existingNote =
    existingBlockTypes.length > 0
      ? `- Existing blocks already in this lesson: ${existingBlockTypes.join(", ")}. Complement them without repeating identical blocks.`
      : "- This lesson is currently empty.";

  const prompt = `You are an expert instructional designer at CS Learn. Generate engaging, practical, ready-to-publish lesson content blocks.

Course Context:
- Course: "${course.title}" (${course.level || "beginner"} level)
- Module: "${mod.title}"
- Lesson: "${lesson.title}"
- Domain preset: "${preset.label}"
- Domain guidance: "${preset.description}"
${existingNote}
${brief ? `- Creator Instructions: ${brief}` : ""}

GENERATION GOAL:
${modeRule}

VALID BLOCK TYPES & SCHEMAS:
1. "text": { "html": "<p>Clear, direct, practical content. Use <p>, <strong>, <em>, <ul>, <li> tags.</p>" }
2. "callout": { "variant": "tip" | "info" | "warning", "title": "...", "body": "..." }
3. "key_takeaway": { "title": "Key Takeaways", "points": ["Point 1", "Point 2", ...] }
4. "steps": { "title": "How to...", "steps": [{ "title": "Step title", "body": "Step description" }] }
5. "ai_prompt": { "prompt": "A full, specific prompt for an AI assistant", "tool": "ChatGPT" | "Claude" | "Gemini", "label": "Try This Prompt" }
6. "tool_spotlight": { "name": "Tool Name", "description": "Why it is useful for this lesson", "url": "", "icon_url": "" }
7. "expert_note": { "title": "Pro Insight", "body": "Advanced nuance or practical tip" }
8. "comparison_table": { "headers": ["Aspect", "Option A", "Option B"], "rows": [["Feature", "Detail A", "Detail B"]] }
9. "case_study": { "title": "Real World Example", "context": "...", "action": "...", "result": "..." }
10. "learning_objectives": { "title": "Learning Objectives", "objectives": ["..."] }
11. "glossary": { "title": "Glossary", "terms": [{ "term": "...", "definition": "..." }] }
12. "discussion_prompt": { "title": "Discussion Prompt", "prompt": "...", "guidance": ["..."], "mode": "group" }
13. "assignment": { "title": "Assignment", "summary": "...", "deliverables": ["..."], "assessment": "...", "estimated_minutes": 30 }
14. "risk_assessment": { "title": "Risk Assessment", "rows": [{ "hazard": "...", "risk": "Low|Medium|High|Critical", "control": "..." }] }
15. "image": { "url": "", "caption": "Suggested visual: describe what diagram or photo the instructor should upload here", "alt": "Alt description", "display": "contained" }
16. "checklist": { "title": "Checklist", "items": ["Item 1", "Item 2", "Item 3"] }
17. "practice_exercise": { "title": "Practice Activity", "brief": "Description of the practice task", "mode": "text_response", "estimated_minutes": 20, "instructions": ["Step 1", "Step 2"], "deliverables": [{ "type": "text", "label": "Your Response", "required": true }], "allowed_file_types": ["text/plain"], "max_files": 1, "rubric": [], "ai_scoring_enabled": true, "instructor_review_required": false, "resubmissions_allowed": true }

RULES:
- NEVER invent fake YouTube IDs or fake external URLs. Do NOT use "video" or "resource" blocks.
- For "image" blocks, always leave "url" as "" and write a helpful visual prompt in "caption".
- Keep writing crisp, accurate, and tailored to "${lesson.title}".

Return ONLY a valid JSON object:
{
  "blocks": [
    { "type": "text", "content": { "html": "..." } }
  ]
}`;

  try {
    const response = await gemini.models.generateContent({
      model: modelFor("lessonContent"),
      contents: prompt,
      config: { maxOutputTokens: 3500, responseMimeType: "application/json" },
    });

    const raw = response.text ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return Response.json({ error: "Invalid AI response" }, { status: 500 });

    const { blocks } = JSON.parse(match[0]);
    if (!Array.isArray(blocks) || blocks.length === 0) {
      return Response.json({ error: "No blocks generated" }, { status: 500 });
    }

    return Response.json({ blocks });
  } catch (error) {
    console.error("Lesson content generation error:", error);
    return Response.json({ error: "Generation failed" }, { status: 500 });
  }
}
