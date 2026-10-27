"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export async function createQuiz(lessonId: string, courseId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();

  const { data, error } = await supabase
    .from("quizzes")
    .insert({ lesson_id: lessonId, title: "Quiz", pass_threshold: 70, max_attempts: 3 })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(`/creator/courses/${courseId}/lessons/${lessonId}`);
  return data;
}

export async function updateQuiz(
  quizId: string,
  courseId: string,
  lessonId: string,
  updates: { title?: string; pass_threshold?: number; max_attempts?: number }
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();

  const { error } = await supabase.from("quizzes").update(updates).eq("id", quizId);
  if (error) throw new Error(error.message);
  revalidatePath(`/creator/courses/${courseId}/lessons/${lessonId}`);
}

export async function addQuestion(
  quizId: string,
  courseId: string,
  lessonId: string,
  question: {
    question: string;
    options: string[];
    correct_indices: number[];
    explanation?: string;
  }
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();

  const { data: existing } = await supabase
    .from("quiz_questions")
    .select("position")
    .eq("quiz_id", quizId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (existing?.position ?? 0) + 1;

  const { data, error } = await supabase
    .from("quiz_questions")
    .insert({
      quiz_id: quizId,
      question: question.question,
      options: question.options,
      correct_indices: question.correct_indices,
      explanation: question.explanation ?? null,
      position,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(`/creator/courses/${courseId}/lessons/${lessonId}`);
  return data;
}

export async function updateQuestion(
  questionId: string,
  courseId: string,
  lessonId: string,
  updates: {
    question?: string;
    options?: string[];
    correct_indices?: number[];
    explanation?: string | null;
  }
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();

  const { error } = await supabase
    .from("quiz_questions")
    .update(updates)
    .eq("id", questionId);

  if (error) throw new Error(error.message);
  revalidatePath(`/creator/courses/${courseId}/lessons/${lessonId}`);
}

export async function deleteQuestion(
  questionId: string,
  courseId: string,
  lessonId: string
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();

  const { error } = await supabase.from("quiz_questions").delete().eq("id", questionId);
  if (error) throw new Error(error.message);
  revalidatePath(`/creator/courses/${courseId}/lessons/${lessonId}`);
}

export async function getLatestQuizAttempt(quizId: string) {
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = createClient();
  const { data } = await supabase
    .from("quiz_attempts")
    .select("id, score, passed, answers, created_at")
    .eq("quiz_id", quizId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as {
    id: string;
    score: number;
    passed: boolean;
    answers: Record<string, number[]>;
    created_at: string;
  } | null;
}

export async function saveQuizAttempt(
  quizId: string,
  answers: Record<string, number[]>,
  lessonId?: string,
  courseSlug?: string
): Promise<{ score: number; passed: boolean; correctAnswers: Record<string, number[]> }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, lesson_id, pass_threshold")
    .eq("id", quizId)
    .single();

  if (!quiz) throw new Error("Quiz not found");

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id, correct_indices")
    .eq("quiz_id", quizId);

  if (!questions || questions.length === 0) throw new Error("No questions found");

  let correct = 0;
  const correctAnswers: Record<string, number[]> = {};
  for (const q of questions) {
    correctAnswers[q.id] = q.correct_indices;
    const given = answers[q.id] ?? [];
    const expected = [...q.correct_indices].sort().join(",");
    const actual = [...given].sort().join(",");
    if (expected === actual) correct++;
  }

  const score = Math.round((correct / questions.length) * 100);
  const passed = score >= quiz.pass_threshold;

  await supabase.from("quiz_attempts").insert({
    quiz_id: quizId,
    user_id: userId,
    answers: answers as Json,
    score,
    passed,
  });

  // If passed and lessonId is available, auto-mark lesson complete in lesson_progress
  const targetLessonId = lessonId || quiz.lesson_id;
  if (passed && targetLessonId) {
    const { data: existingProgress } = await supabase
      .from("lesson_progress")
      .select("id, completed")
      .eq("user_id", userId)
      .eq("lesson_id", targetLessonId)
      .maybeSingle();

    if (existingProgress) {
      if (!existingProgress.completed) {
        await supabase
          .from("lesson_progress")
          .update({ completed: true, completed_at: new Date().toISOString() })
          .eq("id", existingProgress.id);
      }
    } else {
      await supabase.from("lesson_progress").insert({
        user_id: userId,
        lesson_id: targetLessonId,
        completed: true,
        completed_at: new Date().toISOString(),
      });
    }

    if (courseSlug) {
      revalidatePath(`/courses/${courseSlug}/learn`);
    }
  }

  return { score, passed, correctAnswers };
}
