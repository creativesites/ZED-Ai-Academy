"use client";

import * as React from "react";
import { useUser, CreateOrganization, useOrganizationList } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { completeOnboarding } from "./_actions";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, User, Building2, GraduationCap, Users, Key } from "lucide-react";
import { toast } from "sonner";

export default function OnboardingPage() {
  const { user } = useUser();
  const { userMemberships } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  });
  const router = useRouter();
  const searchParams = useSearchParams();
  const enrollCourse = searchParams.get("enroll_course");
  const tenantSlug = searchParams.get("tenant");
  const initialRole = searchParams.get("role") || "student";
  
  const [loading, setLoading] = React.useState(false);
  const [showOrgCreate, setShowOrgCreate] = React.useState(false);
  const [selectedRole, setSelectedRole] = React.useState(initialRole);
  const [teacherCode, setTeacherCode] = React.useState("");

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

  const isTenantOwner = selectedRole === "company_admin" || selectedRole === "tutor";
  const isTeacher = selectedRole === "teacher";
  const hasOrg = (userMemberships?.data?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Complete Your Profile</h1>
        <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
          We&apos;re excited to have you here. Please confirm your details to get started.
        </p>
      </div>

      <form action={handleSubmit} className="space-y-6">
        <input type="hidden" name="enrollCourse" value={enrollCourse || ""} />
        <input type="hidden" name="tenantSlug" value={tenantSlug || ""} />
        
        {/* Role Selection */}
        {!searchParams.get("role") && (
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

              <button
                type="button"
                onClick={() => setSelectedRole("company_admin")}
                className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-4 md:col-span-2 ${
                  isTenantOwner
                    ? "border-[#fd5523] bg-[#fd5523]/5" 
                    : "border-slate-100 hover:border-slate-200"
                }`}
              >
                <div className={`p-2 rounded-xl ${isTenantOwner ? "bg-[#fd5523] text-white" : "bg-slate-100 text-slate-500"}`}>
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">Tutor / School Owner</div>
                  <div className="text-xs text-slate-500">I want to create and manage my own academy</div>
                </div>
              </button>
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
                maxLength={4}
                value={teacherCode}
                onChange={(e) => setTeacherCode(e.target.value.replace(/\D/g, ""))}
                placeholder="4-digit access code"
                className="h-14 w-full rounded-2xl border border-slate-200 pl-12 pr-4 outline-none focus:border-[#fd5523] focus:ring-4 focus:ring-[#fd5523]/5 transition-all bg-slate-50/50 font-mono tracking-[0.5em] text-lg"
              />
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest px-1">Ask your academy admin for the staff access code.</p>
          </div>
        )}

        {isTenantOwner && !hasOrg && (
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Academy Setup</h3>
                <p className="text-xs text-slate-500">Tenant owners need an academy organization to manage courses and students.</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowOrgCreate(!showOrgCreate)}
                className="text-sm font-bold text-[#fd5523] hover:underline flex items-center gap-1"
              >
                {showOrgCreate ? "Cancel" : "Create Academy"}
              </button>
            </div>

            {showOrgCreate && (
              <div className="mt-4 p-2 rounded-[2rem] bg-slate-50 border border-slate-200">
                <CreateOrganization 
                  afterCreateOrganizationUrl="/onboarding?role=company_admin"
                  appearance={{
                    elements: {
                      card: "shadow-none border-0 bg-transparent p-0",
                      navbar: "hidden",
                    }
                  }}
                />
              </div>
            )}
          </div>
        )}

        <div className="rounded-2xl bg-[#fff6ee] p-4 flex items-start gap-3 border border-[#fd5523]/10">
          <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#fd5523]" />
          <p className="text-xs text-slate-600 leading-relaxed">
            {isTenantOwner 
              ? "As a tenant owner, you'll be able to create courses, manage enrollments, and access the academy studio."
              : isTeacher
                ? tenantSlug
                  ? "As a teacher, you'll join this academy and help teach students inside its classroom."
                  : "As a teacher, you can join an academy from that academy's page."
                : "By completing this step, you'll gain access to your personalized learning dashboard and assigned courses."}
          </p>
        </div>

        <Button
          type="submit"
          disabled={loading || (isTenantOwner && !hasOrg)}
          className="w-full h-14 rounded-2xl bg-[#fd5523] text-white font-bold text-lg shadow-lg shadow-[#fd5523]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Finalizing...
            </>
          ) : (
            <>
              {isTenantOwner ? "Go to Academy Dashboard" : isTeacher ? "Join Academy Staff" : "Start Learning"}
              <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
