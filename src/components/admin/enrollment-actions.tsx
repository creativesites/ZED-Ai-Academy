"use client";

import { useTransition } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { activateEnrollment, revokeEnrollment } from "@/actions/admin-enrollments";
import { toast } from "sonner";

export function EnrollmentActions({
  enrollmentId,
  status,
}: {
  enrollmentId: string;
  status: string;
}) {
  const [activating, startActivate] = useTransition();
  const [revoking, startRevoke] = useTransition();

  function handleActivate() {
    startActivate(async () => {
      try {
        await activateEnrollment(enrollmentId);
        toast.success("Enrollment activated — student now has full access.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to activate.");
      }
    });
  }

  function handleRevoke() {
    startRevoke(async () => {
      try {
        await revokeEnrollment(enrollmentId);
        toast.success("Enrollment revoked.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to revoke.");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {status !== "active" && (
        <button
          onClick={handleActivate}
          disabled={activating || revoking}
          title="Activate enrollment"
          className="flex items-center gap-1.5 rounded-lg bg-green-50 border border-green-200 px-3 py-1.5 text-xs font-bold text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
        >
          {activating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle className="h-3.5 w-3.5" />
          )}
          Activate
        </button>
      )}
      {status !== "revoked" && (
        <button
          onClick={handleRevoke}
          disabled={activating || revoking}
          title="Revoke enrollment"
          className="flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
        >
          {revoking ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
          Revoke
        </button>
      )}
    </div>
  );
}
