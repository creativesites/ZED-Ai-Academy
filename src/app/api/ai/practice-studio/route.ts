import { auth } from "@clerk/nextjs/server";
import { gemini, GEMINI_MODEL } from "@/lib/ai/gemini";
import { NextRequest } from "next/server";

interface ToolConfig {
  systemPrompt: string;
  buildUserPrompt: (inputs: Record<string, string>) => string;
}

const TOOLS: Record<string, ToolConfig> = {
  prompt_optimizer: {
    systemPrompt:
      "You are an expert prompt engineer. Transform vague or simple user prompts into structured, high-performance prompts using role assignment, context injection, and clear output formatting. Output the improved prompt ready to paste, followed by a brief explanation of each enhancement.",
    buildUserPrompt: (inputs) =>
      `Improve this prompt for AI use:\nBase prompt: ${inputs.base_prompt}\nContext: ${inputs.context || "none"}\nDesired tone/style: ${inputs.tone || "professional"}\n\nProvide: 1) The optimised prompt ready to paste, 2) Key improvements made, 3) One alternative variation.`,
  },

  workflow_generator: {
    systemPrompt:
      "You are an AI automation expert specialising in no-code and low-code AI workflows. Design practical, step-by-step automation workflows using common tools like Make.com, Zapier, n8n, OpenAI, Airtable, and Google Workspace. Focus on real-world business processes.",
    buildUserPrompt: (inputs) =>
      `Design an AI automation workflow:\nBusiness process: ${inputs.process}\nPreferred tools: ${inputs.tools || "any"}\nPrimary goal: ${inputs.goal}\n\nProvide: 1) Step-by-step workflow with trigger, processing, and actions, 2) Tool-specific setup notes, 3) Estimated time saved per week, 4) Common pitfalls to avoid.`,
  },

  social_hooks: {
    systemPrompt:
      "You are a social media content strategist specialising in AI-related content. Write viral, attention-grabbing hooks that stop the scroll using curiosity gaps, bold claims, relatable pain points, or surprising facts. Tailor tone and format to the specific platform.",
    buildUserPrompt: (inputs) =>
      `Generate viral hooks for this content:\nTopic: ${inputs.topic}\nTarget audience: ${inputs.audience || "professionals"}\nPlatform: ${inputs.platform || "LinkedIn"}\n\nProvide: 5 distinct hooks using different angles (curiosity, pain point, bold claim, story, stat). Include a brief note on why each hook works.`,
  },

  code_commentator: {
    systemPrompt:
      "You are a senior software engineer and technical writer. Analyse code blocks and provide clear explanations of what the code does, why it does it, and how to improve it. Break down complex logic into plain language and suggest optimisations where relevant.",
    buildUserPrompt: (inputs) =>
      `Analyse this code block:\n\`\`\`${inputs.language || ""}\n${inputs.code}\n\`\`\`\nFocus: ${inputs.focus || "general understanding"}\n\nProvide: 1) Plain-language explanation of what the code does, 2) Line-by-line breakdown of the key logic, 3) Potential improvements or issues, 4) Any security or performance considerations.`,
  },

  midjourney_prompt: {
    systemPrompt:
      "You are an expert Midjourney prompt engineer. Generate detailed, effective Midjourney v6 prompts that produce stunning images. Use Midjourney's parameter syntax correctly: --ar for aspect ratio, --style, --v 6. Focus on specificity: lighting, composition, mood, subject details.",
    buildUserPrompt: (inputs) =>
      `Create a complete Midjourney prompt for:\nSubject: ${inputs.subject}\nStyle: ${inputs.style}\nMood: ${inputs.mood}\nLighting: ${inputs.lighting}\nExtra details: ${inputs.extras}\n\nProvide: 1) The complete prompt ready to paste into Midjourney, 2) A brief explanation of why each element was included, 3) Two variations of the prompt.`,
  },

  photo_description: {
    systemPrompt:
      "You are a professional photographer and AI art director. Convert photo ideas into detailed prompts suitable for AI image generators like Midjourney, DALL-E, and Adobe Firefly.",
    buildUserPrompt: (inputs) =>
      `Convert this photo idea into detailed AI prompts:\nIdea: ${inputs.description}\nCamera style: ${inputs.camera_style}\nColor palette: ${inputs.color_palette}\n\nProvide prompts optimised for: 1) Midjourney, 2) Adobe Firefly, 3) DALL-E 3. Include relevant technical photography terms.`,
  },

  image_edit_instructions: {
    systemPrompt:
      "You are an expert in AI-powered photo editing tools including Adobe Firefly, Canva AI, Photoshop Generative Fill, and Lightroom AI. Provide clear, effective editing instructions.",
    buildUserPrompt: (inputs) =>
      `Generate AI editing instructions:\nCurrent image: ${inputs.current_image}\nDesired change: ${inputs.desired_change}\nTool to use: ${inputs.tool}\n\nProvide: 1) Step-by-step instructions for the chosen tool, 2) The exact text prompts to type into the AI tool, 3) Tips to get the best result, 4) Alternative approaches.`,
  },

  style_transfer: {
    systemPrompt:
      "You are an expert in AI style transfer and artistic AI tools. Help users apply artistic styles to their images using tools like Midjourney, Stable Diffusion, and Adobe Firefly.",
    buildUserPrompt: (inputs) =>
      `Create a style transfer approach:\nSubject: ${inputs.subject}\nTarget style: ${inputs.reference_style}\nElements to preserve: ${inputs.preserve}\n\nProvide: 1) Detailed style transfer prompt, 2) Which AI tools work best for this, 3) Settings/parameters to use, 4) Tips for a natural-looking result.`,
  },

  product_photo: {
    systemPrompt:
      "You are a professional product photographer specialising in AI-generated and AI-enhanced product photography. Create prompts that produce commercial-quality product images.",
    buildUserPrompt: (inputs) =>
      `Create product photography prompts for:\nProduct: ${inputs.product}\nBackground: ${inputs.background}\nTarget audience: ${inputs.target_audience}\nPlatform: ${inputs.platform}\n\nProvide: 1) Complete AI image prompt for product shot, 2) Lighting and composition guidance, 3) Post-processing suggestions using AI tools, 4) Platform-specific formatting tips.`,
  },
};

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const { tool, inputs } = body;

  if (!tool || typeof tool !== "string") {
    return new Response("Missing tool", { status: 400 });
  }

  if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) {
    return new Response("Missing inputs", { status: 400 });
  }

  const toolConfig = TOOLS[tool];
  if (!toolConfig) {
    return new Response("Unknown tool", { status: 400 });
  }

  const systemPrompt = toolConfig.systemPrompt;
  const userPrompt = toolConfig.buildUserPrompt(inputs as Record<string, string>);

  const stream = await gemini.models.generateContentStream({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    config: { systemInstruction: systemPrompt, temperature: 0.7 },
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
