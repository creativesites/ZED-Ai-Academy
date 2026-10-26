"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Key, ArrowRight, ShieldCheck, GraduationCap, Loader2, Sparkles } from "lucide-react";
import { validateAndJoinStaff } from "@/actions/tenants";
import { toast } from "sonner";
import Link from "next/link";

interface JoinClientProps {
  company: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    primary_color: string | null;
  };
  initialCode?: string;
  role: "teacher" | "learner";
  isSignedIn: boolean;
  isAlreadyMember: boolean;
  memberRole?: string | null;
}

export function JoinClient({
  company,
  initialCode = "",
  role,
  isSignedIn,
  isAlreadyMember,
  memberRole,
}: JoinClientProps) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);

  const brandColor = company.primary_color || "#fd5523";

  const handleTeacherJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error("Please enter the staff access code.");
      return;
    }

    setLoading(true);
    try {
      const res = await validateAndJoinStaff(company.slug, code);
      if (res?.error) {
        toast.error(res.error);
      } else if (res?.redirectUrl) {
        toast.success(`Welcome to the teaching staff at ${company.name}!`);
        router.push(res.redirectUrl);
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl p-8 sm:p-10 text-center relative overflow-hidden">
        
        {/* Brand Logo / Avatar */}
        <div
          className="h-20 w-20 rounded-3xl mx-auto mb-6 flex items-center justify-center text-white text-2xl font-black shadow-xl"
          style={{ backgroundColor: brandColor }}
        >
          {company.logo_url ? (
            <img src={company.logo_url} alt={company.name} className="h-full w-full object-cover rounded-3xl" />
          ) : (
            company.name.charAt(0)
          )}
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-black uppercase tracking-wider mb-3">
          <Sparkles className="h-3.5 w-3.5 text-[#fd5523]" />
          <span>Academy Invitation</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-[#062e39] tracking-tight leading-tight mb-2">
          Join {company.name}
        </h1>

        <p className="text-sm text-slate-500 mb-8 leading-relaxed">
          {role === "teacher"
            ? `You have been invited to join the instructional team at ${company.name}.`
            : `Welcome! Join ${company.name} to start learning, attending classes, and collaborating.`}
        </p>

        {/* State 1: Not signed in */}
        {!isSignedIn ? (
          <div className="space-y-3">
            <Link
              href={`/sign-up?redirect_url=/academy/${company.slug}/join?role=${role}${code ? `&code=${code}` : ""}`}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-bold text-xs uppercase tracking-wider shadow-lg transition-all hover:scale-[1.02] active:scale-95"
              style={{ backgroundColor: brandColor }}
            >
              <span>Create Account to Join</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href={`/sign-in?redirect_url=/academy/${company.slug}/join?role=${role}${code ? `&code=${code}` : ""}`}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-slate-100 text-[#062e39] font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition-all"
            >
              <span>Already have an account? Sign In</span>
            </Link>
          </div>
        ) : isAlreadyMember ? (
          /* State 2: Already a member */
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-800 text-xs font-medium flex items-center gap-2 text-left">
              <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>You are already an active member of this academy with role: <strong>{memberRole}</strong>.</span>
            </div>

            <Link
              href={memberRole === "company_admin" || memberRole === "teacher" ? `/academy/${company.slug}/admin` : `/academy/${company.slug}/classroom`}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-bold text-xs uppercase tracking-wider shadow-lg transition-all hover:scale-[1.02] active:scale-95"
              style={{ backgroundColor: brandColor }}
            >
              <span>{memberRole === "company_admin" || memberRole === "teacher" ? "Open Admin Console" : "Enter Classroom"}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : role === "teacher" ? (
          /* State 3: Teacher code verification */
          <form onSubmit={handleTeacherJoin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                Staff Access Code
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter 6-digit staff code"
                  required
                  className="w-full h-14 px-4 rounded-2xl border-2 border-slate-200 text-lg font-mono font-bold tracking-widest text-[#062e39] focus:outline-none focus:border-[#fd5523] transition-all"
                />
                <Key className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Provided by your academy administrator.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-bold text-xs uppercase tracking-wider shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              style={{ backgroundColor: brandColor }}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>Join Teaching Staff</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* State 4: Direct student join */
          <div className="space-y-4">
            <Link
              href={`/after-sign-in?redirect_url=/academy/${company.slug}/classroom`}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-bold text-xs uppercase tracking-wider shadow-lg transition-all hover:scale-[1.02] active:scale-95"
              style={{ backgroundColor: brandColor }}
            >
              <span>Accept & Enter Classroom</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}