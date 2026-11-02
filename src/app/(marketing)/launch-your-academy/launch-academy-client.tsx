"use client";

import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowRight, Loader2, Rocket } from "lucide-react";
import { createAcademy } from "@/actions/academy";

const NAME_MAX = 80;
const TAGLINE_MAX = 160;

export function LaunchAcademyClient() {
  const { setActive } = useClerk();
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [status, setStatus] = useState<"idle" | "creating" | "opening">("idle");
  const [error, setError] = useState<string | null>(null);

  const busy = status !== "idle";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Please enter a name for your academy.");
      return;
    }

    setError(null);
    setStatus("creating");
    try {
      const result = await createAcademy({ name: trimmed, tagline: tagline.trim() || null });
      if (!result.ok) {
        setError(result.error);
        setStatus("idle");
        return;
      }

      setStatus("opening");
      try {
        await setActive({ organization: result.organizationId });
      } catch {
        // Not fatal: the academy pages authorize from the academy's own records.
      }
      // Full navigation so the new session state is used everywhere.
      window.location.assign(`/academy/${result.slug}/admin?welcome=1`);
    } catch {
      setError("We couldn't reach the server. Please check your connection and try again.");
      setStatus("idle");
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8 md:py-12">
      <div className="mb-8 space-y-3 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fd5523]/15 text-[#fd5523]">
          <Rocket className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-[#062e39] md:text-3xl">Name your academy</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          This is the name your students will see. You can add your logo and colours next.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6"
        noValidate
      >
        <div className="space-y-1.5">
          <label htmlFor="academy-name" className="block text-sm font-bold text-[#062e39]">
            Academy name
          </label>
          <input
            id="academy-name"
            name="name"
            type="text"
            required
            autoFocus
            autoComplete="organization"
            maxLength={NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            placeholder="e.g. Lusaka ICT Academy"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "academy-error" : undefined}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 text-base text-slate-900 outline-none transition focus:border-[#fd5523] focus:bg-white focus:ring-4 focus:ring-[#fd5523]/10 disabled:opacity-60"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="academy-tagline" className="block text-sm font-bold text-[#062e39]">
            Short tagline <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="academy-tagline"
            name="tagline"
            type="text"
            maxLength={TAGLINE_MAX}
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            disabled={busy}
            placeholder="e.g. Practical computer skills for everyone"
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 text-base text-slate-900 outline-none transition focus:border-[#fd5523] focus:bg-white focus:ring-4 focus:ring-[#fd5523]/10 disabled:opacity-60"
          />
        </div>

        {error && (
          <p id="academy-error" role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#fd5523] text-base font-bold text-white shadow-lg shadow-[#fd5523]/20 transition hover:bg-[#ef4a16] active:scale-[0.99] disabled:cursor-wait disabled:opacity-80"
        >
          {busy ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {status === "creating" ? "Creating your academy…" : "Opening your academy…"}
            </>
          ) : (
            <>
              Create my academy
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>

        <p aria-live="polite" className="sr-only">
          {status === "creating" ? "Creating your academy" : status === "opening" ? "Opening your academy" : ""}
        </p>
      </form>

      <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
        By continuing you agree to the{" "}
        <Link href="/terms" className="font-bold text-[#fd5523] underline-offset-4 hover:underline">
          Terms
        </Link>
        ,{" "}
        <Link href="/privacy" className="font-bold text-[#fd5523] underline-offset-4 hover:underline">
          Privacy Policy
        </Link>{" "}
        and the{" "}
        <Link href="/academy-agreement" className="font-bold text-[#fd5523] underline-offset-4 hover:underline">
          Academy Agreement
        </Link>
        .
      </p>
    </div>
  );
}
