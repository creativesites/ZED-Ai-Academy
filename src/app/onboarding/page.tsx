"use client";

import * as React from "react";
import { useUser, CreateOrganization } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "./_actions";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, User } from "lucide-react";
import { toast } from "sonner";

export default function OnboardingPage() {
  const { user } = useUser();
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [showOrgCreate, setShowOrgCreate] = React.useState(false);

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    try {
      const res = await completeOnboarding(formData);
      if (res?.success) {
        // Forces a token refresh and refreshes the `User` object
        await user?.reload();
        toast.success("Welcome aboard!");
        router.push("/dashboard");
      } else if (res?.error) {
        toast.error(res.error);
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-slate-500 leading-relaxed">
          We're excited to have you here. Please confirm your details to get started with your learning journey.
        </p>
      </div>

      <form action={handleSubmit} className="space-y-6">
        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase tracking-widest text-slate-400">Your Full Name</label>
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

        <div className="rounded-2xl bg-[#fff6ee] p-4 flex items-start gap-3 border border-[#fd5523]/10">
          <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#fd5523]" />
          <p className="text-xs text-slate-600 leading-relaxed">
            By completing this step, you'll gain access to your personalized dashboard and any complimentary courses assigned to your account.
          </p>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <button 
            type="button"
            onClick={() => setShowOrgCreate(!showOrgCreate)}
            className="text-sm font-bold text-[#fd5523] hover:underline"
          >
            {showOrgCreate ? "← Back to personal details" : "Are you setting up for a team? Create an organization"}
          </button>
        </div>

        {showOrgCreate && (
          <div className="mt-4 p-4 rounded-[2rem] bg-slate-50 border border-slate-200">
            <CreateOrganization 
              afterCreateOrganizationUrl="/onboarding"
              appearance={{
                elements: {
                  card: "shadow-none border-0 bg-transparent p-0",
                  navbar: "hidden",
                }
              }}
            />
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-14 rounded-2xl bg-[#fd5523] text-white font-bold text-lg shadow-lg shadow-[#fd5523]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Setting things up...
            </>
          ) : (
            <>
              Start Learning
              <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
