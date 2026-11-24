"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { ZEDAI_TENANT_ID } from "@/lib/tenants/constants";
import { reviewCard, type ReviewQuality, type SrsReviewResult } from "@/lib/tutor/srs";
import type { LearnerDeckCard } from "@/lib/tutor/server/learner-overview";
import { normalizeObjectiveKey } from "@/lib/tutor/mastery/evidence";
import { persistSessionMastery } from "@/lib/tutor/mastery/server";
import { createDemoRateLimiter } from "@/lib/tutor/demo";

/** Per-instance brake on dock knowledge checks (each one writes evidence and mastery). */
const dockCheckLimiter = createDemoRateLimiter({ limit: 30, windowMs: 10 * 60_000 });

const qualitySchema = z.enum(["again", "hard", "good", "easy"]);

const addCardSchema = z.object({
  companyId: z.string().min(1).optional(),
  language: z.string().trim().min(2).max(16).default("zh"),
  term: z.string().trim().min(1, "Word or phrase is required").max(160),
  pron: z.string().trim().max(160).optional().nullable(),
  meaning: z.string().trim().min(1, "Meaning is required").max(240),
  level: z.string().trim().max(32).optional().nullable(),
});

/**
 * The tenant a learner-owned write goes to. A client-supplied company is only honoured when the learner
 * actually belongs to it (active membership or an active enrollment in one of its courses), or when it
 * is the platform tenant; otherwise the learner's home tenant is used. Never trust the client's value.
 */
async function resolveLearnerCompanyId(userId: string, preferred?: string | null): Promise<string> {
  const db = createServiceClient();
  if (preferred) {
    if (preferred === ZEDAI_TENANT_ID) return preferred;
    const [{ data: member }, { data: enrollment }] = await Promise.all([
      db
        .from("company_members")
        .select("company_id")
        .eq("profile_id", userId)
        .eq("company_id", preferred)
        .eq("status", "active")
        .maybeSingle(),
      db
        .from("enrollments")
        .select("id")
        .eq("user_id", userId)
        .eq("company_id", preferred)
        .eq("status", "active")
        .limit(1)
        .maybeSingle(),
    ]);
    if (member || enrollment) return preferred;
  }
  const { data } = await db
    .from("company_members")
    .select("company_id")
    .eq("profile_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.company_id ?? ZEDAI_TENANT_ID;
}

export async function submitVocabReview(
  vocabId: string,
  quality: ReviewQuality,
): Promise<SrsReviewResult> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const validQuality = qualitySchema.parse(quality);
  const db = createServiceClient();

  const { data: current, error: loadErr } = await db
    .from("learner_vocab")
    .select("interval_days, ease, reps, lapses")
    .eq("user_id", userId)
    .eq("vocab_id", vocabId)
    .maybeSingle();

  if (loadErr || !current) throw new Error("Card not found in your deck");

  const next = reviewCard(
    {
      intervalDays: current.interval_days,
      ease: current.ease,
      reps: current.reps,
      lapses: current.lapses,
    },
    validQuality,
  );

  const { error: updateErr } = await db
    .from("learner_vocab")
    .update({
      due_at: next.dueAt,
      interval_days: next.intervalDays,
      ease: next.ease,
      reps: next.reps,
      lapses: next.lapses,
    })
    .eq("user_id", userId)
    .eq("vocab_id", vocabId);

  if (updateErr) throw new Error(updateErr.message);

  revalidatePath("/practice");
  revalidatePath("/practice/deck");
  return next;
}

export async function addManualVocabCard(
  input: z.input<typeof addCardSchema>,
): Promise<LearnerDeckCard> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = addCardSchema.parse(input);
  const companyId = await resolveLearnerCompanyId(userId, parsed.companyId);
  const db = createServiceClient();

  const { data: item, error: itemErr } = await db
    .from("vocab_items")
    .insert({
      company_id: companyId,
      language: parsed.language,
      term: parsed.term,
      pron: parsed.pron || null,
      meaning: parsed.meaning,
      level: parsed.level || null,
    })
    .select("id, language, term, pron, meaning, level")
    .single();

  if (itemErr || !item) throw new Error(itemErr?.message ?? "Could not create vocabulary card");

  const nowIso = new Date().toISOString();
  const { error: linkErr } = await db.from("learner_vocab").insert({
    user_id: userId,
    vocab_id: item.id,
    company_id: companyId,
    due_at: nowIso,
    interval_days: 0,
    ease: 2.5,
    reps: 0,
    lapses: 0,
    source: "manual",
  });

  if (linkErr) throw new Error(linkErr.message);

  revalidatePath("/practice");
  revalidatePath("/practice/deck");

  return {
    vocabId: item.id,
    companyId,
    language: item.language,
    term: item.term,
    pron: item.pron,
    meaning: item.meaning,
    level: item.level,
    source: "manual",
    dueAt: nowIso,
    intervalDays: 0,
    ease: 2.5,
    reps: 0,
    lapses: 0,
  };
}

