"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import type { CourseLevel, PriceType } from "@/types/database";

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

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
    .select("title, description, category, level")
    .eq("id", courseId)
    .single();
  if (courseError || !course) throw new Error("Course not found.");

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
    .select("id")
    .in("module_id", moduleIds);
  if (lessonErr) throw new Error("Unable to validate lessons.");
  if (!lessonRows || lessonRows.length === 0) {
    throw new Error("Add at least one lesson before publishing.");
  }

  const lessonIds = lessonRows.map((l) => l.id);
  const { data: blockRows, error: blockErr } = await supabase
    .from("content_blocks")
    .select("id")
    .in("lesson_id", lessonIds);
  if (blockErr) throw new Error("Unable to validate lesson content.");
  if (!blockRows || blockRows.length === 0) {
    throw new Error("Add at least one lesson content block before publishing.");
  }
}

export async function createCourse(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const category = formData.get("category") as string;
  const thumbnailUrl = formData.get("thumbnail_url") as string;
  const level = formData.get("level") as CourseLevel | null;
  const priceType = (formData.get("price_type") as PriceType) ?? "free";
  const priceAmount = normalizePrice(priceType, formData.get("price_amount"));

  const baseSlug = slugify(title);
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
      price_type: priceType,
      price_amount: priceAmount,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/creator/courses");
  redirect(`/creator/courses/${course.id}`);
}

export async function updateCourse(courseId: string, formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  const priceType = formData.get("price_type") as PriceType;
  const priceAmount = normalizePrice(priceType, formData.get("price_amount"));

  const { error } = await supabase
    .from("courses")
    .update({
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || null,
      thumbnail_url: (formData.get("thumbnail_url") as string) || null,
      category: (formData.get("category") as string) || null,
      level: (formData.get("level") as CourseLevel) || null,
      price_type: priceType,
      price_amount: priceAmount,
    })
    .eq("id", courseId)
    .eq("instructor_id", userId);

  if (error) throw new Error(error.message);

  revalidatePath(`/creator/courses/${courseId}`);
}

export async function publishCourse(courseId: string, publish: boolean) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();

  if (publish) {
    await assertPublishReadiness(supabase, courseId);
  }

  const { error } = await supabase
    .from("courses")
    .update({ status: publish ? "published" : "draft" })
    .eq("id", courseId)
    .eq("instructor_id", userId);

  if (error) throw new Error(error.message);
  revalidatePath(`/creator/courses/${courseId}`);
}

export async function deleteCourse(courseId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();

  const { error } = await supabase
    .from("courses")
    .delete()
    .eq("id", courseId)
    .eq("instructor_id", userId);

  if (error) throw new Error(error.message);
  revalidatePath("/creator/courses");
  redirect("/creator/courses");
}
