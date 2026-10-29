"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { ensureTenantMembership } from "@/lib/tenants/membership";
import { normalizeSignupRole, safeRelativePath, tenantFromPath } from "@/lib/auth/signup-flow";
import type { CompanyMemberRole } from "@/types/database";

/**
 * Finish onboarding for learners and teachers. Academy owners use
 * createAcademy (/launch-your-academy) instead.
 *
 * Roles are never downgraded: the profile keeps its current role unless a
 * verified academy join raises it (ensureTenantMembership), and a teacher role
 * always requires the academy's staff code.
 */
export async function completeOnboarding(formData: FormData) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return { error: "No signed-in user" };
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const claims = sessionClaims as Record<string, unknown> | null;
  const platform = typeof claims?.source_platform === "string" ? claims.source_platform : "web";

  if (!fullName) {
    return { error: "Full name is required" };
  }

  const requestedRole = normalizeSignupRole(formData.get("role") as string | null);
  if (requestedRole === "company_admin") {
    return { success: true, redirectUrl: "/launch-your-academy" };
  }
  const joinRole: CompanyMemberRole = requestedRole === "teacher" ? "teacher" : "learner";

  const client = await clerkClient();
  const supabase = createServiceClient();

  try {
    // Check form data first, then cookies
    const cookieStore = await cookies();
    const tenantSlug = (formData.get("tenantSlug") as string) || cookieStore.get("last_visited_tenant")?.value;
    const teacherCode = String(formData.get("teacherCode") ?? "").trim();
    const next = safeRelativePath(formData.get("next") as string | null);

    // Validate the academy (and staff code) BEFORE writing anything.
    let tenant: { id: string; slug: string } | null = null;
    if (tenantSlug) {
      const { data } = await supabase
        .from("companies")
        .select("id, slug, teacher_code, status")
        .eq("slug", tenantSlug)
        .maybeSingle();

      if (data && data.status !== "suspended") {
        if (joinRole === "teacher") {
          // "0000" is the legacy DB default, i.e. the owner never set a code: treat as not configured.
          const expectedCode = data.teacher_code;
          if (!expectedCode || expectedCode === "0000") {
            return { error: "This academy hasn't enabled staff sign-up yet. Ask the owner to set a staff access code." };
          }
          if (teacherCode !== expectedCode) {
            return { error: "Invalid staff access code for this academy." };
          }
        }
        tenant = { id: data.id, slug: data.slug };
      }
    }

    await client.users.updateUserMetadata(userId, {
      publicMetadata: { onboardingComplete: true },
    });

    // 1. Profile first (FK target). Keep any existing role; new profiles start as learners.
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    await supabase
      .from("profiles")
      .upsert({
        id: userId,
        full_name: fullName,
        role: existingProfile?.role ?? "learner",
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

    // 2. Academy join (learner, or teacher after the staff-code check above). Never downgrades.
    if (tenant) {
      await ensureTenantMembership(userId, tenant.id, joinRole);
    }
    const joinedCompanySlug = tenant?.slug ?? null;

    // 3. Track Platform
    await supabase
      .from("user_platforms")
      .upsert({
        user_id: userId,
        platform: platform,
        last_seen_at: new Date().toISOString(),
      });

    const enrollCourseSlug = formData.get("enrollCourse") as string;
    let redirectUrl = "/dashboard";

    // 4. Handle Specific Course Auto-Enrollment
    if (enrollCourseSlug) {
      const { data: requestedCourse } = await supabase
        .from("courses")
        .select("id, slug, price_type, company_id")
        .eq("slug", enrollCourseSlug)
        .single();

      if (requestedCourse) {
        if (requestedCourse.price_type === "free") {
          await supabase.from("enrollments").upsert({
            user_id: userId,
            course_id: requestedCourse.id,
            company_id: requestedCourse.company_id,
            status: "active",
            source: "individual_purchase",
          }, { onConflict: "user_id,course_id" });

          if (requestedCourse.company_id) {
            await ensureTenantMembership(userId, requestedCourse.company_id, "learner");
          }
          redirectUrl = `/courses/${requestedCourse.slug}/learn`;
        } else {
          redirectUrl = `/courses/${requestedCourse.slug}?action=enroll`;
        }
      }
    } else if (!tenant) {
      // Platform learners only. Anyone joining an academy (and academy owners, who
      // never reach this action) must not become a member of the platform tenant
      // through the global onboarding course.
      const { data: setting } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "onboarding_course_id")
        .single();

      const globalCourseId = setting?.value as string;
      if (globalCourseId && globalCourseId !== "00000000-0000-0000-0000-000000000000") {
        const { data: globalCourse } = await supabase
          .from("courses")
          .select("id, company_id")
          .eq("id", globalCourseId)
          .maybeSingle();

        if (globalCourse) {
          await supabase.from("enrollments").upsert({
            user_id: userId,
            course_id: globalCourse.id,
            company_id: globalCourse.company_id,
            status: "active",
            source: "manual_admin",
          }, { onConflict: "user_id,course_id" });

          if (globalCourse.company_id) {
            await ensureTenantMembership(userId, globalCourse.company_id, "learner");
          }
        }
      }
    }

    // 5. Redirect into the academy that was joined.
    if (!enrollCourseSlug && joinedCompanySlug) {
      redirectUrl =
        next && tenantFromPath(next) === joinedCompanySlug
          ? next
          : joinRole === "teacher"
            ? `/academy/${joinedCompanySlug}/admin`
            : `/academy/${joinedCompanySlug}/classroom`;
    } else if (!enrollCourseSlug && next) {
      redirectUrl = next;
    }

    return { success: true, redirectUrl };
  } catch (err: unknown) {
    console.error("Onboarding Error:", err);
    return { error: err instanceof Error ? err.message : "There was an error updating your profile." };
  }
}
