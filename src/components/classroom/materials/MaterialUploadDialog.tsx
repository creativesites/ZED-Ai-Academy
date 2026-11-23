"use client";

import React, { useEffect, useState } from "react";
import { FileText, Link2, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  createClassroomMaterialRecord,
  updateClassroomMaterial,
  type ClassroomFolder,
  type ClassroomMaterial,
} from "@/actions/classroom-materials";
import { uploadClassroomFileWithSignedUrl } from "@/lib/storage/client-signed-upload";
import {
  DOCUMENT_CATEGORIES,
  formatBytes,
  type MaterialCohort,
  type MaterialCourse,
} from "./types";

export function MaterialUploadDialog({
  open,
  onOpenChange,
  companyId,
  companySlug,
  editingMaterial,
  folders,
  cohorts,
  courses,
  defaultFolderId,
  defaultCohortId,
  defaultCourseId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companySlug: string;
  editingMaterial: ClassroomMaterial | null;
  folders: ClassroomFolder[];
  cohorts: MaterialCohort[];
  courses: MaterialCourse[];
  defaultFolderId: string;
  defaultCohortId: string;
  defaultCourseId: string;
  onSaved: () => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [materialSourceType, setMaterialSourceType] = useState<"file" | "link">("file");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadMaterialType, setUploadMaterialType] = useState("pdf");
  const [uploadCategory, setUploadCategory] = useState("lecture_notes");
  const [uploadFolderId, setUploadFolderId] = useState(defaultFolderId);
  const [uploadCohortId, setUploadCohortId] = useState(defaultCohortId);
  const [uploadCourseId, setUploadCourseId] = useState(defaultCourseId);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadExternalUrl, setUploadExternalUrl] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadReqAck, setUploadReqAck] = useState(false);
  const [uploadPinned, setUploadPinned] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  useEffect(() => {
    if (!open) {
      setUploadError(null);
      return;
    }

    setUploadError(null);
    if (editingMaterial) {
      setUploadTitle(editingMaterial.title);
      setUploadMaterialType(editingMaterial.material_type || "document");
      setUploadCategory(editingMaterial.category || "lecture_notes");
      setUploadFolderId(editingMaterial.folder_id || "unfiled");
      setUploadCohortId(editingMaterial.cohort_id || "all");
      setUploadCourseId(editingMaterial.course_id || "all");
      setUploadTags((editingMaterial.tags ?? []).join(", "));
      setUploadDescription(editingMaterial.description || "");
      setUploadReqAck(Boolean(editingMaterial.requires_acknowledgement));
      setUploadPinned(Boolean(editingMaterial.is_pinned));
      setUploadFile(null);
      setUploadExternalUrl("");
      setMaterialSourceType("file");
    } else {
      setUploadTitle("");
      setUploadMaterialType("pdf");
      setUploadCategory("lecture_notes");
      setUploadFolderId(defaultFolderId !== "all" ? defaultFolderId : "unfiled");
      setUploadCohortId(defaultCohortId || "all");
      setUploadCourseId(defaultCourseId || "all");
      setUploadFile(null);
      setUploadExternalUrl("");
      setUploadTags("");
      setUploadDescription("");
      setUploadReqAck(false);
      setUploadPinned(false);
      setMaterialSourceType("file");
    }
  }, [open, editingMaterial, defaultFolderId, defaultCohortId, defaultCourseId]);

  function handleSelectMaterialFile(file: File | null) {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File exceeds 50 MB limit.");
      return;
    }
    setUploadFile(file);
    setMaterialSourceType("file");

    const lower = file.name.toLowerCase();
    if (lower.endsWith(".pdf")) setUploadMaterialType("pdf");
    else if (lower.endsWith(".ppt") || lower.endsWith(".pptx") || lower.endsWith(".key")) {
      setUploadMaterialType("slides");
    } else if (lower.endsWith(".xls") || lower.endsWith(".xlsx") || lower.endsWith(".csv")) {
      setUploadMaterialType("worksheet");
    } else if (
      lower.endsWith(".py") ||
      lower.endsWith(".ipynb") ||
      lower.endsWith(".js") ||
      lower.endsWith(".ts") ||
      lower.endsWith(".json")
    ) {
      setUploadMaterialType("code");
    } else if (lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.endsWith(".webm")) {
      setUploadMaterialType("video");
    } else {
      setUploadMaterialType("document");
    }

    if (!uploadTitle.trim()) {
      const cleanTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim();
      setUploadTitle(cleanTitle);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);

    if (!uploadTitle.trim()) {
      const msg = "Please enter a material title.";
      setUploadError(msg);
      toast.error(msg);
      return;
    }

    if (editingMaterial) {
      setIsUploading(true);
      try {
        await updateClassroomMaterial({
          materialId: editingMaterial.id,
          companyId,
          companySlug,
          title: uploadTitle.trim(),
          description: uploadDescription,
          materialType: uploadMaterialType,
          category: uploadCategory,
          folderId: uploadFolderId,
          cohortId: uploadCohortId || "all",
          courseId: uploadCourseId || "all",
          tags: uploadTags,
          requiresAcknowledgement: uploadReqAck,
          isPinned: uploadPinned,
        });
        toast.success("Material details updated!");
        onOpenChange(false);
        onSaved();
      } catch (err: any) {
        const msg = err?.message || "Failed to update material";
        setUploadError(msg);
        toast.error(msg);
      } finally {
        setIsUploading(false);
      }
      return;
    }

    if (materialSourceType === "file" && !uploadFile) {
      const msg = "Please select or drop a file to upload.";
      setUploadError(msg);
      toast.error(msg);
      return;
    }
    if (materialSourceType === "link" && !uploadExternalUrl.trim()) {
      const msg = "Please enter an external resource URL.";
      setUploadError(msg);
      toast.error(msg);
      return;
    }

    setIsUploading(true);
    try {
      let resolvedFileUrl: string | null =
        materialSourceType === "link" ? uploadExternalUrl.trim() : null;
      const resolvedFileName: string | null = uploadFile?.name ?? null;
      const resolvedFileSize = uploadFile?.size ?? 0;
      const resolvedMimeType = uploadFile?.type || "application/octet-stream";

      if (materialSourceType === "file" && uploadFile) {
        try {
          const uploaded = await uploadClassroomFileWithSignedUrl(companyId, uploadFile);
          resolvedFileUrl = uploaded.publicUrl;
        } catch (directErr) {
          if (uploadFile.size <= 4 * 1024 * 1024) {
            const formData = new FormData();
            formData.append("companyId", companyId);
            formData.append("companySlug", companySlug);
            formData.append("title", uploadTitle.trim());
            formData.append("materialType", uploadMaterialType);
            formData.append("category", uploadCategory);
            formData.append("folderId", uploadFolderId);
            formData.append("cohortId", uploadCohortId || "all");
            formData.append("courseId", uploadCourseId || "all");
            formData.append("tags", uploadTags);
            formData.append("description", uploadDescription);
            formData.append("requiresAcknowledgement", uploadReqAck ? "true" : "false");
            formData.append("isPinned", uploadPinned ? "true" : "false");
            formData.append("file", uploadFile);

            const res = await fetch("/api/classroom/materials/upload", {
              method: "POST",
              body: formData,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.error) {
              const directMsg = directErr instanceof Error ? directErr.message : "";
              throw new Error(data.error || directMsg || `Upload failed (HTTP ${res.status})`);
            }

            toast.success("Learning material uploaded and published!");
            onOpenChange(false);
            onSaved();
            return;
          }

          throw directErr;
        }
      }

      await createClassroomMaterialRecord({
        companyId,
        companySlug,
        title: uploadTitle.trim(),
        description: uploadDescription,
        materialType: uploadMaterialType,
        category: uploadCategory,
        folderId: uploadFolderId,
        cohortId: uploadCohortId || "all",
        courseId: uploadCourseId || "all",
        tags: uploadTags,
        requiresAcknowledgement: uploadReqAck,
        isPinned: uploadPinned,
        fileUrl: resolvedFileUrl,
        fileName: resolvedFileName,
        fileSizeBytes: resolvedFileSize,
        mimeType: resolvedMimeType,
      });

      toast.success("Learning material uploaded and published!");
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      const msg = err?.message || "Failed to upload material";
      setUploadError(msg);
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-2xl rounded-2xl p-4 sm:p-6 max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl font-bold text-[#062e39]">
            {editingMaterial ? "Edit Learning Material" : "Upload Learning Material"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {!editingMaterial && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMaterialSourceType("file")}
                  className={cn(
                    "p-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5",
                    materialSourceType === "file"
                      ? "bg-[#fd5523]/10 border-[#fd5523] text-[#fd5523]"
                      : "bg-slate-50 border-slate-200 text-slate-600",
                  )}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setMaterialSourceType("link")}
                  className={cn(
                    "p-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5",
                    materialSourceType === "link"
                      ? "bg-[#fd5523]/10 border-[#fd5523] text-[#fd5523]"
                      : "bg-slate-50 border-slate-200 text-slate-600",
                  )}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Web / Cloud Link
                </button>
              </div>

              {materialSourceType === "file" ? (
                uploadFile ? (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center text-[#fd5523] shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-[#062e39] truncate">{uploadFile.name}</p>
                        <p className="text-[11px] text-slate-500">{formatBytes(uploadFile.size)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUploadFile(null)}
                      className="h-8 w-8 rounded-lg hover:bg-white text-slate-500 hover:text-red-600 flex items-center justify-center shrink-0"
                      aria-label="Remove file"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingFile(true);
                    }}
                    onDragLeave={() => setIsDraggingFile(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingFile(false);
                      handleSelectMaterialFile(e.dataTransfer.files?.[0] ?? null);
                    }}
                    className={cn(
                      "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all",
                      isDraggingFile
                        ? "border-[#fd5523] bg-[#fff6ee]"
                        : "border-slate-200 bg-slate-50/70 hover:border-[#fd5523]/50 hover:bg-[#fff6ee]/40",
                    )}
                  >
                    <div className="h-11 w-11 rounded-2xl bg-white shadow-xs border border-slate-200/80 flex items-center justify-center text-[#fd5523] mb-2.5">
                      <Upload className="h-5 w-5" />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-[#062e39]">
                      Drag &amp; drop your file here, or click to browse
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1">
                      PDF, Slides, Docs, Spreadsheets, Notebooks, or Videos (up to 50 MB)
                    </span>
                    <input
                      type="file"
                      onChange={(e) => handleSelectMaterialFile(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                  </label>
                )
              ) : (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    External Resource URL <span className="text-[#fd5523]">*</span>
                  </label>
                  <Input
                    value={uploadExternalUrl}
                    onChange={(e) => setUploadExternalUrl(e.target.value)}
                    type="url"
                    placeholder="https://drive.google.com/... or https://github.com/..."
                    className="h-11 rounded-xl text-xs"
                  />
                </div>
              )}
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Material Title <span className="text-[#fd5523]">*</span>
            </label>
            <Input
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="e.g. Chapter 4 Lecture Slides"
              required
              className="h-11 rounded-xl text-xs sm:text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Course Association
              </label>
              <select
                value={uploadCourseId}
                onChange={(e) => setUploadCourseId(e.target.value)}
                className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#062e39] outline-none focus:border-[#fd5523]"
              >
                <option value="all">General Academy Resource</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Subject / Class Section
              </label>
              <select
                value={uploadCohortId}
                onChange={(e) => setUploadCohortId(e.target.value)}
                className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#062e39] outline-none focus:border-[#fd5523]"
              >
                <option value="all">All Classes / Sections</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Material Type
              </label>
              <select
                value={uploadMaterialType}
                onChange={(e) => setUploadMaterialType(e.target.value)}
                className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#062e39] outline-none focus:border-[#fd5523]"
              >
                <option value="pdf">PDF Document</option>
                <option value="document">Word / Doc</option>
                <option value="slides">Slides &amp; Deck</option>
                <option value="worksheet">Worksheet</option>
                <option value="code">Code / Notebook</option>
                <option value="link">External Link</option>
                <option value="video">Video / Recording</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Category
              </label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#062e39] outline-none focus:border-[#fd5523]"
              >
                {DOCUMENT_CATEGORIES.filter((c) => c.value !== "all").map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Folder
              </label>
              <select
                value={uploadFolderId}
                onChange={(e) => setUploadFolderId(e.target.value)}
                className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#062e39] outline-none focus:border-[#fd5523]"
              >
                <option value="unfiled">Unfiled</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Tags (Comma separated)
            </label>
            <Input
              value={uploadTags}
              onChange={(e) => setUploadTags(e.target.value)}
              placeholder="e.g. Week 1, Lecture, Core Reading"
              className="h-11 rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Description / Learning Notes
            </label>
            <Textarea
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
              placeholder="Brief summary or reading instructions for students..."
              className="rounded-xl text-xs resize-none h-20"
            />
          </div>

          <div className="space-y-2 pt-1 border-t border-slate-100">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={uploadReqAck}
                onChange={(e) => setUploadReqAck(e.target.checked)}
                className="rounded"
              />
              Require student reading sign-off / acknowledgement
            </label>

            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={uploadPinned}
                onChange={(e) => setUploadPinned(e.target.checked)}
                className="rounded"
              />
              Pin to top of materials shelf
            </label>
          </div>

          {uploadError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
              {uploadError}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="submit"
              disabled={isUploading}
              className="w-full bg-[#fd5523] hover:bg-[#ef4a16] text-white font-semibold rounded-xl h-10 text-xs sm:text-sm shadow-sm"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  {editingMaterial ? "Saving Changes..." : "Uploading & Publishing..."}
                </>
              ) : editingMaterial ? (
                "Save Changes"
              ) : (
                "Save & Publish Material"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
