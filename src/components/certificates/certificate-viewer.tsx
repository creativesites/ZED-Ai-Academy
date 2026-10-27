"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Award,
  CheckCircle2,
  Printer,
  Copy,
  Check,
  Share2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type CertificateData = {
  id: string;
  public_id: string;
  issued_at: string;
  file_url: string | null;
  courses: {
    id: string;
    title: string;
    slug: string;
    category?: string | null;
    company_name?: string | null;
  } | null;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

export function CertificateViewer({
  certificate,
  verificationUrl,
}: {
  certificate: CertificateData;
  verificationUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  const studentName = certificate.profiles?.full_name || "Valued Learner";
  const courseTitle = certificate.courses?.title || "AI Coursework";
  const companyName = certificate.courses?.company_name || null;
  const category = certificate.courses?.category || "Professional AI Specialization";

  const issuedDate = new Date(certificate.issued_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  function handleCopyLink() {
    navigator.clipboard.writeText(verificationUrl);
    setCopied(true);
    toast.success("Verification link copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  }

  function handlePrint() {
    window.print();
  }

  function handleShareLinkedIn() {
    const url = encodeURIComponent(verificationUrl);
    const title = encodeURIComponent(`I've completed "${courseTitle}" on Zed AI Academy!`);
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${url}&title=${title}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Action Bar (Hidden during Print) */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-4 rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white/80 backdrop-blur-md p-4 sm:p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <Link
            href={certificate.courses?.slug ? `/courses/${certificate.courses.slug}` : "/"}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-[#062e39] hover:text-white transition-colors"
            title="Back to Course"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">
                Verified Credential
              </p>
            </div>
            <h2 className="text-sm sm:text-base font-bold text-[#062e39] truncate max-w-xs sm:max-w-md">
              {courseTitle}
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={handleCopyLink}
            variant="outline"
            className="h-9 sm:h-10 rounded-xl border-slate-200 text-xs sm:text-sm font-semibold hover:border-slate-300"
          >
            {copied ? (
              <>
                <Check className="mr-1.5 h-4 w-4 text-emerald-600" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-1.5 h-4 w-4 text-slate-500" />
                Copy Link
              </>
            )}
          </Button>

          <Button
            onClick={handleShareLinkedIn}
            variant="outline"
            className="h-9 sm:h-10 rounded-xl border-slate-200 text-xs sm:text-sm font-semibold text-[#0077b5] hover:border-[#0077b5]/30 hover:bg-[#0077b5]/5"
          >
            <Share2 className="mr-1.5 h-4 w-4" />
            Share
          </Button>

          <Button
            onClick={handlePrint}
            className="h-9 sm:h-10 rounded-xl bg-[#062e39] text-xs sm:text-sm font-bold text-white hover:bg-[#0a4055] shadow-md shadow-[#062e39]/20"
          >
            <Printer className="mr-1.5 h-4 w-4 text-[#fd8d69]" />
            Print / Save PDF
          </Button>
        </div>
      </div>

      {/* ── Official Certificate Diploma (High-Res Print & Screen) ── */}
      <div className="relative mx-auto w-full max-w-4xl bg-gradient-to-br from-[#fcfbf9] via-white to-[#faf8f5] p-4 sm:p-10 shadow-[0_25px_70px_rgba(6,46,57,0.12)] rounded-3xl sm:rounded-[2.5rem] border-[3px] border-[#e2d5c3] print:shadow-none print:border-[2px] print:rounded-none print:p-8 print:max-w-full">
        {/* Intricate Inner Border */}
        <div className="relative rounded-2xl border-2 border-[#d4af37]/40 p-6 sm:p-12 print:p-6 bg-gradient-to-b from-[#fffefc] to-white/95">
          {/* Ornate Corner Accents */}
          <div className="absolute top-2 left-2 h-7 w-7 border-t-2 border-l-2 border-[#d4af37]" />
          <div className="absolute top-2 right-2 h-7 w-7 border-t-2 border-r-2 border-[#d4af37]" />
          <div className="absolute bottom-2 left-2 h-7 w-7 border-b-2 border-l-2 border-[#d4af37]" />
          <div className="absolute bottom-2 right-2 h-7 w-7 border-b-2 border-r-2 border-[#d4af37]" />

          {/* Certificate Header / Emblems */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="flex items-center justify-center gap-3">
              <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#062e39] to-[#0a4055] text-[#fd5523] shadow-xl border-2 border-[#d4af37]/30">
                <Award className="h-9 w-9 sm:h-11 sm:w-11" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                <span className="h-[1px] w-8 sm:w-16 bg-[#d4af37]" />
                <p className="text-[11px] sm:text-xs font-black uppercase tracking-[0.3em] text-[#b8860b]">
                  Zed AI Academy Certification
                </p>
                <span className="h-[1px] w-8 sm:w-16 bg-[#d4af37]" />
              </div>
              <h1 className="text-2xl sm:text-4xl font-serif font-black tracking-tight text-[#062e39] uppercase">
                Certificate of Mastery
              </h1>
              <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                Official Credential of Completion & Academic Excellence
              </p>
            </div>
          </div>

          {/* Recipient Presentation */}
          <div className="mt-8 sm:mt-12 text-center space-y-3">
            <p className="text-xs sm:text-sm italic font-serif text-slate-500">
              This credential certifies that
            </p>
            <div className="py-2">
              <h2 className="text-2xl sm:text-5xl font-serif font-black tracking-tight text-[#062e39] leading-tight">
                {studentName}
              </h2>
              <div className="mx-auto mt-2 h-[2px] w-48 sm:w-80 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent" />
            </div>
            <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed pt-1">
              has successfully completed all rigorous curriculum requirements, practical assignments,
              and verified knowledge assessments for the course
            </p>
          </div>

          {/* Course Details Card */}
          <div className="mt-6 sm:mt-8 text-center space-y-2 rounded-2xl bg-gradient-to-r from-amber-500/[0.04] via-slate-50 to-amber-500/[0.04] p-5 sm:p-6 border border-amber-200/40">
            <h3 className="text-lg sm:text-2xl font-bold tracking-tight text-[#062e39]">
              {courseTitle}
            </h3>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 border border-slate-200 shadow-xs">
                <Sparkles className="h-3 w-3 text-[#fd5523]" />
                {category}
              </span>
              {companyName && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 border border-slate-200 shadow-xs">
                  <Building2 className="h-3 w-3 text-[#062e39]" />
                  {companyName}
                </span>
              )}
            </div>
          </div>

          {/* Signatures & Official Gold Foil Seal */}
          <div className="mt-10 sm:mt-16 grid grid-cols-1 sm:grid-cols-3 items-center gap-6 text-center border-t border-slate-200/80 pt-8">
            {/* Left Signature */}
            <div className="space-y-1.5">
              <div className="h-9 flex items-center justify-center">
                <span className="font-serif italic text-xl sm:text-2xl font-bold text-[#062e39] tracking-wider select-none">
                  W. Zulu
                </span>
              </div>
              <div className="mx-auto h-[1px] w-36 bg-slate-300" />
              <p className="text-[11px] font-bold text-[#062e39] uppercase tracking-wider">Academic Lead</p>
              <p className="text-[9px] text-slate-400">Zed AI Academy</p>
            </div>

            {/* Center Official Gold Seal */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#d4af37] via-[#f7e49e] to-[#aa8014] text-[#062e39] shadow-lg border-2 border-white p-1">
                <div className="h-full w-full rounded-full border border-dashed border-[#062e39]/30 flex flex-col items-center justify-center text-center p-1">
                  <ShieldCheck className="h-6 w-6 text-[#062e39]" />
                  <span className="text-[7px] font-black uppercase tracking-tighter text-[#062e39] mt-0.5">
                    VERIFIED
                  </span>
                  <span className="text-[6px] font-bold uppercase tracking-widest text-[#062e39]/80">
                    EXCELLENCE
                  </span>
                </div>
              </div>
            </div>

            {/* Right Date & Verification */}
            <div className="space-y-1.5">
              <div className="h-9 flex items-center justify-center">
                <span className="text-sm sm:text-base font-semibold text-[#062e39]">
                  {issuedDate}
                </span>
              </div>
              <div className="mx-auto h-[1px] w-36 bg-slate-300" />
              <p className="text-[11px] font-bold text-[#062e39] uppercase tracking-wider">Date of Issuance</p>
              <p className="text-[9px] text-slate-400">Accredited Record</p>
            </div>
          </div>

          {/* Bottom Verification Footer */}
          <div className="mt-8 border-t border-slate-100 pt-4 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400 gap-2">
            <span className="font-mono">Credential ID: {certificate.public_id}</span>
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" /> Cryptographically Validated
            </span>
            <span className="font-mono truncate max-w-xs">{verificationUrl}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
