"use server";

import { revalidatePath } from "next/cache";
import { gemini } from "@/lib/ai/gemini";
import { modelFor } from "@/lib/ai/models";
import { requireTenantMember, requireTenantTeacher } from "@/lib/tenants/access";
import { createServiceClient } from "@/lib/supabase/server";

export interface StudyPack {
  id: string;
  company_id: string;
  cohort_id: string | null;
  course_id: string | null;
  title: string;
  summary: string | null;
  concepts: Array<{ term: string; explanation: string }>;
  flashcards: Array<{ front: string; back: string }>;
  quiz_questions: Array<{
    question: string;
    options: string[];
    correct_index: number;
    explanation: string;
  }>;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function getStudyPacks(
  companyId: string,
  cohortId?: string | null
): Promise<StudyPack[]> {
  const { supabase, isTeacher, isSuperAdmin } = await requireTenantMember(companyId);

  let query = supabase
    .from("classroom_study_packs")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (cohortId && cohortId !== "all") {
    query = query.or(`cohort_id.eq.${cohortId},cohort_id.is.null`);
  }

  // Non-teachers only see published packs
  if (!isTeacher && !isSuperAdmin) {
    query = query.eq("is_published", true);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Failed to fetch study packs:", error);
    return [];
  }

  return (data ?? []) as any[];
}

export async function generateClassStudyPack(params: {
  companyId: string;
  companySlug: string;
  cohortId?: string | null;
  topic: string;
  documentIds?: string[];
}) {
  const { companyId, companySlug, cohortId, topic, documentIds = [] } = params;
  const { userId, supabase } = await requireTenantTeacher(companyId);

  let contextText = `Class topic: ${topic}`;

  // If documents were chosen, fetch their titles and descriptions
  if (documentIds.length > 0) {
    const { data: docs } = await supabase
      .from("classroom_materials")
      .select("title, description, tags")
      .in("id", documentIds);

    if (docs && docs.length > 0) {
      contextText += "\n\nReferenced Class Materials:\n";
      for (const d of docs) {
        contextText += `- Document: ${d.title}\n  Notes: ${d.description || "N/A"}\n  Tags: ${(d.tags || []).join(", ")}\n`;
      }
    }
  }

  const systemInstruction = `You are an elite academic curriculum architect and AI tutor for professional students.
You generate comprehensive, high-yield Class Study Packs designed to help students master complex subjects.

Return ONLY a valid JSON object. Do not wrap in markdown or add conversational filler.`;

  const prompt = `Generate a complete revision study pack based on the provided class context:

${contextText}

The JSON response MUST have this exact schema:
{
  "title": "A compelling, academic title for this study pack",
  "summary": "A 2-3 paragraph concise executive summary of the core concepts, practical implications, and mastery goals.",
  "concepts": [
    {
      "term": "Concept or keyword",
      "explanation": "Clear, precise explanation with real-world application."
    }
  ],
  "flashcards": [
    {
      "front": "A targeted question or prompt testing recall or application",
      "back": "The clear, complete answer and intuition"
    }
  ],
  "quiz_questions": [
    {
      "question": "A multiple choice test question",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0,
      "explanation": "Detailed explanation of why the correct option is right and the others are incorrect"
    }
  ]
}

Provide 4-6 key concepts, 6-8 flashcards, and 4-5 multiple choice quiz questions.`;

  try {
    const response = await gemini.models.generateContent({
      model: modelFor("lessonContent"),
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
      },
    });

    const raw = response.text ?? "";
    const parsed = JSON.parse(raw);

    const serviceClient = createServiceClient();
    const { data: createdPack, error: insertError } = await serviceClient
      .from("classroom_study_packs")
      .insert({
        company_id: companyId,
        cohort_id: cohortId && cohortId !== "all" ? cohortId : null,
        title: parsed.title || `${topic} Study Pack`,
        summary: parsed.summary || "",
        concepts: parsed.concepts || [],
        flashcards: parsed.flashcards || [],
        quiz_questions: parsed.quiz_questions || [],
        is_published: true,
        created_by: userId,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to save study pack:", insertError);
      throw new Error(insertError.message);
    }

    // Dispatch notification to students
    try {
      let studentIds: string[] = [];
      if (cohortId && cohortId !== "all") {
        const { data: groupMembers } = await supabase
          .from("classroom_group_members")
          .select("profile_id")
          .eq("group_id", cohortId);
        studentIds = (groupMembers ?? [])
          .map((m: any) => m.profile_id)
          .filter((pid: string) => pid && pid !== userId);
      } else {
        const { data: members } = await supabase
          .from("company_members")
          .select("profile_id")
          .eq("company_id", companyId)
          .eq("status", "active")
          .eq("role", "learner");
        studentIds = (members ?? [])
          .map((m: any) => m.profile_id)
          .filter((pid: string) => pid && pid !== userId);
      }

      if (studentIds.length > 0) {
        const notifs = studentIds.map((pid) => ({
          user_id: pid,
          type: "study_pack",
          title: "✨ New AI Study Pack Available",
          body: `A new study pack for "${parsed.title || topic}" is now ready in your classroom.`,
          data: {
            company_id: companyId,
            company_slug: companySlug,
            study_pack_id: (createdPack as any).id,
            url: `/academy/${companySlug}/classroom?tab=overview`,
          },
        }));
        await supabase.from("notifications").insert(notifs as any);
      }
    } catch (notifErr) {
      console.warn("Could not dispatch study pack notifications:", notifErr);
    }

    revalidatePath(`/academy/${companySlug}/classroom`);
    return createdPack as StudyPack;
  } catch (err: any) {
    console.error("AI Study pack generation failed:", err);
    throw new Error(err.message || "Failed to generate class study pack");
  }
}

export async function deleteStudyPack(
  studyPackId: string,
  companyId: string,
  companySlug: string
) {
  const { supabase } = await requireTenantTeacher(companyId);

  const { error } = await supabase
    .from("classroom_study_packs")
    .delete()
    .eq("id", studyPackId)
    .eq("company_id", companyId);

  if (error) throw new Error(error.message);

  revalidatePath(`/academy/${companySlug}/classroom`);
  return { success: true };
}
