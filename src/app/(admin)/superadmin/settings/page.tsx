import { requireSuperAdmin } from "@/lib/auth/super-admin";
import { Settings, ShieldCheck, BookOpen } from "lucide-react";
import { SuperAdminSettingsClient } from "@/components/superadmin/SuperAdminSettingsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings — Super Admin Control Plane" };

export default async function SuperAdminSettingsPage() {
  const { supabase } = await requireSuperAdmin();

  const [
    { data: courses },
    { data: currentSetting },
  ] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, slug, status")
      .eq("status", "published")
      .order("title"),
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "onboarding_course_id")
      .single(),
  ]);

  let currentOnboardingCourseId = "";
  if (currentSetting?.value) {
    try {
      currentOnboardingCourseId =
        typeof currentSetting.value === "string"
          ? currentSetting.value.replace(/^"|"$/g, "")
          : String(currentSetting.value);
    } catch {
      currentOnboardingCourseId = "";
    }
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Settings className="h-4 w-4 text-amber-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
            System Configuration
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Platform Settings
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure default platform behavior, global onboarding requirements, and system preferences.
        </p>
      </div>

      <SuperAdminSettingsClient
        courses={courses ?? []}
        currentOnboardingCourseId={currentOnboardingCourseId}
      />
    </div>
  );
}
