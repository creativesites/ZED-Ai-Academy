"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { gemini, GEMINI_MODEL } from "@/lib/ai/gemini";
import type { Json } from "@/types/database";

const BUCKET = "practice-submissions";
const DEFAULT_ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
]);

function readString(formData: FormData, key: string, fallback = "") {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function fileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
}

function safeFileName(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-|-$/g, "");
  return base || "submission";
}

function readNumberOrNull(formData: FormData, key: string) {
  const value = readString(formData, key);
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function scoreSubmission({
  exercise,
  textResponse,
  fileCount,
}: {
  exercise: Record<string, unknown>;
  textResponse: string;
  fileCount: number;
}) {
  const rubric = Array.isArray(exercise.rubric) ? exercise.rubric : [];
  const prompt = `Score this practice exercise submission. Return only valid JSON.

Exercise title: ${String(exercise.title ?? "Practice Exercise")}
Brief: ${String(exercise.brief ?? "")}
Instructions: ${JSON.stringify(exercise.instructions ?? [])}
Rubric: ${JSON.stringify(rubric)}
Uploaded file count: ${fileCount}

Learner response:
${textResponse || "[No text response provided]"}

Return JSON with:
{
  "score": number from 0 to 100,
  "rubric_breakdown": [{"criterion": string, "score": number, "max": number, "feedback": string}],
  "feedback_summary": string,
  "strengths": string[],
  "improvements": string[],
  "confidence": number from 0 to 1,
  "needs_instructor_review": boolean
}`;

  const result = await gemini.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  const raw = result.text ?? "{}";
  return JSON.parse(raw) as {
    score?: number;
    rubric_breakdown?: unknown;
    feedback_summary?: string;
    strengths?: unknown;
    improvements?: unknown;
    confidence?: number;
    needs_instructor_review?: boolean;
  };
}

export async function submitPracticeExercise(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const blockId = readString(formData, "exercise_block_id");
  const textResponse = readString(formData, "text_response");
  if (!blockId) throw new Error("Missing exercise block");

  const supabase = createServiceClient();

  const { data: block, error: blockError } = await supabase
    .from("content_blocks")
    .select("id, lesson_id, type, content")
    .eq("id", blockId)
    .eq("type", "practice_exercise")
    .single();

  if (blockError || !block) throw new Error(blockError?.message || "Practice exercise not found");

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, module_id")
    .eq("id", block.lesson_id)
    .single();
  if (!lesson) throw new Error("Lesson not found");

  const { data: moduleRow } = await supabase
    .from("modules")
    .select("course_id")
    .eq("id", lesson.module_id)
    .single();
  if (!moduleRow) throw new Error("Module not found");

  const { data: course } = await supabase
    .from("courses")
    .select("id, slug, instructor_id")
    .eq("id", moduleRow.course_id)
    .single();
  if (!course) throw new Error("Course not found");

  if (course.instructor_id !== userId) {
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", course.id)
      .eq("status", "active")
      .maybeSingle();

    if (!enrollment) throw new Error("You need active course access to submit this exercise");
  }

  const exercise = asRecord(block.content);
  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);

  const maxFiles = typeof exercise.max_files === "number" ? exercise.max_files : 5;
  if (files.length > maxFiles) throw new Error(`Upload ${maxFiles} file${maxFiles === 1 ? "" : "s"} or fewer`);

  const configuredTypes = new Set(asStringArray(exercise.allowed_file_types));
  const allowedTypes = configuredTypes.size > 0 ? configuredTypes : DEFAULT_ALLOWED_TYPES;

  for (const file of files) {
    if (!allowedTypes.has(file.type)) {
      throw new Error(`${file.name} is not an allowed file type`);
    }
  }

  const { data: lastSubmission } = await supabase
    .from("practice_exercise_submissions")
    .select("attempt_number")
    .eq("user_id", userId)
    .eq("exercise_block_id", block.id)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const attemptNumber = (lastSubmission?.attempt_number ?? 0) + 1;
  const now = new Date().toISOString();

  const { data: submission, error: submissionError } = await supabase
    .from("practice_exercise_submissions")
    .insert({
      exercise_block_id: block.id,
      course_id: course.id,
      lesson_id: lesson.id,
      user_id: userId,
      status: "submitted",
      attempt_number: attemptNumber,
      text_response: textResponse || null,
      metadata: {
        title: String(exercise.title ?? "Practice Exercise"),
        mode: String(exercise.mode ?? "text_response"),
      },
      submitted_at: now,
    })
    .select("id")
    .single();

  if (submissionError || !submission) throw new Error(submissionError?.message || "Failed to submit exercise");

  for (const file of files) {
    const storagePath = `${userId}/${block.id}/${submission.id}/${Date.now()}-${safeFileName(file.name)}.${fileExtension(file.name)}`;
    const bytes = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw new Error(uploadError.message);

    const { error: fileError } = await supabase.from("practice_exercise_files").insert({
      submission_id: submission.id,
      user_id: userId,
      bucket_id: BUCKET,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
    });

    if (fileError) throw new Error(fileError.message);
  }

  if (exercise.ai_scoring_enabled !== false) {
    try {
      const score = await scoreSubmission({ exercise, textResponse, fileCount: files.length });
      const needsReview = Boolean(score.needs_instructor_review) || (files.length > 0 && !textResponse);

      const { error: scoreError } = await supabase.from("practice_exercise_scores").insert({
        submission_id: submission.id,
        score: typeof score.score === "number" ? score.score : 0,
        max_score: 100,
        rubric_breakdown: (score.rubric_breakdown ?? []) as Json,
        feedback_summary: score.feedback_summary ?? null,
        strengths: (score.strengths ?? []) as Json,
        improvements: (score.improvements ?? []) as Json,
        model: GEMINI_MODEL,
        confidence: typeof score.confidence === "number" ? score.confidence : null,
        needs_instructor_review: needsReview,
        raw_ai_response: score as Json,
      });

      if (scoreError) throw scoreError;

      await supabase
        .from("practice_exercise_submissions")
        .update({
          status: needsReview ? "needs_review" : "scored",
          scored_at: new Date().toISOString(),
        })
        .eq("id", submission.id);
    } catch (error) {
      console.error("[practice_exercise] AI scoring failed:", error);
      await supabase
        .from("practice_exercise_submissions")
        .update({ status: "needs_review" })
        .eq("id", submission.id);
    }
  }

  revalidatePath(`/courses/${course.slug}/learn`);
  revalidatePath("/dashboard");
  revalidatePath("/creator/practice-submissions");
}

