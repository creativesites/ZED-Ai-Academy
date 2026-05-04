import { auth } from "@clerk/nextjs/server";
import { GEMINI_MODEL, gemini } from "@/lib/ai/gemini";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { brief } = await req.json();

  if (!brief || typeof brief !== "string") {
    return Response.json({ error: "Missing course brief" }, { status: 400 });
  }

  const systemInstruction = `You design premium, practical AI courses for working professionals.

Return only valid JSON without markdown fences or explanatory text.`;

  const prompt = `You are designing an AI course for working professionals on Zed AI Academy.

The academy prioritizes:
- output-first learning
- practical workflows over theory
- one quick win in the first 15 minutes
- role-specific applications
- a final real-work project
- a short privacy and accuracy audit

Given the brief below, return ONLY valid JSON with this exact shape:
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
- title should sound premium but practical
- description should be 2 sentences max
- module_outline must contain exactly 4 modules
- modules should follow: quick win, frameworks/tools, workflow build, safety/capstone
- never mention transformers, AGI, or deep theory unless absolutely required by the brief

Brief:
${brief}`;

  try {
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction,
        maxOutputTokens: 1200,
        responseMimeType: "application/json",
      },
    });

    const raw = response.text ?? "";
    const match = raw.match(/\{[\s\S]*\}/);

    if (!match) {
      return Response.json({ error: "Invalid blueprint response" }, { status: 500 });
    }

    const parsed = JSON.parse(match[0]) as {
      title?: string;
      description?: string;
      category?: string;
      level?: string;
      price_type?: string;
      audience?: string;
      quick_win?: string;
      capstone?: string;
      module_outline?: string[];
    };

    if (
      !parsed.title ||
      !parsed.description ||
      !parsed.category ||
      !parsed.level ||
      !parsed.price_type ||
      !parsed.audience ||
      !parsed.quick_win ||
      !parsed.capstone ||
      !Array.isArray(parsed.module_outline) ||
      parsed.module_outline.length !== 4
    ) {
      return Response.json({ error: "Generated blueprint failed validation" }, { status: 500 });
    }

    return Response.json(parsed);
  } catch (error) {
    console.error("Course blueprint generation error:", error);
    return Response.json({ error: "Failed to generate blueprint" }, { status: 500 });
  }
}
