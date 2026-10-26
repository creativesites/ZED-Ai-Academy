"use client";

import { useState } from "react";
import { updateOnboardingCourse } from "@/app/(admin)/admin/settings/_actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BookOpen, CheckCircle2, ShieldCheck, Settings } from "lucide-react";

type CourseOption = {
  id: string;
  title: string;
  slug: string;
};

export function SuperAdminSettingsClient({
  courses,
  currentOnboardingCourseId,
}: {
  courses: CourseOption[];
  currentOnboardingCourseId: string;
}) {
  const [selectedCourseId, setSelectedCourseId] = useState(currentOnboardingCourseId);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      await updateOnboardingCourse(selectedCourseId);
      toast.success("Platform settings saved successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update settings.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Onboarding Course Card */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-purple-400" />
              <span>Default Platform Onboarding Course</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Learners who sign up without a specific course invite or academy enrollment will be automatically enrolled in this orientation curriculum.
            </p>
          </div>
        </div>

        <div className="max-w-md space-y-3">
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-slate-700"
          >
            <option value="">None (Disable automatic course enrollment)</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[#fd5523] hover:bg-[#ea4817] text-white text-xs font-bold"
          >
            {isSaving ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </div>

      {/* Tenant Isolation & RLS Security Status Card */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-base font-bold text-white flex items-center gap-2 mb-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Security & Multi-Tenant Model Invariants</span>
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Current platform configuration status:
        </p>

        <ul className="space-y-2 text-xs text-slate-300">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span><strong>Course Tenant Isolation:</strong> Every course is strictly required to belong to a tenant.</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span><strong>Enrollment Provenance:</strong> Database trigger automatically sets enrollment tenant from course.</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span><strong>Multi-Tenant Memberships:</strong> Users can have independent roles across different academies without conflicts.</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span><strong>Suspension Enforcement:</strong> Suspended tenants are barred from learner access.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
