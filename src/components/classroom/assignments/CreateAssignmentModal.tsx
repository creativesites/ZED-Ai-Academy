"use client";

import React, { useState, useTransition } from "react";
import { Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createClassroomAssignment,
  type RubricCriterion,
} from "@/actions/classroom-assignments";
import { uploadClassroomFileWithSignedUrl } from "@/lib/storage/client-signed-upload";

const DEFAULT_RUBRIC: RubricCriterion[] = [
  { id: "1", title: "Technical Completeness", description: "All core requirements implemented", points: 40 },
  { id: "2", title: "Code Quality & Structure", description: "Readable, clean code following conventions", points: 30 },
  { id: "3", title: "Documentation & Testing", description: "Clear instructions and test coverage", points: 30 },
];

export function CreateAssignmentModal({
  open,
  onClose,
  companyId,
  companySlug,
  cohorts,
  courses,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  companyId: string;
  companySlug: string;
  cohorts: { id: string; name: string }[];
  courses: { id: string; title: string }[];
  onCreated: () => Promise<void> | void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newMaxPoints, setNewMaxPoints] = useState("100");
  const [newSubmissionType, setNewSubmissionType] = useState<"file" | "link" | "file_or_link">("file_or_link");
  const [newCohortId, setNewCohortId] = useState("all");
  const [newCourseId, setNewCourseId] = useState("all");
  const [newRubricCriteria, setNewRubricCriteria] = useState<RubricCriterion[]>(DEFAULT_RUBRIC);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error("Please enter an assignment title.");
      return;
    }
    if (!newDueDate) {
      toast.error("Please select a due date.");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("companyId", companyId);
        formData.append("companySlug", companySlug);
        formData.append("title", newTitle);
        formData.append("description", newDescription);
        formData.append("dueDate", newDueDate);
        formData.append("maxPoints", newMaxPoints);
        formData.append("submissionType", newSubmissionType);
        formData.append("cohortId", newCohortId);
        formData.append("courseId", newCourseId);
        formData.append("rubric", JSON.stringify(newRubricCriteria));

        if (attachmentFile) {
          try {
            const uploaded = await uploadClassroomFileWithSignedUrl(companyId, attachmentFile, "assign");
            formData.append("preUploadedFileUrl", uploaded.publicUrl);
            formData.append("preUploadedFileName", uploaded.name);
            formData.append("preUploadedFileSize", String(uploaded.size));
            formData.append("preUploadedFileType", uploaded.type);
          } catch (uploadErr) {
            if (attachmentFile.size <= 4 * 1024 * 1024) {
              formData.append("file", attachmentFile);
            } else {
              throw uploadErr;
            }
          }
        }

        await createClassroomAssignment(formData);
        toast.success("Assignment created successfully!");
        onClose();
        setNewTitle("");
        setNewDescription("");
        setAttachmentFile(null);
        await onCreated();
      } catch (err: any) {
        toast.error(err.message || "Failed to create assignment");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full p-4 sm:p-6 md:p-8 shadow-2xl border border-slate-100 max-h-[85dvh] overflow-y-auto animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <h3 className="text-lg font-black text-ink">Create New Assignment</h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl h-8 w-8 text-slate-400">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
              Title *
            </label>
            <Input
              placeholder="e.g. Week 3: Neural Networks Architecture Implementation"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="rounded-xl font-medium"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                Cohort / Class
              </label>
              <Select value={newCohortId} onValueChange={(v) => setNewCohortId(v ?? "all")}>
                <SelectTrigger className="rounded-xl text-xs font-bold">
                  <SelectValue placeholder="All Cohorts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cohorts (Institution)</SelectItem>
                  {cohorts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                Associated Course
              </label>
              <Select value={newCourseId} onValueChange={(v) => setNewCourseId(v ?? "all")}>
                <SelectTrigger className="rounded-xl text-xs font-bold">
                  <SelectValue placeholder="General / All Courses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">General / Not Specific</SelectItem>
                  {courses.map((crs) => (
                    <SelectItem key={crs.id} value={crs.id}>
                      {crs.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                Due Date &amp; Time *
              </label>
              <Input
                type="datetime-local"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="rounded-xl font-medium text-xs"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                Max Points
              </label>
              <Input
                type="number"
                value={newMaxPoints}
                onChange={(e) => setNewMaxPoints(e.target.value)}
                className="rounded-xl font-medium text-xs"
                min="1"
                max="1000"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
              Submission Format
            </label>
            <Select
              value={newSubmissionType}
              onValueChange={(v) => setNewSubmissionType((v ?? "file_or_link") as any)}
            >
              <SelectTrigger className="rounded-xl text-xs font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="file_or_link">File Upload or GitHub Link (Recommended)</SelectItem>
                <SelectItem value="file">File Upload Only (PDF / Zip / Docx)</SelectItem>
                <SelectItem value="link">GitHub Repository Link Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
              Description &amp; Instructions
            </label>
            <Textarea
              placeholder="Outline assignment instructions, prerequisites, delivery format, and submission deadlines..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="rounded-xl min-h-[100px] text-xs font-medium"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
              Handout Attachment (Optional, PDF / Zip up to 50MB)
            </label>
            <Input
              type="file"
              onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
              className="rounded-xl text-xs font-medium"
            />
          </div>

          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Grading Rubric Criteria
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setNewRubricCriteria((prev) => [
                    ...prev,
                    { id: String(Date.now()), title: "New Criterion", points: 10 },
                  ])
                }
                className="text-xs text-brand-text hover:text-brand-hover h-7"
              >
                + Add Criterion
              </Button>
            </div>

            <div className="space-y-2">
              {newRubricCriteria.map((crit, idx) => (
                <div key={crit.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
                  <Input
                    placeholder="Criterion title"
                    value={crit.title}
                    onChange={(e) => {
                      const updated = [...newRubricCriteria];
                      updated[idx] = { ...updated[idx], title: e.target.value };
                      setNewRubricCriteria(updated);
                    }}
                    className="h-8 rounded-lg text-xs flex-1 bg-white"
                  />
                  <Input
                    type="number"
                    placeholder="Points"
                    value={crit.points}
                    onChange={(e) => {
                      const updated = [...newRubricCriteria];
                      updated[idx] = { ...updated[idx], points: parseInt(e.target.value, 10) || 0 };
                      setNewRubricCriteria(updated);
                    }}
                    className="h-8 w-20 rounded-lg text-xs bg-white text-right"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setNewRubricCriteria(newRubricCriteria.filter((_, i) => i !== idx))}
                    className="h-8 w-8 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
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
                  Creating...
                </>
              ) : (
                "Publish Assignment"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
