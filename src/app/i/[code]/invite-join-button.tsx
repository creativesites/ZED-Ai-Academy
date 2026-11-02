"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { acceptInvite } from "@/actions/invites";

type Props = {
  code: string;
  label: string;
  brand: string;
  onBrand: string;
  note?: string;
};

export function InviteJoinButton({ code, label, brand, onBrand, note }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function join() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await acceptInvite(code);
        if (result.ok) {
          router.push(result.redirectUrl);
        } else {
          setError(result.error);
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={join}
        disabled={pending}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold shadow-sm transition-transform active:scale-[0.98] disabled:opacity-70"
        style={{ backgroundColor: brand, color: onBrand }}
      >
        {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
        {pending ? "Joining..." : label}
      </button>
      {note && !error && <p className="text-center text-xs text-slate-500">{note}</p>}
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
