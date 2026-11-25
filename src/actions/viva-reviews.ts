"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireCourseEditor } from "@/lib/authz/context-server";
import {
  decideVivaReview,
  loadCourseVivaConfig,
  loadVivaReviewTenant,
  requestVivaReview,
} from "@/lib/tutor/server/viva";
import { isSchemaUnavailableError } from "@/lib/tutor/mastery/server";
import { loose } from "@/lib/tutor/learner/loose-db";
import { normalizeVivaRubric, type VivaRubric } from "@/lib/tutor/viva-v2";

// P2-08 human route for the certificate oral check: learners request one review per course; course editors
// (course owner, academy staff, super admin) decide pending reviews. Tenant is always derived from the review.

/** Studio: the course's oral check rubric. `available: false` until migration 20261125000501 is applied. */
export async function getCourseVivaRubric(courseId: string): Promise<{ available: boolean; rubric: VivaRubric }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const id = z.string().uuid().parse(courseId);
  await requireCourseEditor(id, userId);
  const config = await loadCourseVivaConfig(id);
  return { available: config.rubricAvailable, rubric: config.rubric };
}

const rubricInputSchema = z.object({
  minMetShare: z.number().min(0.1).max(1),
  minTaskScore: z.number().int().min(1).max(100),
  minMasteryShare: z.number().min(0).max(1),
  requireHumanApproval: z.boolean(),
  allowAppeal: z.boolean(),
});

/** Studio: saves the course's oral check rubric (only the fields Studio edits; the rest keep defaults). */
export async function updateCourseVivaRubric(input: {
  courseId: string;
  rubric: z.input<typeof rubricInputSchema>;
}): Promise<{ available: boolean; rubric: VivaRubric }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const courseId = z.string().uuid().parse(input.courseId);
  const fields = rubricInputSchema.parse(input.rubric);
  await requireCourseEditor(courseId, userId);

  const current = await loadCourseVivaConfig(courseId);
  if (!current.rubricAvailable) return { available: false, rubric: current.rubric };
  const rubric = normalizeVivaRubric({ ...current.rubric, ...fields });
  const res = await loose(createServiceClient())
    .from("courses")
    .update({ viva_rubric: rubric })
    .eq("id", courseId)
    .select("id");
  if (res.error) {
    if (isSchemaUnavailableError(res.error)) return { available: false, rubric: current.rubric };
    throw new Error(res.error.message ?? "Could not save the rubric");
  }
  revalidatePath(`/creator/courses/${courseId}`);
  return { available: true, rubric };
}

/** Learner: ask a teacher to review the oral check outcome (once per course). */
export async function requestVivaHumanReview(input: {
  courseId: string;
  note?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Please sign in." };
  const parsed = z
    .object({ courseId: z.string().uuid(), note: z.string().max(5000).nullable().optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const { data: enrollment } = await createServiceClient()
    .from("enrollments")
    .select("status")
    .eq("user_id", userId)
    .eq("course_id", parsed.data.courseId)
    .maybeSingle();
  if (!enrollment || enrollment.status !== "active") {
    return { ok: false, error: "An active enrolment is required." };
  }

  const res = await requestVivaReview({ courseId: parsed.data.courseId, userId, note: parsed.data.note ?? null });
  if (res.ok) revalidatePath("/courses/[slug]/learn", "page");
  return res;
}

/** Staff: approve or return a pending oral check review. */
export async function decideVivaReviewAction(input: {
  reviewId: string;
  decision: "approve" | "return";
  note?: string | null;
}): Promise<{ ok: true; status: "approved" | "returned" } | { ok: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Please sign in." };
  const parsed = z
    .object({
      reviewId: z.string().uuid(),
      decision: z.enum(["approve", "return"]),
      note: z.string().max(5000).nullable().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const tenant = await loadVivaReviewTenant(parsed.data.reviewId);
  if (!tenant) return { ok: false, error: "Review not found." };
  try {
    await requireCourseEditor(tenant.courseId, userId);
  } catch {
    return { ok: false, error: "You can't review oral checks for this course." };
  }

  const note = parsed.data.note ?? null;
  const res = await decideVivaReview({
    reviewId: parsed.data.reviewId,
    staffUserId: userId,
    decision: parsed.data.decision === "approve" ? { type: "approve", note } : { type: "return", note: note ?? "" },
  });
  if (res.ok) revalidatePath("/academy/[domain]/admin/ai-teachers/reviews", "page");
  return res;
}
