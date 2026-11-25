"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { requestVivaHumanReview } from "@/actions/viva-reviews";

/** P2-08: "Ask your teacher to review" — one human review per course for an oral check outcome. */
export function VivaReviewRequest({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const res = await requestVivaHumanReview({ courseId, note: note.trim() || null });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Sent to your teacher for review.");
      setOpen(false);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-sm font-semibold underline underline-offset-2"
      >
        Ask your teacher to review
      </button>
    );
  }

  return (
    <div className="mt-3 w-full space-y-2">
      <label className="block text-sm" htmlFor={`viva-review-note-${courseId}`}>
        Anything your teacher should know? (optional, you can ask once)
      </label>
      <textarea
        id={`viva-review-note-${courseId}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={1000}
        rows={3}
        disabled={pending}
        className="w-full rounded-lg border border-white/30 bg-white/10 p-2 text-sm text-inherit placeholder:text-white/50"
      />
      <div className="flex gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-lg bg-[#fd5523] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send for review"}
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={pending} className="text-sm underline">
          Cancel
        </button>
      </div>
    </div>
  );
}
