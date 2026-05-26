import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { GEMINI_MODEL, gemini } from "@/lib/ai/gemini";
import { NextRequest } from "next/server";
import { getCourseDomainPreset } from "@/lib/course-domain-presets";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { lessonId, courseId, brief, domainPreset } = await req.json();
  if (!lessonId || !courseId) {
    return Response.json({ error: "Missing lessonId or courseId" }, { status: 400 });
  }
  const preset = getCourseDomainPreset(domainPreset);

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

  const prompt = `You are a world-class instructional designer at Zed AI Academy. Your goal is to generate a comprehensive, engaging, and ready-to-publish lesson content package.

Course Context:
- Course: "${course.title}" (${course.level || "beginner"} level)
- Module: "${mod.title}"
- Lesson: "${lesson.title}"
- Domain preset: "${preset.label}"
- Domain guidance: "${preset.description}"
${brief ? `- Specific Creator Instructions: ${brief}` : ""}

YOUR TASK:
Generate a sequence of high-quality content blocks that teach this lesson's topic effectively. Use a variety of block types to maintain engagement.

VALID BLOCK TYPES & SCHEMAS:
1. "text": { "html": "<p>Professional, direct, and practical content. Use <p>, <strong>, <em> tags.</p>" }
2. "callout": { "variant": "tip" | "info" | "warning", "title": "...", "body": "..." }
3. "key_takeaway": { "title": "Key Takeaways", "points": ["Point 1", "Point 2", ...] }
4. "steps": { "title": "How to...", "steps": [{ "title": "Step title", "body": "Step description" }] }
5. "ai_prompt": { "prompt": "A full, specific prompt for ChatGPT/Claude", "tool": "ChatGPT" | "Claude", "label": "Try This Prompt" }
6. "tool_spotlight": { "name": "Tool Name", "description": "Why it's useful for this lesson", "url": "...", "icon_url": "..." }
7. "expert_note": { "title": "Pro Insight", "body": "Advanced nuance or technical detail" }
8. "comparison_table": { "headers": ["Option A", "Option B"], "rows": [["Feature", "Detail A", "Detail B"]] }
9. "case_study": { "title": "Real World Example", "context": "...", "action": "...", "result": "..." }
10. "learning_objectives": { "title": "Learning Objectives", "objectives": ["..."] }
11. "glossary": { "title": "Glossary", "terms": [{ "term": "...", "definition": "..." }] }
12. "discussion_prompt": { "title": "Discussion Prompt", "prompt": "...", "guidance": ["..."], "mode": "group" }
13. "assignment": { "title": "Assignment", "summary": "...", "deliverables": ["..."], "assessment": "...", "estimated_minutes": 30 }
14. "risk_assessment": { "title": "Risk Assessment", "rows": [{ "hazard": "...", "risk": "Low|Medium|High|Critical", "control": "..." }] }
15. "video": { "youtube_id": "dQw4w9WgXcQ", "title": "Watch This Explanation Video" }
16. "image": { "url": "", "caption": "[Description: Upload an image showing X, e.g. A visual diagram of a computer network setup]", "alt": "Alternative text description of what the image should show", "display": "contained" }
17. "before_after": { "before_url": "", "after_url": "", "caption": "Before and After comparison (Upload before/after images)" }
18. "resource": { "file_url": "https://example.com/handout.pdf", "file_name": "Class Handout PDF", "file_size": 2048576 }
19. "checklist": { "title": "Required Checklist", "items": ["Item 1", "Item 2", "Item 3"] }
20. "meeting": { "title": "Live Session Check-in", "start_time": "Tomorrow at 10 AM", "meeting_id": "Zoom meeting ID or empty", "service_id": "Booking service ID or empty" }
21. "practice_exercise": { "title": "Practice Activity", "brief": "Description of the practice task", "mode": "text_response", "estimated_minutes": 20, "instructions": ["Step 1", "Step 2"], "deliverables": [{ "type": "text", "label": "Your Answer", "required": true }], "allowed_file_types": ["text/plain"], "max_files": 1, "rubric": [], "ai_scoring_enabled": true, "instructor_review_required": false, "resubmissions_allowed": true }

GUIDELINES:
- Variety: Mix text with interactive/visual blocks (callouts, steps, tables).
- Image Blocks: When generating an "image" or "before_after" block, set the "url" / "before_url" / "after_url" properties to an empty string (""). Write a clear, descriptive instruction inside the "caption" or "alt" fields so the teacher knows exactly what type of image to upload here.
- Order: Start with an introduction (text), then dive into details, include a practical or reflective element, and end with key_takeaways or assignment.
- Tone: Professional, action-oriented, and concise.
- Length: Generate 5-8 blocks total.
- Choose blocks that fit the domain preset:
  - AI & Digital Skills: often use ai_prompt, tool_spotlight, comparison_table.
  - Technical & Vocational: often use steps, checklist, assignment, case_study.
  - Mining Safety: often use risk_assessment, checklist, callout, case_study.
  - Primary School: often use learning_objectives, glossary, discussion_prompt, assignment.
  - Secondary School: often use learning_objectives, glossary, comparison_table, discussion_prompt, assignment.

Return ONLY a valid JSON object:
{
  "blocks": [
    { "type": "text", "content": { "html": "..." } },
    ...
  ]
}`;

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
