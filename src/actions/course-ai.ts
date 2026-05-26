"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import type { ContentBlockType, Json, CourseLevel } from "@/types/database";

export type BlueprintContentBlock = {
  type: ContentBlockType;
  content: Json;
};

export type BlueprintLesson = {
  title: string;
  content_blocks: BlueprintContentBlock[];
};

export type BlueprintModule = {
  title: string;
  lessons: BlueprintLesson[];
};

export type CourseBlueprint = {
  title?: string;
  description?: string;
  category?: string;
  level?: CourseLevel;
  modules: BlueprintModule[];
};

type ContentBlockRow = { type: ContentBlockType; content: Json; position: number };
type LessonBlueprintRow = { title: string; position: number; content_blocks?: ContentBlockRow[] | null };
type ModuleBlueprintRow = { title: string; lessons?: LessonBlueprintRow[] | null };

/**
 * Exports a full course structure as a JSON blueprint and generates an AI prompt.
 */
export async function exportCourseBlueprint(courseId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();

  // Fetch course basics
  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();

  if (!course) throw new Error("Course not found");

  // Fetch all modules, lessons, and blocks in order
  const { data: modulesData } = await supabase
    .from("modules")
    .select(`
      id, 
      title, 
      position,
      lessons (
        id, 
        title, 
        position,
        content_blocks (
          type,
          content,
          position
        )
      )
    `)
    .eq("course_id", courseId)
    .order("position", { ascending: true });

  const blueprint: CourseBlueprint = {
    title: course.title,
    description: course.description || "",
    category: course.category || "",
    level: course.level || "beginner",
    modules: ((modulesData || []) as ModuleBlueprintRow[]).map((m) => ({
      title: m.title,
      lessons: (m.lessons || [])
        .sort((a, b) => a.position - b.position)
        .map((l) => ({
          title: l.title,
          content_blocks: (l.content_blocks || [])
            .sort((a, b) => a.position - b.position)
            .map((cb) => ({
              type: cb.type,
              content: cb.content,
            })),
        })),
    })),
  };

  const promptText = `
You are an expert AI Course Designer at Zed AI Academy. 
Your task is to analyze, expand, or refine the following course curriculum.

CURRENT COURSE JSON:
${JSON.stringify(blueprint, null, 2)}

INSTRUCTIONS:
1. Maintain the existing JSON structure.
2. Ensure every lesson has high-quality content blocks. Use ONLY the valid block types and their exact JSON schemas listed below.
3. If creating new modules/lessons, ensure they follow a logical pedagogical flow.
4. Return ONLY the valid JSON object for the updated course.

VALID CONTENT BLOCK TYPES & SCHEMAS:
- "text": { "html": "<p>Content</p>" }
- "video": { "youtube_id": "...", "title": "..." }
- "image": { "url": "...", "caption": "...", "alt": "...", "display": "contained" }
- "callout": { "variant": "tip|warning|info", "title": "...", "body": "..." }
- "tool_spotlight": { "name": "...", "description": "...", "url": "...", "icon_url": "..." }
- "before_after": { "before_url": "...", "after_url": "...", "caption": "..." }
- "resource": { "file_url": "...", "file_name": "...", "file_size": 0 }
- "quiz": { "quiz_id": "..." }
- "ai_prompt": { "prompt": "...", "tool": "ChatGPT", "label": "Try This Prompt" }
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
- "meeting": { "title": "Live Meeting Session", "start_time": "Tomorrow at 10 AM", "meeting_id": "Optional Zoom ID", "service_id": "Optional Bookable Service ID" }

RESPONSE FORMAT:
{
  "title": "...",
  "description": "...",
  "category": "...",
  "level": "...",
  "modules": [
    {
      "title": "...",
      "lessons": [
        {
          "title": "...",
          "content_blocks": [
            { "type": "text", "content": { "html": "..." } },
            ...
          ]
        }
      ]
    }
  ]
}
`.trim();

  return { blueprint, promptText };
}

/**
 * Imports a JSON blueprint into an existing course or creates a new one.
 */