export async function deleteLearnerVocabCard(vocabId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const db = createServiceClient();
  const { error } = await db
    .from("learner_vocab")
    .delete()
    .eq("user_id", userId)
    .eq("vocab_id", vocabId);

  if (error) throw new Error(error.message);
  revalidatePath("/practice");
  revalidatePath("/practice/deck");
}

const sessionWordSchema = z.object({
  text: z.string().trim().min(1).max(160),
  pron: z.string().trim().max(160).optional(),
  meaning: z.string().trim().max(240).optional(),
});

/** Saves words introduced during a speaking session into the learner's SRS deck. */
export async function saveSessionWordsToDeck(
  words: Array<{ text: string; pron?: string; meaning?: string }>,
  language = "zh",
  companyId?: string,
): Promise<{ saved: number }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = z.array(sessionWordSchema).min(1).max(20).parse(words);
  const resolvedCompanyId = await resolveLearnerCompanyId(userId, companyId);
  const db = createServiceClient();

  let saved = 0;
  const nowIso = new Date().toISOString();

  for (const w of parsed) {
    const { data: existing } = await db
      .from("vocab_items")
      .select("id")
      .eq("company_id", resolvedCompanyId)
      .eq("term", w.text)
      .limit(1)
      .maybeSingle();

    let vocabId = existing?.id;
    if (!vocabId) {
      const { data: created } = await db
        .from("vocab_items")
        .insert({
          company_id: resolvedCompanyId,
          language,
          term: w.text,
          pron: w.pron ?? null,
          meaning: w.meaning ?? null,
        })
        .select("id")
        .single();
      vocabId = created?.id;
    }

    if (!vocabId) continue;

    const { error } = await db.from("learner_vocab").upsert(
      {
        user_id: userId,
        vocab_id: vocabId,
        company_id: resolvedCompanyId,
        due_at: nowIso,
        interval_days: 0,
        ease: 2.5,
        reps: 0,
        lapses: 0,
        source: "lesson",
      },
      { onConflict: "user_id,vocab_id", ignoreDuplicates: true },
    );

    if (!error) saved += 1;
  }

  revalidatePath("/practice");
  revalidatePath("/practice/deck");
  return { saved };
}

/** Lets a learner opt in or out of sharing a private practice session with their academy teachers. */
export async function toggleShareSessionWithTeacher(
  sessionId: string,
  shared: boolean,
): Promise<{ shared: boolean }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const db = createServiceClient();
  const { error } = await db
    .from("tutor_sessions")
    .update({ shared_with_teacher: shared })
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  revalidatePath("/practice/history");
  return { shared };
}

const dockCheckSchema = z.object({
  courseId: z.string().uuid().optional().nullable(),
  lessonTitle: z.string().trim().min(1).max(160),
  question: z.string().trim().min(1).max(240),
  selectedOption: z.string().trim().min(1).max(200),
  correctOption: z.string().trim().min(1).max(200),
  isCorrect: z.boolean(),
});

/**
 * Records evidence from an interactive :::knowledge_check::: answered inside the Lesson Dock
 * so the learner's mastery state stays unified between the Lesson Dock and Practice Room.
 */
export async function recordDockKnowledgeCheck(
  input: z.input<typeof dockCheckSchema>,
): Promise<{ recorded: boolean; masteryLevel?: number }> {
  const { userId } = await auth();
  if (!userId) return { recorded: false };

  const parsed = dockCheckSchema.parse(input);
  // Evidence must be tied to a course the learner is actively enrolled in. Without this a learner could
  // mint mastery (and staff insights) for any course on the platform by calling the action directly.
  if (!parsed.courseId) return { recorded: false };
  if (!dockCheckLimiter.take(`dock-check:${userId}`).ok) return { recorded: false };

  const db = createServiceClient();
  const [{ data: course }, { data: enrollment }] = await Promise.all([
    db.from("courses").select("company_id").eq("id", parsed.courseId).maybeSingle(),
    db
      .from("enrollments")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", parsed.courseId)
      .eq("status", "active")
      .maybeSingle(),
  ]);
  if (!course || !enrollment) return { recorded: false };
  const resolvedCompanyId = course.company_id ?? ZEDAI_TENANT_ID;

  const objectiveText = `${parsed.lessonTitle}: ${parsed.question}`.slice(0, 200);
  const objectiveKey = normalizeObjectiveKey(objectiveText, {
    courseId: parsed.courseId ?? null,
  });
  const detail = parsed.isCorrect
    ? `Answered "${parsed.selectedOption}" correctly in lesson check.`
    : `Picked "${parsed.selectedOption}" instead of "${parsed.correctOption}" in lesson check.`;

  const updated = await persistSessionMastery({
    supabase: db,
    companyId: resolvedCompanyId,
    userId,
    courseId: parsed.courseId ?? null,
    scenarioId: null,
    sessionId: null,
    evidence: [
      {
        objectiveKey,
        objectiveText,
        result: parsed.isCorrect ? "correct" : "misconception",
        detail,
      },
    ],
  });

  return { recorded: true, masteryLevel: updated[0]?.level };
}
