import { auth } from "@clerk/nextjs/server";
import { GEMINI_MODEL, gemini } from "@/lib/ai/gemini";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { blockType, currentContent, instruction } = await req.json();
    if (!blockType || !currentContent || !instruction) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const prompt = `You are an expert AI Course Designer at Zed AI Academy.
Your task is to refine, expand, simplify, or edit the content of a single content block based on the teacher's instructions.

Block Type: "${blockType}"
Current Block Content:
${JSON.stringify(currentContent, null, 2)}

TEACHER'S INSTRUCTION:
"${instruction}"

INSTRUCTIONS:
1. Modify the JSON fields according to the teacher's instruction.
2. Maintain the exact JSON schema structure of the block type. Do NOT add new top-level fields outside the schema.
4. Return ONLY a valid JSON object matching the schema for "${blockType}". Do NOT wrap it in any markdown code fence or add any conversational introduction/explanation.
5. If editing or generating an "image" or "before_after" block, do NOT generate real image URLs. Keep or set the "url", "before_url", or "after_url" properties to an empty string (""), and write a clear, descriptive placeholder instruction inside the "caption" or "alt" fields so that the teacher knows exactly what type of image to upload here.

VALID SCHEMAS REFERENCE:
- "text": { "html": "<p>Content</p>" }
- "video": { "youtube_id": "...", "title": "..." }
- "image": { "url": "", "caption": "[Description: Upload an image showing X]", "alt": "Alternative text description of the image asset", "display": "contained" }
- "callout": { "variant": "tip|warning|info", "title": "...", "body": "..." }
- "tool_spotlight": { "name": "...", "description": "...", "url": "...", "icon_url": "..." }
- "before_after": { "before_url": "", "after_url": "", "caption": "Before and After comparison (Upload before/after images)" }
- "resource": { "file_url": "...", "file_name": "...", "file_size": 0 }
- "quiz": { "quiz_id": "..." }
- "ai_prompt": { "prompt": "...", "tool": "ChatGPT|Claude", "label": "Try This Prompt" }
- "steps": { "title": "...", "steps": [{ "title": "...", "body": "..." }] }
- "checklist": { "title": "...", "items": ["Item 1", "Item 2"] }
- "key_takeaway": { "title": "Key Takeaways", "points": ["Point 1", "Point 2"] }
- "expert_note": { "title": "...", "body": "..." }
- "comparison_table": { "headers": ["Col 1", "Col 2"], "rows": [["Val 1", "Val 2"]] }
- "case_study": { "title": "...", "context": "...", "action": "...", "result": "..." }
- "practice_exercise": { "title": "...", "brief": "...", "mode": "text_response", "estimated_minutes": 20, "instructions": ["..."], "deliverables": [{ "type": "text", "label": "Response", "required": true }], "allowed_file_types": ["text/plain"], "max_files": 1, "rubric": [], "ai_scoring_enabled": true, "instructor_review_required": false, "resubmissions_allowed": true }
- "learning_objectives": { "title": "Learning Objectives", "objectives": ["..."] }
- "glossary": { "title": "Glossary", "terms": [{ "term": "...", "definition": "..." }] }
- "discussion_prompt": { "title": "Discussion Prompt", "prompt": "...", "guidance": ["..."], "mode": "group" }
- "assignment": { "title": "Assignment", "summary": "...", "deliverables": ["..."], "assessment": "...", "estimated_minutes": 30 }
- "risk_assessment": { "title": "Risk Assessment", "rows": [{ "hazard": "...", "risk": "Low|Medium|High|Critical", "control": "..." }] }
- "meeting": { "title": "Live Meeting Session", "start_time": "...", "meeting_id": "...", "service_id": "..." }

Return ONLY the updated JSON block content:`;

    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { maxOutputTokens: 2500, responseMimeType: "application/json" },
    });

    const raw = response.text ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return Response.json({ error: "Invalid AI response format" }, { status: 500 });

    const newContent = JSON.parse(match[0]);
    return Response.json({ newContent });
  } catch (error) {
    console.error("Edit block content error:", error);
    return Response.json({ error: "Failed to edit block content" }, { status: 500 });
  }
}
