"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enrollManual } from "@/actions/enrollments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  X, Phone, Loader2, CheckCircle2, MessageCircle, BookOpen, AlertCircle,
} from "lucide-react";

type Props = {
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  priceLabel: string;
  userEmail: string;
  userName: string;
  autoOpen?: boolean;
};

const FOUNDER_WHATSAPP = process.env.NEXT_PUBLIC_FOUNDER_WHATSAPP ?? "260979046745";

function buildWhatsAppUrl(
  name: string,
  email: string,
  phone: string,
  courseTitle: string,
  priceLabel: string
) {
  const msg = [
    "🎓 *New Course Enrollment Request*",
    "",
    `👤 *Student:* ${name}`,
    `📧 *Email:* ${email}`,
    `📱 *Phone:* ${phone}`,
    `📚 *Course:* ${courseTitle}`,
    `💰 *Amount:* ${priceLabel}`,
    `📅 *Date:* ${new Date().toLocaleDateString("en-ZM", { dateStyle: "long" })}`,
    "",
    "Please confirm payment and activate their enrollment.",
  ].join("\n");
  return `https://wa.me/${FOUNDER_WHATSAPP}?text=${encodeURIComponent(msg)}`;
}

export function ManualEnrollModal({
  courseId,
  courseSlug,
  courseTitle,
  priceLabel,
  userEmail,
  userName,
  autoOpen = false,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState(userName);
  const [step, setStep] = useState<"form" | "success">("form");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (autoOpen) {
      handleOpen();
    }
  }, [autoOpen]);

  function handleOpen() {
    setOpen(true);
    setStep("form");
    setError(null);
  }

  function handleClose() {
    setOpen(false);
    setStep("form");
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await enrollManual(courseId, courseSlug, phone);
      if (!result.success) {
        if (result.error === "already_enrolled") {
          router.push(`/courses/${courseSlug}/learn`);
          return;
        }
        if (result.error === "already_pending") {
          setStep("success");
          return;
        }
        setError(result.error);
        return;
      }
      setStep("success");
    });
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        className="thm-btn"
        style={{ width: "100%", border: "none", cursor: "pointer", display: "block", textAlign: "center" }}
      >
        Unlock Full Course — {priceLabel}
        <i className="icon-right-arrow21"></i>
        <span className="hover-btn hover-bx"></span>
        <span className="hover-btn hover-bx2"></span>
        <span className="hover-btn hover-bx3"></span>
        <span className="hover-btn hover-bx4"></span>
      </button>

      {/* Modal backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        >
          <div
            className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between rounded-t-3xl bg-[#062e39] px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-white/60">Enrol in Course</p>
                  <p className="font-bold leading-tight text-white">{courseTitle}</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6">
              {step === "form" ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <p className="text-sm leading-relaxed text-slate-500">
                    Fill in your details and we&apos;ll send your enrolment request directly to us via WhatsApp.
                    You&apos;ll get immediate access to the first module while we confirm payment.
                  </p>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Full Name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your full name"
                      required
                      className="h-11 rounded-xl border-slate-200 bg-white text-[#062e39]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Email</Label>
                    <Input
                      value={userEmail}
                      readOnly
                      className="h-11 rounded-xl border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      WhatsApp / Phone Number
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 0971 234 567"
                        required
                        type="tel"
                        className="h-11 rounded-xl border-slate-200 bg-white pl-9 text-[#062e39]"
                      />
                    </div>
                  </div>

                    {error && (
                      <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {error}
                      </div>
                    )}

                    <div className="rounded-xl bg-[#fff6ee] px-5 py-4 border border-[#fd5523]/20 space-y-3">
                      <div className="flex items-center justify-between text-sm pb-3 border-b border-[#fd5523]/10">
                        <span className="font-bold text-slate-600 uppercase tracking-widest text-xs">Course Fee</span>
                        <span className="font-black text-[#fd5523] text-lg">{priceLabel}</span>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-[#062e39] flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#25D366]" />
                          1. Send WhatsApp Request below
                        </p>
                        <p className="text-xs font-bold text-[#062e39] flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#25D366]" />
                          2. Send payment to MTN / Airtel
                        </p>
                        <p className="text-xs font-bold text-[#062e39] flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#25D366]" />
                          3. Admin unlocks full access instantly
                        </p>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={pending}
                      className="h-12 w-full rounded-xl bg-[#25D366] font-bold text-white hover:bg-[#20bd5a]"
                    >
                      {pending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <MessageCircle className="mr-2 h-4 w-4" />
                      )}
                      Send Request via WhatsApp
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-6 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-black text-[#062e39]">Request Sent!</h3>
                      <p className="text-sm text-slate-500">
                        We&apos;ve reserved your spot for <strong>{courseTitle}</strong>. You now have access to the first module.
                      </p>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 text-left border border-slate-100 space-y-3">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">How to pay {priceLabel}</p>
                      
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center shrink-0 text-[10px] font-black">MTN</div>
                        <div>
                          <p className="text-sm font-bold text-[#062e39]">096 123 4567</p>
                          <p className="text-xs text-slate-500">Name: Zed AI Academy</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 pt-2 border-t border-slate-200">
                        <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0 text-[10px] font-black">AIRTEL</div>
                        <div>
                          <p className="text-sm font-bold text-[#062e39]">097 904 6745</p>
                          <p className="text-xs text-slate-500">Name: Winston Zulu</p>
                        </div>
                      </div>
                    </div>

                    <a
                      href={buildWhatsAppUrl(name, userEmail, phone, courseTitle, priceLabel)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white hover:bg-[#20bd5a] transition-colors w-full"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Send Proof of Payment
                    </a>

                    <Button
                      onClick={() => router.push(`/courses/${courseSlug}/learn`)}
                      className="h-11 w-full rounded-xl bg-[#062e39] font-bold text-white hover:bg-[#0a4055]"
                    >
                      Start Free Preview →
                    </Button>

                    <button
                      onClick={handleClose}
                      className="text-xs text-slate-400 hover:text-slate-600 mt-2 block w-full text-center"
                    >
                      Close Window
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
