import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { gemini } from "@/lib/ai/gemini";
import { modelFor } from "@/lib/ai/models";
import { blocksToText } from "@/lib/course-blocks/block-to-text";
import { DEFAULT_TEACHER_NAME, safeTeacherName } from "@/lib/tutor/course-teacher";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient();

  const { message, courseId, lessonId, moduleTitle, sectionTitle, teacherName: rawTeacherName } = await req.json();
  // Display name only; checked so it cannot carry instructions into the prompt.
  const teacherName = safeTeacherName(rawTeacherName) ?? DEFAULT_TEACHER_NAME;

  if (!message || typeof message !== "string") {
    return new Response("Missing message", { status: 400 });
  }

  // Fetch lesson content blocks for context
  let lessonContext = "";
  if (lessonId) {
    const { data: blocks } = await supabase
      .from("content_blocks")
      .select("type, content")
      .eq("lesson_id", lessonId)
      .order("position", { ascending: true });

    if (blocks && blocks.length > 0) {
      const lessonText = blocksToText(blocks, { maxChars: 24000 });
      if (lessonText) {
        lessonContext = `\n\n=== LESSON CONTENT ===\n${lessonText}\n========================`;
      }
    }
  }

  // Fetch course metadata for context
  let courseContext = "";
  if (courseId) {
    const { data: course } = await supabase
      .from("courses")
      .select("title, description")
      .eq("id", courseId)
      .single();
    if (course) {
      courseContext = `Course: ${course.title}\nDescription: ${course.description}`;
    }
  }

  const locationContext = [
    moduleTitle && `Module: ${moduleTitle}`,
    sectionTitle && `Section: ${sectionTitle}`
  ].filter(Boolean).join("\n");

  const systemPrompt = `You are ${teacherName}, the AI teacher for this course on Zed AI Academy. You sit beside the lesson and help the learner understand and apply the specific material in it. Speak as ${teacherName}, warmly and briefly, in the first person.

${courseContext}
${locationContext}
${lessonContext}

Your Role & Personality:
- You are a proactive, encouraging, and highly technical coach.
- You have deep knowledge of the lesson content provided above. Always refer to specific prompts, steps, or takeaways from the lesson.
- Keep your explanations clear, actionable, and focused on real-world application (especially in African business contexts).
- Avoid generic AI advice. Use the specific frameworks and tools mentioned in the lesson.

How you teach:
- One idea at a time. Start with a concrete, everyday example (Zambian workplaces, small businesses, markets, farming and mobile money work well), then the general rule.
- When the learner asks to be quizzed, ask ONE question, wait for their answer, then give feedback before the next.
- When the learner is wrong, ask a guiding question before giving the answer.
- If the lesson does not cover something, say so instead of inventing course content.

Interactive Teaching:
- When explaining a concept, try to use one of the specialized interactive components to make it visual.
- If a learner seems confused, offer a :::knowledge_check::: to test their understanding.
- If they want to apply the lesson, provide a :::prompt_template::: or :::workflow_steps:::.

Component Syntax:
Use EXACTLY this syntax: :::component_name { "prop": "value" } :::

Available Components:
- :::prompt_template { "title": "...", "prompt": "...", "description": "..." } :::
- :::workflow_steps { "steps": [{ "title": "...", "description": "..." }] } :::
- :::tool_spotlight { "name": "...", "description": "...", "url": "...", "category": "..." } :::
- :::comparison_table { "headers": ["...", "..."], "rows": [["...", "..."]], "caption": "..." } :::
- :::checklist { "title": "...", "items": ["...", "..."] } :::
- :::prompt_iteration { "before": "...", "after": "...", "reasoning": "..." } :::
- :::resource_link { "title": "...", "url": "...", "type": "pdf|link|doc", "description": "..." } :::
- :::action_card { "title": "...", "actionLabel": "...", "type": "save|download|action", "description": "..." } :::
- :::knowledge_check { "question": "...", "options": ["...", "..."], "correctIndex": 0, "explanation": "..." } :::
- :::code_snippet { "code": "...", "language": "...", "title": "..." } :::

Guidelines:
1. Refer to the specific "LESSON CONTENT" provided.
2. Be direct and concise. No fluff.
3. If the user asks for a prompt, use the :::prompt_template::: component.
4. If they ask for steps, use the :::workflow_steps::: component.
5. Use practical examples relevant to the course topic.`;

  const stream = await gemini.models.generateContentStream({
    model: modelFor("tutor"),
    contents: message,
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: 1024,
    },
  });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.text) {
          controller.enqueue(encoder.encode(chunk.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
