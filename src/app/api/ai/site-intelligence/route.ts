import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { GEMINI_MODEL, gemini } from "@/lib/ai/gemini";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  
  const { message, pathname, history = [] } = await req.json();

  if (!message || typeof message !== "string") {
    return new Response("Missing message", { status: 400 });
  }

  const supabase = await createClient();

  // Determine site area context
  let areaContext = "General marketing site";
  if (pathname.startsWith("/creator")) areaContext = "Creator Studio (Course Building)";
  else if (pathname.startsWith("/dashboard")) areaContext = "Student Dashboard";
  else if (pathname.includes("/learn")) areaContext = "Lesson Workspace";

  const tools: any[] = [
    {
      functionDeclarations: [
        {
          name: "list_courses",
          description: "Retrieve a list of all published AI courses on Zed AI Academy. Use this when the user asks what courses are available or for recommendations. NEVER mention courses that are not in this list.",
          parameters: { type: "OBJECT", properties: {} }
        },
        {
          name: "get_course_details",
          description: "Get full details for a specific course by its slug. Use this to provide deep info about a course's curriculum and value.",
          parameters: {
            type: "OBJECT",
            properties: {
              slug: { type: "STRING", description: "The course slug (e.g., 'ai-photography')." }
            },
            required: ["slug"]
          }
        },
        {
          name: "search_content",
          description: "Search for courses or lessons related to specific topics, skills, or AI tools.",
          parameters: {
            type: "OBJECT",
            properties: {
              query: { type: "STRING", description: "The search query." }
            },
            required: ["query"]
          }
        }
      ]
    }
  ];

  const systemPrompt = `You are "Zed Intelligence", the premium AI companion for Zed AI Academy (Zambia's leading AI skills platform).

CONTEXT:
- Area: ${areaContext}
- Path: ${pathname}

YOUR MISSION:
1. Be highly conversational, proactive, and helpful. Don't just answer questions; lead the user to their next win.
2. Provide expert advice on AI workflows, prompt engineering, and professional growth in the Zambian/Global context.
3. ABSOLUTELY NO HALLUCINATIONS about courses. Use the tools provided to check our actual curriculum. If we don't have a specific course, offer to help them find something related or suggest they join the waitlist.
4. Use specialized UI components to make your answers visual and actionable.

INTERACTIVE COMPONENTS:
Trigger components using: :::component_name { "prop": "value" } :::
- :::course_card { "title": "...", "slug": "...", "description": "...", "category": "...", "level": "beginner|intermediate|advanced", "thumbnail_url": "..." } ::: (Use this to recommend specific courses)
- :::action_card { "title": "...", "actionLabel": "...", "type": "link", "href": "...", "description": "..." } ::: (Use for clear next steps or external links)
- :::prompt_template { "title": "...", "prompt": "...", "description": "..." } ::: (For reusable AI prompts)
- :::workflow_steps { "steps": [{ "title": "...", "description": "..." }] } ::: (For step-by-step guides)
- :::tool_spotlight { "name": "...", "description": "...", "url": "...", "category": "..." } ::: (Highlighting AI tools)
- :::comparison_table { "headers": ["...", "..."], "rows": [["...", "..."]] } ::: (Comparing methods)
- :::checklist { "title": "...", "items": ["...", "..."] } ::: (Verification tasks)

STYLE:
- Professional but encouraging ("Coach" persona).
- Concise but dense with value.
- Use local context (ZMW, Zambian business examples) where it adds value.
- If you use a tool, wait for the data before finalizing your answer.`;

  // Prepare contents for AI
  const contents: any[] = [
    ...history.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    })),
    { role: "user", parts: [{ text: message }] }
  ];

  try {
    let response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: systemPrompt,
        tools,
      },
    });

    let parts = response.candidates?.[0]?.content?.parts || [];
    let toolCallPart = parts.find(p => p.functionCall);

    if (toolCallPart) {
      const { name, args, id } = toolCallPart.functionCall!;
      let resultData: any = {};

      try {
        if (name === "list_courses") {
          const { data } = await supabase
            .from("courses")
            .select("title, slug, description, category, level, thumbnail_url")
            .eq("status", "published");
          resultData = { courses: data || [] };
        } else if (name === "get_course_details" && args) {
          const { data } = await supabase
            .from("courses")
            .select("*, modules(*, lessons(*))")
            .eq("slug", (args as any).slug)
            .single();
          resultData = { course: data };
        } else if (name === "search_content" && args) {
          const { data } = await supabase
            .from("courses")
            .select("title, slug, description, category, thumbnail_url")
            .or(`title.ilike.%${(args as any).query}%,description.ilike.%${(args as any).query}%`)
            .eq("status", "published");
          resultData = { results: data || [] };
        }
      } catch (err) {
        console.error("Function execution error:", err);
        resultData = { error: "Failed to fetch data from database" };
      }

      // Add tool call and response to history and generate final response
      contents.push(response.candidates![0].content);
      contents.push({
        role: "user",
        parts: [{
          functionResponse: {
            name,
            response: resultData,
            id: id || undefined
          }
        }]
      });

      const stream = await gemini.models.generateContentStream({
        model: GEMINI_MODEL,
        contents,
        config: {
          systemInstruction: systemPrompt,
          tools,
        },
      });

      return streamResponse(stream);
    }

    // If no tool call, just stream the original message (or re-run as stream for better UX)
    const stream = await gemini.models.generateContentStream({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: systemPrompt,
        tools,
      },
    });

    return streamResponse(stream);

  } catch (error) {
    console.error("AI Route Error:", error);
    return new Response("AI Error", { status: 500 });
  }
}

async function streamResponse(stream: any) {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.text) {
            controller.enqueue(encoder.encode(chunk.text));
          }
        }
      } catch (e) {
        console.error("Streaming error:", e);
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
