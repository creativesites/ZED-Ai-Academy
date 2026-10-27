import { auth } from "@clerk/nextjs/server";
import { gemini } from "@/lib/ai/gemini";
import { modelFor } from "@/lib/ai/models";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "generate_brand_kit") {
      const { academyName, niche, targetAudience, tone = "modern" } = body;

      const systemInstruction = `You are a world-class brand strategist and educational copywriter for elite online academies.
Your task is to generate a comprehensive, highly compelling brand kit and landing page structure for an educational academy.
Output strictly valid JSON with no markdown formatting or commentary.`;

      const prompt = `Generate a complete brand kit and landing page content for:
Academy Name: "${academyName || "Zed AI Academy"}"
Subject Domain / Niche: "${niche || "Professional Skills & Practical Learning"}"
Target Audience: "${targetAudience || "Ambitious students and professionals in Africa & globally"}"
Desired Tone / Vibe: "${tone}"

Return a single JSON object with this exact shape:
{
  "primary_color": "#HEX (a bold, distinct primary brand color matching the subject domain)",
  "secondary_color": "#HEX (an accent or badge color)",
  "surface_color": "#HEX (a very soft background tint like #fffaf6 or #f8fafc or #0f1117)",
  "recommended_template": "modern" | "classic" | "minimal" | "dark_mode" | "corporate" | "creative" | "tech" | "elegant",
  "hero_title": "Short, powerful headline (max 7-9 words)",
  "hero_subtitle": "Compelling value proposition explaining what learners achieve (max 2 sentences)",
  "about_title": "Engaging section title for the mission & founder story",
  "about_text": "Inspiring 2-3 paragraph story detailing why this academy exists, the methodology, and the transformation learners experience.",
  "services": [
    {
      "title": "Service name (e.g. Live Online Masterclasses)",
      "subtitle": "Short descriptive tagline",
      "features": ["Key benefit 1", "Key benefit 2", "Key benefit 3"]
    },
    {
      "title": "Service name (e.g. 1-on-1 Private Mentorship)",
      "subtitle": "Short descriptive tagline",
      "features": ["Key benefit 1", "Key benefit 2", "Key benefit 3"]
    },
    {
      "title": "Service name (e.g. Self-Paced Certification)",
      "subtitle": "Short descriptive tagline",
      "features": ["Key benefit 1", "Key benefit 2", "Key benefit 3"]
    }
  ],
  "faqs": [
    {
      "question": "Clear common student question",
      "answer": "Helpful, reassuring answer"
    },
    {
      "question": "Clear common student question",
      "answer": "Helpful, reassuring answer"
    },
    {
      "question": "Clear common student question",
      "answer": "Helpful, reassuring answer"
    }
  ],
  "cta_title": "High-urgency closing call to action",
  "cta_button": "Action-oriented button text (e.g. Start Your Journey Today)"
}`;

      const response = await gemini.models.generateContent({
        model: modelFor("brandingAssistant"),
        contents: prompt,
        config: {
          systemInstruction,
          maxOutputTokens: 2500,
          responseMimeType: "application/json",
        },
      });

      const raw = response.text ?? "";
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) {
        return Response.json({ error: "Failed to parse AI brand kit" }, { status: 500 });
      }

      const brandKit = JSON.parse(match[0]);
      return Response.json({ brandKit });
    }

    if (action === "enhance_copy") {
      const { field, currentText, academyName, niche, instruction = "make it punchier and more inspiring" } = body;

      const systemInstruction = `You are a master conversion copywriter for digital academies and creator education. 
Enhance the user's copy according to their instructions while maintaining brand integrity.
Return ONLY valid JSON: { "enhancedText": "..." } with no extra commentary or markdown formatting.`;

      const prompt = `Field: ${field}
Academy: ${academyName}
Niche: ${niche}
Current Text: "${currentText}"
Instruction: ${instruction}

Provide the enhanced version now as JSON.`;

      const response = await gemini.models.generateContent({
        model: modelFor("brandingAssistant"),
        contents: prompt,
        config: {
          systemInstruction,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
        },
      });

      const raw = response.text ?? "";
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) {
        return Response.json({ error: "Failed to parse AI copy response" }, { status: 500 });
      }

      const result = JSON.parse(match[0]);
      return Response.json(result);
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("AI Branding Assistant error:", error);
    return Response.json({ error: error.message || "Failed to process AI brand request" }, { status: 500 });
  }
}
