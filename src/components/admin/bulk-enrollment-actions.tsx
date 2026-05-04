"use client";

import { useTransition } from "react";
import { CheckCircle, Loader2, Zap } from "lucide-react";
import { activateAllPending } from "@/actions/admin-enrollments";
import { toast } from "sonner";

export function BulkEnrollmentActions({ pendingCount }: { pendingCount: number }) {
  const [isPending, startTransition] = useTransition();

  function handleActivateAll() {
    if (!confirm(`Are you sure you want to activate ALL ${pendingCount} pending enrollments?`)) return;

    startTransition(async () => {
      try {
        const res = await activateAllPending();
        toast.success(`Successfully activated ${res.count} students!`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Bulk activation failed");
      }
    });
  }

  if (pendingCount === 0) return null;

  return (
    <button
      onClick={handleActivateAll}
      disabled={isPending}
      className="flex items-center gap-2 rounded-full bg-green-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-green-600/20 transition-all hover:bg-green-700 active:scale-95 disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Zap className="h-4 w-4 fill-current" />
      )}
      Activate All Pending ({pendingCount})
    </button>
  );
}
