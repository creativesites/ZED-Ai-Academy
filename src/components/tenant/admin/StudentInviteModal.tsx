"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Link2,
  Loader2,
  Mail,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { parseStudentCsv } from "@/lib/tenants/student-csv";
import {
  enrollOrInviteTenantStudents,
  selfEnrollTenantAdmin,
  type BulkInviteResult,
} from "@/actions/tenant-enrollments";

export type InviteModalMode = "single" | "bulk" | "self" | "link";

interface StudentInviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companySlug: string;
  courses?: { id: string; title: string; slug?: string }[];
  cohorts?: { id: string; name: string }[];
  defaultMode?: InviteModalMode;
  onSuccess?: () => void;
}

export function StudentInviteModal({
  open,
  onOpenChange,
  companyId,
  companySlug,
  courses = [],
  cohorts = [],
  defaultMode = "single",
  onSuccess,
}: StudentInviteModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<InviteModalMode>(defaultMode);
  const [courseId, setCourseId] = useState<string>("all");
  const [cohortId, setCohortId] = useState<string>("all");

  // Single invite state
  const [singleName, setSingleName] = useState("");
  const [singleEmail, setSingleEmail] = useState("");

  // Bulk CSV state
  const [csvText, setCsvText] = useState("");
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);

  // Result state
  const [bulkResult, setBulkResult] = useState<BulkInviteResult | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [pending, startTransition] = useTransition();

  const parsedCsv = useMemo(() => parseStudentCsv(csvText), [csvText]);

  const joinUrl = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const params = new URLSearchParams();
    if (courseId && courseId !== "all") params.set("courseId", courseId);
    if (cohortId && cohortId !== "all") params.set("cohortId", cohortId);
    const qs = params.toString();
    return `${origin}/academy/${companySlug}/join${qs ? `?${qs}` : ""}`;
  }, [companySlug, courseId, cohortId]);

  function handleCsvFile(file: File | null) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Please choose a CSV file smaller than 2 MB.");
      return;
    }
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCsvText(reader.result);
      }
    };
    reader.readAsText(file);
  }

  function handleDownloadSampleCsv() {
    const sample = "full_name,email\nJane Banda,jane.banda@example.com\nChanda Mwale,chanda.mwale@example.com\n";
    const blob = new Blob([sample], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "student-import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleCopyLink() {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(joinUrl).then(
        () => {
          setCopiedLink(true);
          toast.success("Join link copied!");
          setTimeout(() => setCopiedLink(false), 2500);
        },
        () => fallbackCopy(joinUrl)
      );
    } else {
      fallbackCopy(joinUrl);
    }
  }

  function fallbackCopy(text: string) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    setCopiedLink(true);
    toast.success("Join link copied!");
    setTimeout(() => setCopiedLink(false), 2500);
  }

  function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { validRows } = parseStudentCsv(
      singleName.trim() ? `${singleName.trim()}, ${singleEmail.trim()}` : singleEmail.trim()
    );
    if (validRows.length === 0) {
      toast.error("Enter a valid student email address.");
      return;
    }

    setBulkResult(null);
    startTransition(async () => {
      try {
        const res = await enrollOrInviteTenantStudents({
          companyId,
          companySlug,
          courseId,
          cohortId,
          students: validRows,
          appOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
        });
        setBulkResult(res);
        if (res.enrolledCount > 0) {
          toast.success("Student enrolled immediately!");
        } else if (res.invitedCount > 0) {
          toast.success("Invitation email sent to student!");
        } else if (res.alreadyEnrolledCount > 0) {
          toast.info("Student is already enrolled.");
        }
        setSingleName("");
        setSingleEmail("");
        router.refresh();
        onSuccess?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to invite student.");
      }
    });
  }

  function handleBulkSubmit() {
    if (parsedCsv.validRows.length === 0) {
      toast.error("No valid student emails found to import.");
      return;
    }
    setBulkResult(null);
    startTransition(async () => {
      try {
        const res = await enrollOrInviteTenantStudents({
          companyId,
          companySlug,
          courseId,
          cohortId,
          students: parsedCsv.validRows,
          appOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
        });
        setBulkResult(res);
        toast.success(
          `Processed ${res.enrolledCount + res.invitedCount + res.alreadyEnrolledCount} student(s).`
        );
        router.refresh();
        onSuccess?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Bulk import failed.");
      }
    });
  }

  function handleSelfEnroll() {
    if (!courseId || courseId === "all") {
      toast.error("Select a course to enroll in.");
      return;
    }
    startTransition(async () => {
      try {
        await selfEnrollTenantAdmin(companyId, courseId, companySlug, cohortId);
        toast.success("You are now enrolled in this course!");
        router.refresh();
        onSuccess?.();
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to self-enroll.");
      }
    });
  }

  const tabs: { id: InviteModalMode; label: string; icon: any }[] = [
    { id: "single", label: "Invite Student", icon: UserPlus },
    { id: "bulk", label: "Bulk CSV", icon: FileSpreadsheet },
    { id: "self", label: "Self-Enroll", icon: UserCheck },
    { id: "link", label: "Join Link", icon: Link2 },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) setBulkResult(null);
      }}
    >
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[90dvh] flex flex-col gap-0 p-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl">
        <DialogHeader className="p-5 sm:p-6 bg-[#062e39] text-white shrink-0">
          <div className="flex items-center gap-3 pr-8">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fd5523] text-white">
              <Users className="h-4 w-4" />
            </div>
            <div className="text-left">
              <DialogTitle className="text-lg font-bold text-white">
                Register &amp; Invite Students
              </DialogTitle>
              <DialogDescription className="text-xs text-white/75 mt-0.5">
                Enroll existing learners, bulk-import via CSV, self-enroll, or share an instant join link.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Mode Switcher */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setMode(tab.id);
                setBulkResult(null);
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
                mode === tab.id
                  ? "bg-[#062e39] text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Course & Class/Cohort Assignment Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Assign to Course {mode === "self" ? "(Required)" : "(Optional)"}
              </label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#062e39] outline-none focus:border-[#fd5523]"
              >
                <option value="all">
                  {mode === "self" ? "Select a course..." : "Academy access only (no specific course)"}
                </option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Subject / Class Section (Optional)
              </label>
              <select
                value={cohortId}
                onChange={(e) => setCohortId(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#062e39] outline-none focus:border-[#fd5523]"
              >
                <option value="all">No specific class section</option>
                {cohorts.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* MODE 1: SINGLE INVITE */}
          {mode === "single" && (
            <form onSubmit={handleSingleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Student Full Name
                  </label>
                  <Input
                    value={singleName}
                    onChange={(e) => setSingleName(e.target.value)}
                    placeholder="e.g. Jane Banda"
                    className="h-11 rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Email Address <span className="text-[#fd5523]">*</span>
                  </label>
                  <Input
                    type="email"
                    required
                    value={singleEmail}
                    onChange={(e) => setSingleEmail(e.target.value)}
                    placeholder="jane@example.com"
                    className="h-11 rounded-xl text-sm"
                  />
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Existing users are enrolled immediately. New learners receive an invitation email with direct access to your academy and selected course.
              </p>

              <Button
                type="submit"
                disabled={pending || !singleEmail.trim()}
                className="h-11 w-full rounded-xl bg-[#fd5523] hover:bg-[#ef4a16] text-white text-xs sm:text-sm font-bold"
              >
                {pending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registering Student...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Enroll / Send Invite
                  </>
                )}
              </Button>
            </form>
          )}

          {/* MODE 2: BULK CSV UPLOAD */}
          {mode === "bulk" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-600">
                  Upload a CSV file or paste emails below (supports <code className="text-[#062e39]">full_name,email</code>).
                </p>
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#fd5523] hover:underline shrink-0"
                >
                  <Download className="h-3.5 w-3.5" />
                  Sample CSV
                </button>
              </div>

              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingCsv(true);
                }}
                onDragLeave={() => setIsDraggingCsv(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingCsv(false);
                  handleCsvFile(e.dataTransfer.files?.[0] ?? null);
                }}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition-all",
                  isDraggingCsv
                    ? "border-[#fd5523] bg-[#fff6ee]"
                    : "border-slate-200 bg-slate-50/70 hover:border-[#fd5523]/50"
                )}
              >
                <Upload className="h-6 w-6 text-[#fd5523] mb-2" />
                <span className="text-xs sm:text-sm font-bold text-[#062e39]">
                  {csvFileName ? `Loaded: ${csvFileName}` : "Drag & drop CSV here, or click to browse"}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  Up to 200 students per batch
                </span>
                <input
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  onChange={(e) => handleCsvFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </label>

              <Textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={4}
                placeholder={`full_name,email\nJane Banda,jane@school.zm\nChanda Mwale,chanda@school.zm`}
                className="rounded-xl font-mono text-xs bg-white"
              />

              {(parsedCsv.validRows.length > 0 || parsedCsv.invalidLines.length > 0) && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold text-[#062e39]">
                    <span>{parsedCsv.validRows.length} valid student(s) ready</span>
                    {parsedCsv.invalidLines.length > 0 && (
                      <span className="text-amber-700">
                        {parsedCsv.invalidLines.length} skipped (invalid email)
                      </span>
                    )}
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1 text-[11px] text-slate-600">
                    {parsedCsv.validRows.slice(0, 8).map((row) => (
                      <div key={row.email} className="flex items-center justify-between bg-white px-2.5 py-1 rounded-lg border border-slate-100">
                        <span className="font-semibold truncate">{row.fullName || "—"}</span>
                        <span className="font-mono text-slate-500">{row.email}</span>
                      </div>
                    ))}
                    {parsedCsv.validRows.length > 8 && (
                      <p className="text-center text-slate-400 pt-1">
                        +{parsedCsv.validRows.length - 8} more…
                      </p>
                    )}
                  </div>
                </div>
              )}

              <Button
                type="button"
                onClick={handleBulkSubmit}
                disabled={pending || parsedCsv.validRows.length === 0}
                className="h-11 w-full rounded-xl bg-[#fd5523] hover:bg-[#ef4a16] text-white text-xs sm:text-sm font-bold"
              >
                {pending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registering Batch...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Register &amp; Invite {parsedCsv.validRows.length || 0} Student(s)
                  </>
                )}
              </Button>
            </div>
          )}

          {/* MODE 3: ADMIN SELF-ENROLL */}
          {mode === "self" && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-[#fff6ee] border border-[#fd5523]/15 p-4 flex items-start gap-3">
                <GraduationCap className="h-5 w-5 text-[#fd5523] shrink-0 mt-0.5" />
                <div className="text-xs text-[#062e39] leading-relaxed">
                  <p className="font-bold">Test the student experience yourself</p>
                  <p className="text-slate-600 mt-1">
                    Select a course above to add your own account as an active enrolled learner in this academy.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleSelfEnroll}
                disabled={pending || courseId === "all"}
                className="h-11 w-full rounded-xl bg-[#062e39] hover:bg-[#0a4055] text-white text-xs sm:text-sm font-bold"
              >
                {pending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enrolling...
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-2 h-4 w-4" />
                    Enroll Myself in Selected Course
                  </>
                )}
              </Button>
            </div>
          )}

          {/* MODE 4: DIRECT JOIN LINK */}
          {mode === "link" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Share this direct join link with your students. Any student who signs in via this link will automatically join your academy
                {courseId !== "all" ? " and enroll in the selected course" : ""}.
              </p>

              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <input
                  readOnly
                  value={joinUrl}
                  className="flex-1 bg-transparent font-mono text-xs text-slate-700 outline-none truncate"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCopyLink}
                  className="h-9 rounded-lg bg-[#062e39] text-white hover:bg-[#0a4055] text-xs font-bold shrink-0"
                >
                  {copiedLink ? <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                  {copiedLink ? "Copied" : "Copy Link"}
                </Button>
              </div>
            </div>
          )}

          {/* Batch / Invite Result Banner */}
          {bulkResult && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2 text-xs">
              <p className="font-bold text-emerald-900">Import Summary</p>
              <div className="flex flex-wrap gap-3 text-emerald-800">
                <span>• Enrolled immediately: <strong>{bulkResult.enrolledCount}</strong></span>
                <span>• Invitations emailed: <strong>{bulkResult.invitedCount}</strong></span>
                <span>• Already enrolled: <strong>{bulkResult.alreadyEnrolledCount}</strong></span>
              </div>
              {bulkResult.failed.length > 0 && (
                <div className="pt-2 border-t border-emerald-200/70 text-red-700 space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {bulkResult.failed.length} failed:
                  </p>
                  {bulkResult.failed.slice(0, 5).map((f) => (
                    <p key={f.email} className="text-[11px]">
                      {f.email}: {f.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
