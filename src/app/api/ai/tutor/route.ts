import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { GEMINI_MODEL, gemini } from "@/lib/ai/gemini";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient();

  const { message, courseId, lessonId, moduleTitle, sectionTitle } = await req.json();

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
      const parts: string[] = [];
      for (const block of blocks) {
        const content = block.content as Record<string, unknown>;
        
        switch (block.type) {
          case "text":
            if (typeof content.html === "string") {
              const text = content.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
              if (text) parts.push(text);
            }
            break;
          case "ai_prompt":
            if (content.prompt) parts.push(`AI Prompt: ${content.prompt}`);
            break;
          case "steps":
            const steps = content.steps as { title: string; body: string }[];
            if (steps?.length) {
              parts.push(`Steps:\n${steps.map((s, i) => `${i + 1}. ${s.title}: ${s.body}`).join("\n")}`);
            }
            break;
          case "checklist":
            const items = content.items as string[];
            if (items?.length) {
              parts.push(`Checklist:\n- ${items.join("\n- ")}`);
            }
            break;
          case "key_takeaway":
            const points = content.points as string[];
            if (points?.length) {
              parts.push(`Key Takeaways:\n- ${points.join("\n- ")}`);
            }
            break;
          case "expert_note":
            if (content.note) parts.push(`Expert Note: ${content.note}`);
            break;
          case "case_study":
            if (content.title) parts.push(`Case Study: ${content.title}\n${content.body}\nOutcome: ${content.outcome}`);
            break;
          case "video":
            if (content.title) parts.push(`Video: ${content.title}`);
            break;
        }
      }
      if (parts.length > 0) {
        lessonContext = `\n\n=== LESSON CONTENT ===\n${parts.join("\n\n")}\n========================`;
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

  const systemPrompt = `You are an expert AI Tutor and Coach for Zed AI Academy. Your mission is to help learners master practical AI skills by teaching them the specific material in the current lesson.

${courseContext}
${locationContext}
${lessonContext}

Your Role & Personality:
- You are a proactive, encouraging, and highly technical coach.
- You have deep knowledge of the lesson content provided above. Always refer to specific prompts, steps, or takeaways from the lesson.
- Keep your explanations clear, actionable, and focused on real-world application (especially in African business contexts).
- Avoid generic AI advice. Use the specific frameworks and tools mentioned in the lesson.

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
    model: GEMINI_MODEL,
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
