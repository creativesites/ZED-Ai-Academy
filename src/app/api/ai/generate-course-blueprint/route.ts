import { requireContentAuthor } from "@/lib/authz/content-author-server";
import { auth } from "@clerk/nextjs/server";
import { aiJson } from "@/lib/ai/call";
import { meterFor } from "@/lib/ai/meter-server";
import { validCourseBlueprint } from "@/lib/ai/generation/parse";
import { COURSE_BLUEPRINT_SCHEMA } from "@/lib/ai/generation/schemas";
import type { AiContent } from "@/lib/ai/provider";
import { NextRequest } from "next/server";

type SourceFilePayload = {
  name: string;
  mimeType: string;
  base64: string;
};

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const notAuthor = await requireContentAuthor(userId);
  if (notAuthor) return notAuthor;

  const body = (await req.json()) as {
    brief?: string;
    sourceText?: string;
    sourceFile?: SourceFilePayload;
  };

  const brief = typeof body.brief === "string" ? body.brief.trim() : "";
  const sourceText = typeof body.sourceText === "string" ? body.sourceText.trim().slice(0, 30000) : "";
  const sourceFile = body.sourceFile;

  if (!brief && !sourceText && !sourceFile?.base64) {
    return Response.json({ error: "Provide a course brief or upload source materials." }, { status: 400 });
  }

  const systemInstruction = `You design premium, practical courses on Zed AI Academy.

Return only valid JSON without markdown fences or explanatory text.`;

  const prompt = `You are designing a course for Zed AI Academy.

The academy prioritizes:
- output-first learning
- practical workflows over theory
- one quick win early in the course
- clear, role-specific or learner-specific outcomes
- a final real-world project or assessment

Given the brief and/or uploaded source materials below, return ONLY valid JSON with this exact shape:
{
  "title": "string",
  "description": "string",
  "category": "Prompt Engineering" | "AI Tools" | "Machine Learning" | "AI for Business" | "Data Science" | "Natural Language Processing" | "Computer Vision" | "AI Ethics",
  "level": "beginner" | "intermediate" | "advanced",
  "price_type": "free" | "one_time" | "subscription_only" | "both",
  "audience": "string",
  "quick_win": "string",
  "capstone": "string",
  "module_outline": ["string", "string", "string", "string"]
}

Rules:
- title should sound clear, credible, and practical
- description should be 2 sentences max
- module_outline must contain exactly 4 modules
- If source materials are provided, ground the title, summary, and module outline strictly in those materials without inventing unsupported facts or fabricated citations.
${brief ? `\nCreator Brief:\n${brief}` : ""}
${sourceText ? `\nUploaded Source Material:\n${sourceText}` : ""}`;

  const contents: string | AiContent[] =
    sourceFile?.base64 && sourceFile.mimeType
      ? [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: sourceFile.mimeType,
                  data: sourceFile.base64,
                },
              },
              { text: prompt },
            ],
          },
        ]
      : prompt;

  try {
    const { data } = await aiJson(
      "courseBlueprint",
      { contents, systemInstruction, responseJsonSchema: COURSE_BLUEPRINT_SCHEMA, maxOutputTokens: 1200 },
      { meter: await meterFor(userId) },
    );
    const parsed = validCourseBlueprint(data);
    if (!parsed) {
      return Response.json({ error: "Incomplete blueprint returned" }, { status: 500 });
    }

    return Response.json(parsed);
  } catch (error) {
    console.error("Course blueprint generation error:", error);
    return Response.json({ error: "Unable to generate blueprint" }, { status: 500 });
  }
}
