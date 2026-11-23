"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { ZEDAI_TENANT_ID } from "@/lib/tenants/constants";
import { reviewCard, type ReviewQuality, type SrsReviewResult } from "@/lib/tutor/srs";
import type { LearnerDeckCard } from "@/lib/tutor/server/learner-overview";

const qualitySchema = z.enum(["again", "hard", "good", "easy"]);

const addCardSchema = z.object({
  companyId: z.string().min(1).optional(),
  language: z.string().trim().min(2).max(16).default("zh"),
  term: z.string().trim().min(1, "Word or phrase is required").max(160),
  pron: z.string().trim().max(160).optional().nullable(),
  meaning: z.string().trim().min(1, "Meaning is required").max(240),
  level: z.string().trim().max(32).optional().nullable(),
});

async function resolveLearnerCompanyId(userId: string, preferred?: string): Promise<string> {
  if (preferred) return preferred;
  const db = createServiceClient();
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
