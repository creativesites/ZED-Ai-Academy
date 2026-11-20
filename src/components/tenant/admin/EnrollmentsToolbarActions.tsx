"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, UserCheck, UserPlus } from "lucide-react";
import {
  StudentInviteModal,
  type InviteModalMode,
} from "@/components/tenant/admin/StudentInviteModal";

export function EnrollmentsToolbarActions({
  companyId,
  companySlug,
  courses,
  cohorts,
}: {
  companyId: string;
  companySlug: string;
  courses: { id: string; title: string }[];
  cohorts: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<InviteModalMode>("single");

  function openWithMode(nextMode: InviteModalMode) {
    setMode(nextMode);
    setOpen(true);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
        <Button
          type="button"
          variant="outline"
          onClick={() => openWithMode("self")}
          className="h-10 flex-1 sm:flex-none rounded-xl border-slate-200 bg-white px-3.5 text-xs font-bold text-[#062e39] hover:bg-slate-50"
        >
          <UserCheck className="mr-1.5 h-3.5 w-3.5 text-[#fd5523]" />
          Self-Enroll
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => openWithMode("bulk")}
          className="h-10 flex-1 sm:flex-none rounded-xl border-slate-200 bg-white px-3.5 text-xs font-bold text-[#062e39] hover:bg-slate-50"
        >
          <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-[#fd5523]" />
          Bulk CSV
        </Button>

        <Button
          type="button"
          onClick={() => openWithMode("single")}
          className="h-10 w-full sm:w-auto rounded-xl bg-[#fd5523] px-4 text-xs font-bold text-white hover:bg-[#ef4a16] shadow-sm"
        >
          <UserPlus className="mr-1.5 h-3.5 w-3.5" />
          Invite Student
        </Button>
      </div>

      <StudentInviteModal
        key={`${mode}-${open ? "open" : "closed"}`}
        open={open}
        onOpenChange={setOpen}
        companyId={companyId}
        companySlug={companySlug}
        courses={courses}
        cohorts={cohorts}
        defaultMode={mode}
      />
    </>
  );
}
