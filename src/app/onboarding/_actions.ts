"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import type { CompanyMemberRole, UserRole } from "@/types/database";
import { generateUniqueSlug } from "@/lib/utils";

function normalizeSignupRole(rawRole: string | null): UserRole {
  if (rawRole === "company_admin" || rawRole === "tutor") return "company_admin";
  if (rawRole === "teacher") return "teacher";
  return "learner";
}

function membershipRoleForProfileRole(role: UserRole): CompanyMemberRole {
  if (role === "company_admin") return "company_admin";
  if (role === "teacher" || role === "instructor") return "teacher";
  return "learner";
}

export async function completeOnboarding(formData: FormData) {
  const { userId, orgId, sessionClaims } = await auth();

  if (!userId) {
    return { error: "No signed-in user" };
  }

  const fullName = formData.get("fullName") as string;
  const claims = sessionClaims as Record<string, unknown> | null;
  const platform = typeof claims?.source_platform === "string" ? claims.source_platform : "web";

  if (!fullName) {
    return { error: "Full name is required" };
  }

  const client = await clerkClient();
  const supabase = createServiceClient();

  try {
    const rawRole = formData.get("role") as string | null;
    const finalRole = normalizeSignupRole(rawRole);
    
    // Check form data first, then cookies
    const cookieStore = await cookies();
    const tenantSlug = (formData.get("tenantSlug") as string) || cookieStore.get("last_visited_tenant")?.value;
    
    const teacherCode = formData.get("teacherCode") as string;

    if (finalRole === "company_admin" && !orgId) {
      return { error: "Please create your academy before continuing." };
    }

    await client.users.updateUser(userId, {
      publicMetadata: {
        onboardingComplete: true,
        role: finalRole,
      },
    });

    // 1. Update Profiles table FIRST to satisfy FK constraints
    await supabase
      .from("profiles")
      .upsert({
        id: userId,
        full_name: fullName,
        role: finalRole,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

    let joinedCompanyId: string | null = null;
    let joinedCompanySlug: string | null = null;

    // 2. Handle Company Admin Setup
    if (orgId && finalRole === "company_admin") {
      const org = await client.organizations.getOrganization({ organizationId: orgId });
      joinedCompanyId = org.id;
      joinedCompanySlug = await generateUniqueSlug(supabase, org.name, "companies", org.id);

      await supabase.from("companies").upsert({
        id: org.id,
        name: org.name,
        slug: joinedCompanySlug,
        logo_url: org.imageUrl,
        admin_id: userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

      await supabase.from("company_members").upsert({
        company_id: org.id,
        profile_id: userId,
        status: "active",
        role: "company_admin",
        joined_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "company_id, profile_id" });
    }

    // 3. Handle Tenant Join (Learner or Teacher)
    if (tenantSlug && finalRole !== "company_admin") {
      const { data: tenant } = await supabase
        .from("companies")
        .select("id, slug, teacher_code")
        .eq("slug", tenantSlug)
        .maybeSingle();

      if (tenant) {
        if (finalRole === "teacher") {
          const expectedCode = tenant.teacher_code || "0000";
          if (teacherCode !== expectedCode) {
            return { error: "Invalid staff access code for this academy." };
          }
        }

        joinedCompanyId = tenant.id;
        joinedCompanySlug = tenant.slug;
        await supabase.from("company_members").upsert({
          company_id: tenant.id,
          profile_id: userId,
          status: "active",
          role: membershipRoleForProfileRole(finalRole),
          joined_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "company_id, profile_id" });
      }
    }

    // 4. Update Profile with company context now that it's established
    if (joinedCompanyId) {
      await supabase
        .from("profiles")
        .update({
          company_id: joinedCompanyId,
        })
        .eq("id", userId);
    }

    // 4. Track Platform
    await supabase
      .from("user_platforms")
      .upsert({
        user_id: userId,
        platform: platform,
        last_seen_at: new Date().toISOString(),
      });

    const enrollCourseSlug = formData.get("enrollCourse") as string;
    let redirectUrl = "/dashboard";

    // 5. Handle Specific Course Auto-Enrollment
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
            await supabase.from("company_members").upsert({
              company_id: requestedCourse.company_id,
              profile_id: userId,
              status: "active",
              role: "learner",
              joined_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: "company_id, profile_id" });
          }
          redirectUrl = `/courses/${requestedCourse.slug}/learn`;
        } else {
          redirectUrl = `/courses/${requestedCourse.slug}?action=enroll`;
        }
      }
    } else {
      // Fallback: Enroll in Global Onboarding Course
      const { data: setting } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "onboarding_course_id")
        .single();

      const globalCourseId = setting?.value as string;
      if (globalCourseId && globalCourseId !== "00000000-0000-0000-0000-000000000000") {
        await supabase.from("enrollments").upsert({
          user_id: userId,
          course_id: globalCourseId,
          status: "active",
          source: "manual_admin",
        }, { onConflict: "user_id,course_id" });
      }
    }

    // 6. Role-based Redirection
    if (!enrollCourseSlug && joinedCompanySlug) {
      if (finalRole === "company_admin") {
        redirectUrl = `/academy/${joinedCompanySlug}/admin`;
      } else {
        redirectUrl = `/academy/${joinedCompanySlug}/classroom`;
      }
    }

    return { success: true, redirectUrl };
  } catch (err: unknown) {
    console.error("Onboarding Error:", err);
    return { error: err instanceof Error ? err.message : "There was an error updating your profile." };
  }
}
