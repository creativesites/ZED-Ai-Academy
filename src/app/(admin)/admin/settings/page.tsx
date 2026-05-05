import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Settings, BookOpen, GraduationCap, ShieldCheck } from "lucide-react";
import { updateOnboardingCourse } from "./_actions";

export const metadata = { title: "Platform Settings — Zed AI Academy" };

export default async function AdminSettingsPage() {
  const { userId } = await auth();
  const supabase = createServiceClient();

  if (userId) {
    const { data: p } = await supabase.from("profiles").select("role").eq("id", userId).single();
    if (p?.role !== "super_admin") redirect("/dashboard");
  }

  const [
    { data: courses },
    { data: currentSetting },
  ] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title")
      .eq("status", "published")
      .order("title"),
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "onboarding_course_id")
      .single(),
  ]);

  const onboardingCourseId = currentSetting?.value ? (currentSetting.value as string) : "";

  return (
    <div className="container" style={{ paddingTop: "60px", paddingBottom: "120px" }}>
      <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="marketing-kicker bg-[#fff6ee] text-[#fd5523]" style={{ display: "inline-flex", marginBottom: "16px" }}>
            <Settings style={{ width: "14px", height: "14px", marginRight: "8px" }} />
            Configuration
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-[#062e39]">Platform Settings</h1>
          <p className="mt-2 text-slate-500">Configure global onboarding behavior and platform defaults.</p>
        </div>
      </div>

      <div className="grid gap-8 max-w-4xl">
        {/* Onboarding Settings */}
        <section className="marketing-card rounded-[2.5rem] border-0 p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff6ee] text-[#fd5523]">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#062e39]">Onboarding Flow</h2>
              <p className="text-sm text-slate-500">Configure what happens when a new user joins.</p>
            </div>
          </div>

          <form action={async (formData) => {
            "use server";
            const courseId = formData.get("courseId") as string;
            await updateOnboardingCourse(courseId);
          }} className="space-y-6">
            <label className="block space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Default Enrollment Course</span>
              <p className="text-xs text-slate-500 mb-2">New users will be automatically enrolled in this course upon completing onboarding.</p>
              <select 
                name="courseId" 
                defaultValue={onboardingCourseId}
                className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none focus:border-[#fd5523] transition-all"
              >
                <option value="00000000-0000-0000-0000-000000000000">None (No auto-enrollment)</option>
                {courses?.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
            </label>

            <div className="pt-4">
              <Button type="submit" className="h-14 px-8 rounded-2xl bg-[#062e39] text-white font-bold">
                Save Settings
              </Button>
            </div>
          </form>
        </section>

        {/* Info Card */}
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 bg-slate-50/50">
          <div className="flex gap-3">
            <ShieldCheck className="h-5 w-5 text-slate-400 shrink-0" />
            <div className="text-xs text-slate-500 leading-relaxed space-y-2">
              <p><strong>Security Note:</strong> Onboarding is enforced at the middleware level. Users without <code>onboardingComplete: true</code> in their Clerk metadata will be redirected to the onboarding page automatically.</p>
              <p>Platform source tracking is captured during the onboarding submission and stored in the <code>user_platforms</code> table for marketing analytics.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
