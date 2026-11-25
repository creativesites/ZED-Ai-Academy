"use client";

import React, { useState, useTransition } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  submitClassroomAssignment,
  type AssignmentWithMeta,
} from "@/actions/classroom-assignments";
import { uploadClassroomFileWithSignedUrl } from "@/lib/storage/client-signed-upload";
import { GithubIcon } from "./types";

export function SubmitAssignmentModal({
  open,
  onClose,
  assignment,
  companyId,
  companySlug,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  assignment: AssignmentWithMeta | null;
  companyId: string;
  companySlug: string;
  onSubmitted: () => Promise<void> | void;
}) {
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open || !assignment) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!submissionFile && !repoUrl.trim() && !submissionNotes.trim()) {
      toast.error("Please attach a file, GitHub repository URL, or notes.");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("companyId", companyId);
        formData.append("companySlug", companySlug);
        formData.append("assignmentId", assignment.id);

        if (submissionFile) {
          try {
            const uploaded = await uploadClassroomFileWithSignedUrl(
              companyId,
              submissionFile,
              `sub-${assignment.id}`,
            );
            formData.append("preUploadedFileUrl", uploaded.publicUrl);
            formData.append("preUploadedFileName", uploaded.name);
            formData.append("preUploadedFileSize", String(uploaded.size));
          } catch (uploadErr) {
            if (submissionFile.size <= 4 * 1024 * 1024) {
              formData.append("file", submissionFile);
            } else {
              throw uploadErr;
            }
          }
        }
        if (repoUrl.trim()) formData.append("repoUrl", repoUrl.trim());
        if (submissionNotes.trim()) formData.append("submissionText", submissionNotes.trim());

        await submitClassroomAssignment(formData);
        toast.success("Assignment submitted successfully!");
        onClose();
        setSubmissionFile(null);
        setRepoUrl("");
        setSubmissionNotes("");
        await onSubmitted();
      } catch (err: any) {
        toast.error(err.message || "Failed to submit assignment");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 md:p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 max-h-[85dvh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-black text-ink">Turn In Assignment</h3>
            <p className="text-xs text-slate-500 font-medium truncate max-w-xs">{assignment.title}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl h-8 w-8 text-slate-400">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {assignment.submission_type !== "link" && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                Upload Solution File (PDF, Zip, Doc, Code)
              </label>
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:bg-slate-50/50 transition-all cursor-pointer">
                <Upload className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <Input
                  type="file"
                  onChange={(e) => setSubmissionFile(e.target.files?.[0] || null)}
                  className="cursor-pointer text-xs"
                />
                <p className="text-[11px] text-slate-400 mt-1">Maximum upload size: 50MB</p>
              </div>
            </div>
          )}

          {assignment.submission_type !== "file" && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                GitHub Repository URL
              </label>
              <div className="relative">
                <GithubIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="https://github.com/username/project-repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="pl-10 rounded-xl font-medium text-xs"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
              Submission Notes or Comments for Instructor
            </label>
            <Textarea
              placeholder="Optional notes, instructions to run your code, or key highlights..."
              value={submissionNotes}
              onChange={(e) => setSubmissionNotes(e.target.value)}
              className="rounded-xl min-h-[80px] text-xs font-medium"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl text-xs font-bold">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className="bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-black shadow-md shadow-brand/20"
            >
              {pending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Submitting...
                </>
              ) : (
                "Submit Assignment"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
