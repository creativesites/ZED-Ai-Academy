"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { pendingRequiredTutorScenarios } from "@/lib/tutor/server/required-tutor-blocks";
import {
  assertCanManageLesson,
  assertCanManageQuiz,
  getLessonAccess,
} from "@/lib/courses/course-auth-server";

async function assertCanManageQuestion(
  supabase: ReturnType<typeof createClient>,
  questionId: string,
  userId: string
) {
  const { data: q } = await supabase.from("quiz_questions").select("quiz_id").eq("id", questionId).maybeSingle();
  if (!q?.quiz_id) throw new Error("Question not found.");
  return assertCanManageQuiz(supabase, q.quiz_id, userId);
}

export async function createQuiz(lessonId: string, courseId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await assertCanManageLesson(supabase, lessonId, userId, courseId);

  const { data: existingQuiz } = await supabase
    .from("quizzes")
    .select("*")
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (existingQuiz) return existingQuiz;

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
  await assertCanManageQuiz(supabase, quizId, userId);

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
  await assertCanManageQuiz(supabase, quizId, userId);

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
  await assertCanManageQuestion(supabase, questionId, userId);

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
  await assertCanManageQuestion(supabase, questionId, userId);

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
): Promise<{
  score: number;
  passed: boolean;
  correctAnswers: Record<string, number[]>;
  /** Passed, but the lesson has required speaking practice still to do, so it was not marked complete. */
  lessonBlocked?: boolean;
  /** null = unlimited */
  attemptsRemaining?: number | null;
}> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, lesson_id, pass_threshold, max_attempts")
    .eq("id", quizId)
    .single();

  if (!quiz) throw new Error("Quiz not found");

  const access = await getLessonAccess(supabase, quiz.lesson_id, userId);
  if (!access.allowed) {
    throw new Error("Enrol in this course to take the knowledge check.");
  }

  const { data: priorAttempts } = await supabase
    .from("quiz_attempts")
    .select("passed")
    .eq("quiz_id", quizId)
    .eq("user_id", userId);
  const attemptsUsed = priorAttempts?.length ?? 0;
  const alreadyPassed = Boolean(priorAttempts?.some((a) => a.passed));
  if (!alreadyPassed && quiz.max_attempts && quiz.max_attempts > 0 && attemptsUsed >= quiz.max_attempts) {
    throw new Error("You have used all attempts for this knowledge check. Ask your instructor to reset it.");
  }

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

  // Practice retakes after a pass are graded but not recorded, so they never undo the pass.
  if (alreadyPassed) {
    return { score, passed, correctAnswers, lessonBlocked: false, attemptsRemaining: null };
  }

  await supabase.from("quiz_attempts").insert({
    quiz_id: quizId,
    user_id: userId,
    answers: answers as Json,
    score,
    passed,
  });

  // If passed and lessonId is available, auto-mark lesson complete in lesson_progress
  // Always trust the quiz's own lesson, never the caller-supplied one.
  void lessonId;
  const targetLessonId = quiz.lesson_id;
  // Same gate as the manual "Complete" action: required tutor_session blocks must be finished first.
  const lessonBlocked =
    passed && targetLessonId ? (await pendingRequiredTutorScenarios(supabase, targetLessonId, userId)).length > 0 : false;
  if (passed && targetLessonId && !lessonBlocked) {
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

  const attemptsRemaining =
    quiz.max_attempts && quiz.max_attempts > 0 ? Math.max(0, quiz.max_attempts - attemptsUsed - 1) : null;
  // Only reveal the answer key once the learner has passed or run out of attempts.
  const reveal = passed || attemptsRemaining === 0;
  return { score, passed, correctAnswers: reveal ? correctAnswers : {}, lessonBlocked, attemptsRemaining };
}