export async function reviewPracticeSubmission(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const submissionId = readString(formData, "submission_id");
  const feedback = readString(formData, "feedback");
  const status = readString(formData, "status", "reviewed");
  const scoreOverride = readNumberOrNull(formData, "score_override");

  if (!submissionId) throw new Error("Missing submission");
  if (!["reviewed", "resubmission_requested"].includes(status)) {
    throw new Error("Choose a valid review status");
  }
  if (scoreOverride !== null && (scoreOverride < 0 || scoreOverride > 100)) {
    throw new Error("Score override must be between 0 and 100");
  }

  const supabase = createServiceClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!profile || !["instructor", "super_admin"].includes(profile.role)) {
    throw new Error("Unauthorized");
  }

  const { data: submission } = await supabase
    .from("practice_exercise_submissions")
    .select("id, course_id, lesson_id")
    .eq("id", submissionId)
    .single();

  if (!submission) throw new Error("Submission not found");

  const { data: course } = await supabase
    .from("courses")
    .select("id, slug, instructor_id")
    .eq("id", submission.course_id)
    .single();

  if (profile.role !== "super_admin" && course?.instructor_id !== userId) {
    throw new Error("Unauthorized");
  }

  const reviewStatus = status as "reviewed" | "resubmission_requested";
  const { error: reviewError } = await supabase.from("practice_exercise_reviews").insert({
    submission_id: submissionId,
    reviewer_id: userId,
    score_override: scoreOverride,
    feedback: feedback || null,
    status: reviewStatus,
  });

  if (reviewError) throw new Error(reviewError.message);

  const { error: updateError } = await supabase
    .from("practice_exercise_submissions")
    .update({
      status: reviewStatus === "reviewed" ? "reviewed" : "needs_review",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  if (updateError) throw new Error(updateError.message);

  if (course?.slug) revalidatePath(`/courses/${course.slug}/learn`);
  revalidatePath("/dashboard");
  revalidatePath("/creator/practice-submissions");
}