export async function importCourseBlueprint(courseId: string, blueprint: CourseBlueprint) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();

  // 1. Update course metadata if requested
  if (blueprint.title || blueprint.description) {
    await supabase
      .from("courses")
      .update({
        title: blueprint.title,
        description: blueprint.description,
        category: blueprint.category,
        level: blueprint.level ?? null,
      })
      .eq("id", courseId);
  }

  // 2. Process Modules
  for (let mIdx = 0; mIdx < blueprint.modules.length; mIdx++) {
    const bMod = blueprint.modules[mIdx];
    
    // Check if module exists by title (simple matching for expansion)
    const { data: existingMod } = await supabase
      .from("modules")
      .select("id")
      .eq("course_id", courseId)
      .eq("title", bMod.title)
      .maybeSingle();

    let moduleId = existingMod?.id;

    if (!moduleId) {
      const { data: newMod, error: modErr } = await supabase
        .from("modules")
        .insert({
          course_id: courseId,
          title: bMod.title,
          position: mIdx + 1,
        })
        .select()
        .single();
      
      if (modErr) throw new Error(`Failed to create module: ${modErr.message}`);
      moduleId = newMod.id;
    }

    // 3. Process Lessons
    for (let lIdx = 0; lIdx < bMod.lessons.length; lIdx++) {
      const bLess = bMod.lessons[lIdx];

      const { data: existingLess } = await supabase
        .from("lessons")
        .select("id")
        .eq("module_id", moduleId)
        .eq("title", bLess.title)
        .maybeSingle();

      let lessonId = existingLess?.id;

      if (!lessonId) {
        const { data: newLess, error: lessErr } = await supabase
          .from("lessons")
          .insert({
            module_id: moduleId,
            title: bLess.title,
            position: lIdx + 1,
          })
          .select()
          .single();
        
        if (lessErr) throw new Error(`Failed to create lesson: ${lessErr.message}`);
        lessonId = newLess.id;
      }

      // 4. Process Content Blocks (usually we replace these for a clean import)
      if (bLess.content_blocks?.length > 0) {
        // Delete existing blocks if any (optional, depends on policy)
        // For now, we'll append if they don't exist, or we can clear them.
        // Let's check if there are blocks
        const { data: existingBlocks } = await supabase
          .from("content_blocks")
          .select("id")
          .eq("lesson_id", lessonId);

        if (!existingBlocks || existingBlocks.length === 0) {
          const blocksToInsert = bLess.content_blocks.map((b, i) => ({
            lesson_id: lessonId,
            type: b.type,
            content: b.content,
            position: i + 1,
          }));

          const { error: blockErr } = await supabase
            .from("content_blocks")
            .insert(blocksToInsert);
          
          if (blockErr) throw new Error(`Failed to create blocks for ${bLess.title}: ${blockErr.message}`);
        }
      }
    }
  }

  revalidatePath(`/creator/courses/${courseId}`);
  return { success: true };
}

export type CurriculumModuleInput = {
  title: string;
  lessons: { title: string }[];
};

export async function scaffoldCurriculum(
  courseId: string,
  modules: CurriculumModuleInput[]
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("instructor_id")
    .eq("id", courseId)
    .single();
  if (!course || course.instructor_id !== userId) throw new Error("Unauthorized");

  const { data: existing } = await supabase
    .from("modules")
    .select("position")
    .eq("course_id", courseId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextModulePos = (existing?.position ?? 0) + 1;

  for (const mod of modules) {
    const { data: newMod, error: modErr } = await supabase
      .from("modules")
      .insert({ course_id: courseId, title: mod.title, position: nextModulePos++ })
      .select("id")
      .single();
    if (modErr || !newMod) throw new Error(modErr?.message ?? "Failed to create module");

    for (let li = 0; li < mod.lessons.length; li++) {
      const { error: lesErr } = await supabase
        .from("lessons")
        .insert({ module_id: newMod.id, title: mod.lessons[li].title, position: li + 1 });
      if (lesErr) throw new Error(lesErr.message);
    }
  }

  revalidatePath(`/creator/courses/${courseId}`);
  return { success: true };
}
