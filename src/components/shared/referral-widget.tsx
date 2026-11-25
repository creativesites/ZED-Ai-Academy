"use client";

import { useState, useTransition, useEffect } from "react";
import { getOrCreateReferralCode } from "@/actions/referrals";
import { Copy, Check, Share2 } from "lucide-react";
import { WhatsAppShare } from "./whatsapp-share";

export function ReferralWidget({
  initialCode,
  total,
  converted,
}: {
  initialCode?: string;
  total: number;
  converted: number;
}) {
  const [code, setCode] = useState(initialCode ?? "");
  const [copied, setCopied] = useState(false);
  const [loading, start] = useTransition();

  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  const appUrl = (envUrl && !envUrl.includes("localhost")) ? envUrl : origin;
  const referralUrl = code ? `${appUrl}?ref=${code}` : "";

  function generate() {
    start(async () => {
      const c = await getOrCreateReferralCode();
      setCode(c);
    });
  }

  async function copyLink() {
    if (!referralUrl) return;
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="marketing-outline-card rounded-[2.5rem] border-0 p-8">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-soft text-brand-text">
          <Share2 className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-bold uppercase tracking-widest text-ink">Refer a Friend</h3>
      </div>

      <p className="mb-5 text-sm leading-relaxed text-slate-500">
        Share CS Learn with colleagues and grow your professional network.
      </p>

      {total > 0 && (
        <div className="mb-5 flex gap-6">
          <div>
            <p className="text-2xl font-bold text-ink">{total}</p>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Referred</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{converted}</p>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Enrolled</p>
          </div>
        </div>
      )}

      {code ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3">
            <code className="flex-1 font-mono text-sm font-bold text-ink select-all">
              {referralUrl}
            </code>
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 rounded-xl bg-ink px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-ink-hover"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <WhatsAppShare
            url={referralUrl}
            message="Join me on CS Learn — practical AI courses for professionals in Zambia! 🚀"
            label="Share via WhatsApp"
          />
        </div>
      ) : (
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-full bg-brand px-6 py-3 text-sm font-bold text-white transition-all hover:bg-brand-hover disabled:opacity-60"
        >
          {loading ? "Generating…" : "Get My Referral Link"}
        </button>
      )}
    </div>
  );
}
