"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  X, Phone, Loader2, CheckCircle2, MessageCircle, Zap, AlertCircle,
} from "lucide-react";

type Props = {
  planName: string;
  priceLabel: string;
  userEmail?: string;
  userName?: string;
};

const FOUNDER_WHATSAPP = process.env.NEXT_PUBLIC_FOUNDER_WHATSAPP ?? "260979046745";

export function PlanEnrollModal({
  planName,
  priceLabel,
  userEmail = "",
  userName = "",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState(userName);
  const [email, setEmail] = useState(userEmail);
  const [step, setStep] = useState<"form" | "success">("form");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleOpen() {
    setOpen(true);
    setStep("form");
    setError(null);
  }

  function handleClose() {
    setOpen(false);
    setStep("form");
  }

  function buildWhatsAppUrl() {
    const msg = [
      "💎 *New Subscription Request*",
      "",
      `👤 *Name:* ${name}`,
      `📧 *Email:* ${email}`,
      `📱 *Phone:* ${phone}`,
      `🚀 *Plan:* ${planName}`,
      `💰 *Amount:* ${priceLabel}`,
      `📅 *Date:* ${new Date().toLocaleDateString("en-ZM", { dateStyle: "long" })}`,
      "",
      "Please confirm payment and activate my subscription.",
    ].join("\n");
    return `https://wa.me/${FOUNDER_WHATSAPP}?text=${encodeURIComponent(msg)}`;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      // For now, we just proceed to success and let them send WhatsApp
      // In a real app, you'd save a 'pending_subscription' record
      setStep("success");
      // Open WhatsApp automatically in a new tab
      window.open(buildWhatsAppUrl(), "_blank");
    });
  }

  return (
    <>
      <Button
        onClick={handleOpen}
        className={
          planName === "Pro"
            ? "w-full rounded-full bg-white text-[#062e39] hover:bg-[#fff6ee] font-bold h-12 mt-4"
            : "w-full rounded-full bg-[#062e39] text-white hover:bg-[#0a3d4b] font-bold h-12 mt-4"
        }
      >
        {planName === "Free" ? "Get started free" : `Start ${planName} — ${priceLabel}`}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        >
          <div
            className="relative w-full max-w-md rounded-[2.5rem] bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-[#062e39] px-8 py-8 text-white relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 mb-4">
                <Zap className="h-6 w-6 text-[#fd5523]" />
              </div>
              <h3 className="text-2xl font-bold">Secure Checkout</h3>
              <p className="text-white/60 text-sm mt-1">Upgrade to {planName} Plan</p>
              <button
                onClick={handleClose}
                className="absolute top-6 right-6 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-8">
              {step === "form" ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Full Name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      required
                      className="h-12 rounded-2xl border-slate-100 bg-slate-50 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Email Address</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="h-12 rounded-2xl border-slate-100 bg-slate-50 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">WhatsApp Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 0971 234 567"
                        required
                        className="h-12 rounded-2xl border-slate-100 bg-slate-50 pl-11 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  <div className="rounded-[2rem] bg-[#fff6ee] p-6 border border-[#fd5523]/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-[#062e39] opacity-60">Selected Plan</span>
                      <span className="text-sm font-bold text-[#fd5523] uppercase tracking-widest">{planName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-extrabold text-[#062e39]">Total Due</span>
                      <span className="text-lg font-extrabold text-[#062e39]">{priceLabel}</span>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={pending}
                    className="h-14 w-full rounded-full bg-[#25D366] font-extrabold text-white hover:bg-[#20bd5a] shadow-xl shadow-green-500/20"
                  >
                    {pending ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <MessageCircle className="mr-2 h-5 w-5" />
                    )}
                    Complete via WhatsApp
                  </Button>
                </form>
              ) : (
                <div className="py-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] bg-green-50 mb-6">
                    <CheckCircle2 className="h-10 w-10 text-green-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-[#062e39] mb-2">Redirecting to WhatsApp</h3>
                  <p className="text-slate-500 leading-relaxed px-4">
                    If WhatsApp didn&apos;t open automatically, click the button below to send your confirmation message.
                  </p>

                  <div className="mt-10 space-y-4">
                    <a
                      href={buildWhatsAppUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-14 items-center justify-center gap-3 rounded-full bg-[#25D366] px-8 font-extrabold text-white hover:bg-[#20bd5a] transition-all shadow-xl shadow-green-500/20"
                    >
                      <MessageCircle className="h-5 w-5" />
                      Open WhatsApp Manually
                    </a>
                    <button
                      onClick={handleClose}
                      className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      Return to Pricing
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
