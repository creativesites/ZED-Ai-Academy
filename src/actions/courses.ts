"use server";

import { toActionResult } from "@/lib/actions/result";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/supabase/ensure-profile";
import type { CourseLevel, PriceType } from "@/types/database";
import {
  getCourseEditorPath,
  getCourseListPath,
  normalizeCourseSlug,
} from "@/lib/courses/course-routes";
import { assertCanManageCourse } from "@/lib/courses/course-auth-server";
import { resolveCourseCreateCompany } from "@/lib/courses/course-create";

function normalizePrice(
  priceType: PriceType,
  rawPrice: FormDataEntryValue | null
): number | null {
  if (priceType === "free" || priceType === "subscription_only") return null;
  if (!rawPrice) return null;

  const parsed = Number(rawPrice);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Price must be a valid non-negative number.");
  }
  return parsed;
}

async function assertPublishReadiness(supabase: Awaited<ReturnType<typeof createClient>>, courseId: string) {
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("title, description, category, level, price_type, price_amount")
    .eq("id", courseId)
    .single();
  if (courseError || !course) throw new Error("Course not found.");
  if ((course.price_type === "one_time" || course.price_type === "both") && !(Number(course.price_amount) > 0)) {
    throw new Error("Set a price for this paid course before publishing.");
  }

  if (!course.title?.trim()) throw new Error("Add a course title before publishing.");
  if (!course.description?.trim()) throw new Error("Add a course description before publishing.");
  if (!course.category) throw new Error("Choose a course category before publishing.");
  if (!course.level) throw new Error("Choose a course level before publishing.");

  const { data: moduleRows, error: moduleErr } = await supabase
    .from("modules")
    .select("id")
    .eq("course_id", courseId);
  if (moduleErr) throw new Error("Unable to validate modules.");
  if (!moduleRows || moduleRows.length === 0) {
    throw new Error("Add at least one module before publishing.");
  }

  const moduleIds = moduleRows.map((m) => m.id);
  const { data: lessonRows, error: lessonErr } = await supabase
    .from("lessons")
    .select("id, title")
    .in("module_id", moduleIds);
  if (lessonErr) throw new Error("Unable to validate lessons.");
  if (!lessonRows || lessonRows.length === 0) {
    throw new Error("Add at least one lesson before publishing.");
  }

  const lessonIds = lessonRows.map((l) => l.id);
  const { data: blockRows, error: blockErr } = await supabase
    .from("content_blocks")
    .select("lesson_id")
    .in("lesson_id", lessonIds);
  if (blockErr) throw new Error("Unable to validate lesson content.");
  const lessonsWithContent = new Set((blockRows ?? []).map((b) => b.lesson_id));
  const empty = lessonRows.filter((l) => !lessonsWithContent.has(l.id));
  if (empty.length > 0) {
    const names = empty.slice(0, 3).map((l) => `“${l.title}”`).join(", ");
    throw new Error(
      `${empty.length} lesson${empty.length === 1 ? " has" : "s have"} no content yet: ${names}${empty.length > 3 ? "…" : ""}`
    );
  }
}

