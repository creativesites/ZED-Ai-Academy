import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { gemini } from "@/lib/ai/gemini/client";
import { modelFor } from "@/lib/ai/models";
import { blocksToText } from "@/lib/course-blocks/block-to-text";
import { getLessonAccess } from "@/lib/courses/course-auth-server";
import { DEFAULT_TEACHER_NAME, safeTeacherName } from "@/lib/tutor/course-teacher";
import { buildDockContents } from "@/lib/tutor/dock-chat";
import { loadWeakMasteryRows } from "@/lib/tutor/mastery/server";
import { ZEDAI_TENANT_ID } from "@/lib/tenants/constants";
import { formatMasteryMemoryNotes } from "@/lib/tutor/mastery/evidence";
import { createDemoRateLimiter, DEMO_WINDOW_MS } from "@/lib/tutor/demo";
import { NextRequest } from "next/server";

const MAX_TUTOR_MESSAGE_CHARS = 2000;
const guestDockLimiter = createDemoRateLimiter({ limit: 20, windowMs: DEMO_WINDOW_MS });

function requestIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const supabase = createClient();

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return new Response("Invalid request body", { status: 400 });
  }

  const {
    message,
    history,
    courseId,
    lessonId,
    moduleTitle,
    sectionTitle,
    teacherName: rawTeacherName,
  } = payload as Record<string, unknown>;
  // Display name only; checked so it cannot carry instructions into the prompt.
  const teacherName = safeTeacherName(rawTeacherName) ?? DEFAULT_TEACHER_NAME;

  if (typeof message !== "string" || !message.trim() || message.length > MAX_TUTOR_MESSAGE_CHARS) {
    return new Response("Message is required and must be at most 2000 characters", { status: 400 });
  }

  // Enforce enrollment / preview / staff access when targeting a specific lesson.
  // Unauthenticated guests are only allowed on published, free courses with is_preview lessons.
  if (!userId) {
    if (typeof lessonId !== "string" || !lessonId.trim()) {
      return new Response("Unauthorized", { status: 401 });
    }
    const { data: lessonRowRaw } = await supabase
      .from("lessons")
      .select("id, is_preview, modules!inner(courses!inner(id, status, price_type))")
      .eq("id", lessonId)
      .maybeSingle();

    const lessonRow = lessonRowRaw as {
      is_preview?: boolean;
      modules?:
        | { courses?: { status?: string; price_type?: string } | Array<{ status?: string; price_type?: string }> }
        | Array<{ courses?: { status?: string; price_type?: string } | Array<{ status?: string; price_type?: string }> }>;
    } | null;
    const mod = Array.isArray(lessonRow?.modules) ? lessonRow.modules[0] : lessonRow?.modules;
    const crs = Array.isArray(mod?.courses) ? mod.courses[0] : mod?.courses;
    const allowedGuest =
      Boolean(lessonRow?.is_preview) && crs?.status === "published" && crs?.price_type === "free";
    if (!allowedGuest) {
      return new Response("Unauthorized", { status: 401 });
    }
    const budget = guestDockLimiter.take(`dock:${requestIp(req)}`);
    if (!budget.ok) {
      return new Response("Guest preview chat limit reached. Sign in for unlimited AI Teacher help!", {
        status: 429,
      });
    }
  } else if (typeof lessonId === "string" && lessonId.trim()) {
    const access = await getLessonAccess(supabase, lessonId, userId);
    if (!access.allowed) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  // Fetch lesson content blocks (with block ids so the dock can jump to video/sections)
  let lessonContext = "";
  let blockReferenceList = "";
  if (typeof lessonId === "string" && lessonId.trim()) {
    const { data: blocks } = await supabase
      .from("content_blocks")
      .select("id, type, content")
      .eq("lesson_id", lessonId)
      .order("position", { ascending: true });

    if (blocks && blocks.length > 0) {
      const lessonText = blocksToText(blocks, { maxChars: 24000 });
      if (lessonText) {
        lessonContext = `\n\n=== LESSON CONTENT ===\n${lessonText}\n========================`;
      }
      const refs = blocks
        .filter((b) => b.type === "video" || b.type === "text" || b.type === "quiz")
        .map((b) => {
          const content = (b.content ?? {}) as Record<string, unknown>;
          const title = typeof content.title === "string" && content.title ? ` (${content.title})` : "";
          return `- blockId="${b.id}" type=${b.type}${title}`;
        });
      if (refs.length > 0) {
        blockReferenceList = `\n\nLesson blocks (for :::lesson_ref::: jumps):\n${refs.join("\n")}`;
      }
    }
  }

  // Fetch course metadata + learner memory notes for cross-session continuity
  let courseContext = "";
  let companyId: string | null = null;
  if (typeof courseId === "string" && courseId.trim()) {
    const { data: course } = await supabase
      .from("courses")
      .select("title, description, company_id")
      .eq("id", courseId)
      .single();
    if (course) {
      companyId = course.company_id ?? ZEDAI_TENANT_ID;
      courseContext = `Course: ${course.title}\nDescription: ${course.description}`;
    }
  }

  // Only this course's tenant: without a resolved course, weak objectives from every academy the learner
  // belongs to would be pulled into this academy's prompt.
  const weakRows = userId && companyId
    ? await loadWeakMasteryRows({
        supabase,
        userId,
        companyId,
        courseId: typeof courseId === "string" ? courseId : null,
        limit: 5,
      })
    : [];
  const masteryNotes = formatMasteryMemoryNotes(weakRows, 5);
  const memorySection =
    masteryNotes.length > 0
      ? `\n\nLearner mastery notes from earlier sessions:\n${masteryNotes.map((n) => `- ${n}`).join("\n")}`
      : "";

  const locationContext = [
    typeof moduleTitle === "string" && moduleTitle && `Module: ${moduleTitle}`,
    typeof sectionTitle === "string" && sectionTitle && `Section: ${sectionTitle}`
  ].filter(Boolean).join("\n");

  const systemPrompt = `You are ${teacherName}, the AI teacher for this course on CS Learn. You sit beside the lesson and help the learner understand and apply the specific material in it. Speak as ${teacherName}, warmly and briefly, in the first person.

${courseContext}
${locationContext}${memorySection}${blockReferenceList}
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
- :::board { "title": "...", "kind": "bullets|steps|note|equation|code|table", "items": ["...", "..."], "text": "..." } ::: (pins key notes onto the teacher's board beside the conversation)
- :::lesson_ref { "label": "...", "blockId": "...", "seconds": 45 } ::: (renders a button that jumps the lesson video or block to that spot)
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

  const contents = buildDockContents(history, message);

  const stream = await gemini.models.generateContentStream({
    model: modelFor("tutor"),
    contents,
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: 1024,
    },
  });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.text) {
            controller.enqueue(encoder.encode(chunk.text));
          }
        }
      } catch (err) {
        console.error("[ai-tutor] stream error:", err);
        controller.enqueue(encoder.encode("\n\nSorry, I lost my connection mid-reply. Please try asking again."));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
