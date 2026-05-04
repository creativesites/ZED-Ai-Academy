import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { gemini } from "@/lib/ai/gemini";
import { createServiceClient } from "@/lib/supabase/server";
import { v4 as uuidv4 } from "uuid";

export const maxDuration = 60; // Allow for image generation time

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { 
      prompt, 
      context, 
      aspectRatio = "1:1", 
      editImageId,
      editPrompt 
    } = await req.json();

    if (!prompt && !editPrompt) {
      return new NextResponse("Missing prompt", { status: 400 });
    }

    const MODEL = "gemini-3.1-flash-image-preview";
    let contents: any[] = [];

    if (editImageId) {
      // Fetch existing image to edit
      const supabase = createServiceClient();
      const { data: asset } = await supabase
        .from("media_assets")
        .select("public_url, mime_type")
        .eq("id", editImageId)
        .single();

      if (!asset) return new NextResponse("Image asset not found", { status: 404 });

      // Fetch image bytes
      const imgResp = await fetch(asset.public_url);
      const imgBuffer = await imgResp.arrayBuffer();
      const base64 = Buffer.from(imgBuffer).toString("base64");

      contents = [
        {
          role: "user",
          parts: [
            { inlineData: { data: base64, mimeType: asset.mime_type } },
            { text: `Edit this image according to this instruction: ${editPrompt || prompt}` }
          ]
        }
      ];
    } else {
      // Generate new image
      contents = [
        {
          role: "user",
          parts: [
            { 
              text: `Generate a high-quality educational image for a course titled "${context.courseTitle}".
               Context: ${context.moduleTitle} > ${context.lessonTitle}.
               Specific Section: ${context.sectionTitle || 'General'}.
               
               SUBJECT: ${prompt}
               STYLE: Professional, modern, instructional, clean. Avoid text or clutter.
               
               ADHERENCE: High. 
               RESOLUTION: 512p.
               ASPECT RATIO: ${aspectRatio}.` 
            }
          ]
        }
      ];
    }

    const response = await gemini.models.generateContent({
      model: MODEL,
      contents,
      config: {
        // Thinking levels or specific image configs would go here if supported by SDK
        // For now we use standard generateContent which supports multimodal output
      }
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData && p.inlineData.mimeType?.startsWith("image/"));

    if (!imagePart || !imagePart.inlineData) {
      // If no image part, maybe the model returned text explaining why
      const textPart = parts.find(p => p.text);
      return NextResponse.json({ 
        error: "No image generated", 
        details: textPart?.text || "The model did not return an image." 
      }, { status: 500 });
    }

    const imgBase64 = imagePart.inlineData.data;
    if (!imgBase64) return new NextResponse("Image data missing from AI response", { status: 500 });
    
    const mimeType = imagePart.inlineData.mimeType || "image/png";
    const buffer = Buffer.from(imgBase64, "base64");

    // Upload to Supabase
    const supabase = createServiceClient();
    const fileName = `${uuidv4()}.png`;
    const path = `ai-generated/${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("courses_media")
      .upload(path, buffer, { contentType: mimeType });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from("courses_media")
      .getPublicUrl(path);

    // Register in media_assets table
    const { data: asset, error: assetError } = await supabase
      .from("media_assets")
      .insert({
        bucket: "courses_media",
        path,
        public_url: publicUrl,
        file_name: fileName,
        original_name: "ai-generated-image.png",
        mime_type: mimeType,
        size_bytes: buffer.length,
        created_by: userId,
        alt_text: prompt,
        metadata: { ai_model: MODEL, context }
      })
      .select()
      .single();

    if (assetError) throw assetError;

    return NextResponse.json({ asset });

  } catch (error: any) {
    console.error("Image generation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