export async function createCourse(formData: FormData) {
  const { userId, orgId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await ensureProfile(userId);
  const supabase = createClient();

  const explicitCompanyId = ((formData.get("company_id") || formData.get("companyId")) as string | null)?.trim() || null;
  const tenantSlug = ((formData.get("tenant_slug") as string | null) ?? "").trim() || null;
  const returnTo = ((formData.get("return_to") as string | null) ?? "").trim() || null;

  const [{ data: profile }, { data: memberRows }, { data: ownedRows }, explicitCompanyRes, orgCompanyRes] =
    await Promise.all([
      supabase.from("profiles").select("role, company_id").eq("id", userId).maybeSingle(),
      supabase
        .from("company_members")
        .select("company_id, role, status")
        .eq("profile_id", userId),
      supabase.from("companies").select("id").eq("admin_id", userId),
      explicitCompanyId
        ? supabase.from("companies").select("id, admin_id").eq("id", explicitCompanyId).maybeSingle()
        : Promise.resolve({ data: null as { id: string; admin_id: string | null } | null }),
      orgId && orgId !== explicitCompanyId
        ? supabase.from("companies").select("id, admin_id").eq("id", orgId).maybeSingle()
        : Promise.resolve({ data: null as { id: string; admin_id: string | null } | null }),
    ]);

  const resolved = resolveCourseCreateCompany({
    userId,
    explicitCompanyId,
    clerkOrgId: orgId,
    profileRole: profile?.role,
    profileCompanyId: profile?.company_id,
    explicitCompanyAdminId: explicitCompanyRes.data?.admin_id ?? null,
    clerkOrgAdminId:
      orgId === explicitCompanyId
        ? explicitCompanyRes.data?.admin_id ?? null
        : orgCompanyRes.data?.admin_id ?? null,
    memberships: (memberRows ?? []) as Array<{ company_id: string; role: string; status: string }>,
    ownedCompanyIds: (ownedRows ?? []).map((c) => c.id),
  });

  if (!resolved.ok) {
    throw new Error(resolved.error);
  }
  const companyId = resolved.companyId;

  const rawTitle = (formData.get("title") as string | null) ?? "";
  const title = rawTitle.trim();
  if (!title) {
    throw new Error("Course title is required.");
  }

  const description = formData.get("description") as string;
  const category = formData.get("category") as string;
  const thumbnailUrl = formData.get("thumbnail_url") as string;
  const level = formData.get("level") as CourseLevel | null;
  const priceType = (formData.get("price_type") as PriceType) ?? "free";
  const priceAmount = normalizePrice(priceType, formData.get("price_amount"));

  const baseSlug = normalizeCourseSlug(title);
  let slug = baseSlug;
  let attempt = 0;
  while (true) {
    const { data } = await supabase.from("courses").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }

  const { data: course, error } = await supabase
    .from("courses")
    .insert({
      title,
      slug,
      description: description || null,
      thumbnail_url: thumbnailUrl || null,
      category: category || null,
      level: level || null,
      instructor_id: userId,
      company_id: companyId,
      price_type: priceType,
      price_amount: priceAmount,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // Seed the outline drafted by the AI course assistant so creators land on a real curriculum.
  const rawOutline = formData.get("module_outline");
  if (typeof rawOutline === "string" && rawOutline) {
    try {
      const outline = (JSON.parse(rawOutline) as unknown[])
        .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        .slice(0, 12);
      if (outline.length > 0) {
        await supabase
          .from("modules")
          .insert(outline.map((t, i) => ({ course_id: course.id, title: t.trim().slice(0, 200), position: i + 1 })));
      }
    } catch {
      // Outline is a convenience; never block course creation on it.
    }
  }

  if (returnTo) {
    revalidatePath(returnTo);
    redirect(returnTo);
  }

  if (tenantSlug) {
    revalidatePath(getCourseListPath(tenantSlug));
    redirect(getCourseEditorPath(course.id, tenantSlug));
  }

  revalidatePath("/creator/courses");
  redirect(getCourseEditorPath(course.id));
}

export async function createCourseAction(
  _prevState: { error?: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  try {
    await createCourse(formData);
    return null;
  } catch (err) {
    unstable_rethrow(err);
    return {
      error: err instanceof Error ? err.message : "Unable to create course. Please check your inputs and try again.",
    };
  }
}

async function updateCourseImpl(courseId: string, formData: FormData, tenantSlug?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await assertCanManageCourse(supabase, courseId, userId);

  const priceType = formData.get("price_type") as PriceType;
  const priceAmount = normalizePrice(priceType, formData.get("price_amount"));

  const { error } = await supabase
    .from("courses")
    .update({
      title: ((formData.get("title") as string) ?? "").trim(),
      description: (formData.get("description") as string) || null,
      thumbnail_url: (formData.get("thumbnail_url") as string) || null,
      category: (formData.get("category") as string) || null,
      level: (formData.get("level") as CourseLevel) || null,
      price_type: priceType,
      price_amount: priceAmount,
    })
    .eq("id", courseId);

  if (error) throw new Error(error.message);

  revalidatePath(`/creator/courses/${courseId}`);
  if (tenantSlug) {
    revalidatePath(getCourseEditorPath(courseId, tenantSlug));
  }
}

async function publishCourseImpl(courseId: string, publish: boolean, tenantSlug?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await assertCanManageCourse(supabase, courseId, userId);

  if (publish) {
    await assertPublishReadiness(supabase, courseId);
  }

  const { error } = await supabase
    .from("courses")
    .update({ status: publish ? "published" : "draft" })
    .eq("id", courseId);

  if (error) throw new Error(error.message);
  revalidatePath(`/creator/courses/${courseId}`);
  if (tenantSlug) {
    revalidatePath(getCourseEditorPath(courseId, tenantSlug));
  }
}

async function deleteCourseImpl(courseId: string, tenantSlug?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await assertCanManageCourse(supabase, courseId, userId);

  const { error } = await supabase
    .from("courses")
    .delete()
    .eq("id", courseId);

  if (error) throw new Error(error.message);
  const listPath = getCourseListPath(tenantSlug);
  revalidatePath(listPath);
  redirect(listPath);
}

// ── Public actions: return { ok, data | error } so the real error reaches the author. ──
export async function updateCourse(...args: Parameters<typeof updateCourseImpl>) {
  return toActionResult("updateCourse", () => updateCourseImpl(...args));
}

export async function publishCourse(...args: Parameters<typeof publishCourseImpl>) {
  return toActionResult("publishCourse", () => publishCourseImpl(...args));
}

export async function deleteCourse(...args: Parameters<typeof deleteCourseImpl>) {
  return toActionResult("deleteCourse", () => deleteCourseImpl(...args));
}
