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

  const { message, courseId, lessonId } = await req.json();

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
        if (block.type === "text" && typeof content.html === "string") {
          // Strip HTML tags for context
          const text = content.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          if (text) parts.push(text);
        } else if (block.type === "video") {
          const title = typeof content.title === "string" ? content.title : "";
          if (title) parts.push(`Video: ${title}`);
        }
      }
      if (parts.length > 0) {
        lessonContext = `\n\nLesson content:\n${parts.join("\n\n")}`;
      }
    }
  }

  // Fetch course title for context
  let courseTitle = "";
  if (courseId) {
    const { data: course } = await supabase
      .from("courses")
      .select("title")
      .eq("id", courseId)
      .single();
    if (course) courseTitle = course.title;
  }

  const systemPrompt = `You are an expert AI tutor for Zed AI Academy, a platform that teaches practical AI skills.${courseTitle ? ` The learner is studying "${courseTitle}".` : ""}${lessonContext}

Your role:
- Answer questions clearly and concisely about AI concepts, tools, and techniques
- Refer to the lesson content above when relevant
- Use practical examples, especially ones relevant to African business contexts
- Keep responses focused and actionable — avoid unnecessary padding
- If asked something outside the course scope, briefly redirect to relevant AI learning topics

Respond in clear, professional Markdown. You can also trigger interactive in-chat components by using the following syntax:
:::component_name { "prop": "value" } :::

Available components:
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

Only use these components when they add real value to the learner's experience. Keep standard text as Markdown.
Use practical examples relevant to African business contexts.
Avoid excessive padding; be actionable and direct.`;

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
