"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { pendingRequiredTutorScenarios } from "@/lib/tutor/server/required-tutor-blocks";
import { isSchemaUnavailableError } from "@/lib/tutor/mastery/server";
import { recordQuizEvidence, type QuizRevisionOffer } from "@/lib/tutor/learner/quiz-evidence-server";
import { loose } from "@/lib/tutor/learner/loose-db";
import { isQuizAnswerCorrect } from "@/lib/tutor/learner/quiz-evidence";
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

/** Current question → objective links of a quiz, for the quiz editor (P2-03). Schema-safe. */
export async function listQuestionObjectiveLinks(
  quizId: string
): Promise<{ available: boolean; links: Record<string, string | null> }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await assertCanManageQuiz(supabase, quizId, userId);
  const res = await loose(supabase).from("quiz_questions").select("id, objective_id").eq("quiz_id", quizId);
  if (res.error) {
    if (isSchemaUnavailableError(res.error)) return { available: false, links: {} };
    throw new Error(res.error.message ?? "Could not load objective links");
  }
  const links: Record<string, string | null> = {};
  for (const row of (res.data as Array<{ id: string; objective_id: string | null }> | null) ?? []) {
    links[row.id] = row.objective_id ?? null;
  }
  return { available: true, links };
}

/**
 * Links a quiz question to a registered objective of its course (or unlinks it with null), so answers feed
 * the learner knowledge model (P2-03). Returns available=false while the migration is pending.
 */
export async function setQuestionObjective(
  questionId: string,
  courseId: string,
  lessonId: string,
  objectiveId: string | null
): Promise<{ available: boolean }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  const owner = await assertCanManageQuestion(supabase, questionId, userId);
  const db = loose(supabase);

  if (objectiveId) {
    const res = await db
      .from("learning_objectives")
      .select("id")
      .eq("id", objectiveId)
      .eq("course_id", owner.courseId)
      .neq("status", "retired")
      .maybeSingle();
    if (res.error) {
      if (isSchemaUnavailableError(res.error)) return { available: false };
      throw new Error(res.error.message ?? "Could not check objective");
    }
    if (!res.data) throw new Error("Objective not found in this course.");
  }

  const upd = await db.from("quiz_questions").update({ objective_id: objectiveId }).eq("id", questionId);
  if (upd.error) {
    if (isSchemaUnavailableError(upd.error)) return { available: false };
    throw new Error(upd.error.message ?? "Could not link objective");
  }
  revalidatePath(`/creator/courses/${courseId}/lessons/${lessonId}`);
  return { available: true };
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
  /** Missed objectives that are now weak: offer "Go through these with <Teacher>" (P2-03). */
  revision?: QuizRevisionOffer | null;
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

  // objective_id arrives with migration 20261125000202; before that, grade exactly as before.
  let questions: Array<{ id: string; correct_indices: number[]; objective_id?: string | null }> | null = null;
  const withObjectives = await loose(supabase)
    .from("quiz_questions")
    .select("id, correct_indices, objective_id")
    .eq("quiz_id", quizId);
  if (withObjectives.error && isSchemaUnavailableError(withObjectives.error)) {
    const { data } = await supabase.from("quiz_questions").select("id, correct_indices").eq("quiz_id", quizId);
    questions = data;
  } else {
    questions = (withObjectives.data as typeof questions) ?? null;
  }

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

  // P2-03: per question with an objective, server-verified quiz evidence (enrolled learners only; never
  // for guests, previews or practice retakes after a pass, where the answer key is already known).
  const revision = await recordQuizEvidence({
    userId,
    courseId: access.courseId,
    questions: questions.map((q) => ({
      id: q.id,
      objectiveId: q.objective_id ?? null,
      correct: isQuizAnswerCorrect(q.correct_indices, answers[q.id]),
    })),
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
  return { score, passed, correctAnswers: reveal ? correctAnswers : {}, lessonBlocked, attemptsRemaining, revision };
}
