"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { decideVivaReviewAction } from "@/actions/viva-reviews";

export type VivaReviewQueueRow = {
  id: string;
  kind: "needs_review" | "appeal";
  status: "pending" | "approved" | "returned";
  courseTitle: string;
  learnerName: string;
  learnerNote: string | null;
  reviewerNote: string | null;
  summary: string | null;
  createdAt: string;
  decidedAt: string | null;
};

const KIND_LABEL: Record<VivaReviewQueueRow["kind"], string> = {
  needs_review: "Oral check needs review",
  appeal: "Learner asked for a review",
};

const STATUS_LABEL: Record<VivaReviewQueueRow["status"], string> = {
  pending: "Waiting for you",
  approved: "Approved",
  returned: "Returned with a note",
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function ReviewCard({ row }: { row: VivaReviewQueueRow }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const decide = (decision: "approve" | "return") => {
    startTransition(async () => {
      const res = await decideVivaReviewAction({ reviewId: row.id, decision, note: note.trim() || null });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.status === "approved" ? "Approved. The learner can now claim their certificate." : "Returned to the learner with your note.");
      router.refresh();
    });
  };

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{row.learnerName}</p>
          <p className="text-sm text-slate-500">
            {row.courseTitle} · {KIND_LABEL[row.kind]} · {formatDate(row.createdAt)}
          </p>
        </div>
        <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
          {STATUS_LABEL[row.status]}
        </span>
      </div>
      {row.summary && <p className="mt-2 text-sm text-slate-700">{row.summary}</p>}
      {row.learnerNote && (
        <p className="mt-2 text-sm text-slate-700">
          <span className="font-medium">Learner&apos;s note:</span> {row.learnerNote}
        </p>
      )}
      {row.status !== "pending" && row.reviewerNote && (
        <p className="mt-2 text-sm text-slate-700">
          <span className="font-medium">Your note:</span> {row.reviewerNote}
        </p>
      )}
      {row.status === "pending" && (
        <div className="mt-3 space-y-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            placeholder="Note for the learner (needed when you return it)"
            aria-label={`Note for ${row.learnerName}`}
            disabled={pending}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => decide("approve")} disabled={pending}>
              Approve
            </Button>
            <Button type="button" variant="outline" onClick={() => decide("return")} disabled={pending || !note.trim()}>
              Return with note
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

export function VivaReviewQueue({ rows }: { rows: VivaReviewQueueRow[] }) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">Nothing to review.</p>;
  }
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <ReviewCard key={row.id} row={row} />
      ))}
    </ul>
  );
}
