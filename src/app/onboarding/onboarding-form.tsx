"use client";

import * as React from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { completeOnboarding } from "./_actions";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, User, Building2, GraduationCap, Users, Key } from "lucide-react";
import { toast } from "sonner";

export type OnboardingFormProps = {
  /** Role chosen before sign-up ("student" | "teacher"), or null to show the chooser. */
  presetRole: "student" | "teacher" | null;
  tenantSlug: string | null;
  tenantName: string | null;
  enrollCourse: string | null;
  initialCode: string | null;
  next: string | null;
};

/** Academy owners never come here: /onboarding redirects them to /launch-your-academy. */
export function OnboardingForm({ presetRole, tenantSlug, tenantName, enrollCourse, initialCode, next }: OnboardingFormProps) {
  const { user } = useUser();
  const router = useRouter();

  const [loading, setLoading] = React.useState(false);
  const [selectedRole, setSelectedRole] = React.useState<string>(presetRole || "student");
  const [teacherCode, setTeacherCode] = React.useState(initialCode || "");

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    try {
      formData.append("role", selectedRole);
      if (selectedRole === "teacher") {
        formData.append("teacherCode", teacherCode);
      }
      
      const res = await completeOnboarding(formData);
      if (res?.success) {
        await user?.reload();
        toast.success("Welcome aboard!");
        router.push(res.redirectUrl || "/dashboard");
      } else if (res?.error) {
        toast.error(res.error);
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const isTeacher = selectedRole === "teacher";

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Complete Your Profile</h1>
        <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
          {tenantName
            ? `You're joining ${tenantName}. Please confirm your name to get started.`
            : "We're excited to have you here. Please confirm your details to get started."}
        </p>
      </div>

      <form action={handleSubmit} className="space-y-6">
        <input type="hidden" name="enrollCourse" value={enrollCourse || ""} />
        <input type="hidden" name="tenantSlug" value={tenantSlug || ""} />
        <input type="hidden" name="next" value={next || ""} />

        {/* Role Selection */}
        {!presetRole && (
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">I am a...</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedRole("student")}
                className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-4 ${
                  selectedRole === "student" 
                    ? "border-[#fd5523] bg-[#fd5523]/5" 
                    : "border-slate-100 hover:border-slate-200"
                }`}
              >
                <div className={`p-2 rounded-xl ${selectedRole === "student" ? "bg-[#fd5523] text-white" : "bg-slate-100 text-slate-500"}`}>
                  <GraduationCap className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">Student</div>
                  <div className="text-xs text-slate-500">I want to learn and grow</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole("teacher")}
                className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-4 ${
                  selectedRole === "teacher" 
                    ? "border-[#fd5523] bg-[#fd5523]/5" 
                    : "border-slate-100 hover:border-slate-200"
                }`}
              >
                <div className={`p-2 rounded-xl ${selectedRole === "teacher" ? "bg-[#fd5523] text-white" : "bg-slate-100 text-slate-500"}`}>
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">Teacher</div>
                  <div className="text-xs text-slate-500">I teach for an existing academy</div>
                </div>
              </button>

              <Link
                href="/launch-your-academy"
                className="p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-4 md:col-span-2 border-slate-100 hover:border-slate-200"
              >
                <div className="p-2 rounded-xl bg-slate-100 text-slate-500">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">Tutor / School Owner</div>
                  <div className="text-xs text-slate-500">I want to create and manage my own academy</div>
                </div>
              </Link>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase tracking-widest text-slate-400">Full Name</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              name="fullName"
              required
              defaultValue={user?.fullName || ""}
              placeholder="e.g. John Doe"
              className="h-14 w-full rounded-2xl border border-slate-200 pl-12 pr-4 outline-none focus:border-[#fd5523] focus:ring-4 focus:ring-[#fd5523]/5 transition-all bg-slate-50/50"
            />
          </div>
        </div>

        {isTeacher && tenantSlug && (
          <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-500">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Academy Staff Code</label>
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                required
                maxLength={6}
                value={teacherCode}
                onChange={(e) => setTeacherCode(e.target.value.replace(/\D/g, ""))}
                placeholder="Staff access code"
                className="h-14 w-full rounded-2xl border border-slate-200 pl-12 pr-4 outline-none focus:border-[#fd5523] focus:ring-4 focus:ring-[#fd5523]/5 transition-all bg-slate-50/50 font-mono tracking-[0.5em] text-lg"
              />
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest px-1">Ask your academy admin for the staff access code.</p>
          </div>
        )}

        <div className="rounded-2xl bg-[#fff6ee] p-4 flex items-start gap-3 border border-[#fd5523]/10">
          <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#fd5523]" />
          <p className="text-xs text-slate-600 leading-relaxed">
            {isTeacher
                ? tenantSlug
                  ? "As a teacher, you'll join this academy and help teach students inside its classroom."
                  : "As a teacher, you can join an academy from that academy's page."
                : "By completing this step, you'll gain access to your personalized learning dashboard and assigned courses."}
          </p>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-14 rounded-2xl bg-[#fd5523] text-white font-bold text-lg shadow-lg shadow-[#fd5523]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Finalizing...
            </>
          ) : (
            <>
              {isTeacher ? "Join Academy Staff" : "Start Learning"}
              <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
