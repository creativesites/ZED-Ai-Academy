"use client";

import React, { useEffect, useState, useTransition } from "react";
import { CheckCheck, Download, History, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  createClassroomFolder,
  getDocumentAcknowledgements,
  getDocumentVersions,
  recordDocumentVersion,
  uploadDocumentVersion,
  type ClassroomMaterial,
} from "@/actions/classroom-materials";
import { uploadClassroomFileWithSignedUrl } from "@/lib/storage/client-signed-upload";
import { FOLDER_COLORS, formatBytes } from "./types";
import { DEFAULT_PRIMARY_COLOR } from "@/lib/brand";

export function MaterialFolderDialog({
  open,
  onOpenChange,
  companyId,
  companySlug,
  activeCohortId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companySlug: string;
  activeCohortId?: string | null;
  onCreated: () => void;
}) {
  const [folderName, setFolderName] = useState("");
  const [folderColor, setFolderColor] = useState<string>(DEFAULT_PRIMARY_COLOR);
  const [isCreatingFolder, startCreateFolder] = useTransition();

  function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!folderName.trim()) return;

    startCreateFolder(async () => {
      try {
        const formData = new FormData();
        formData.append("companyId", companyId);
        formData.append("companySlug", companySlug);
        formData.append("name", folderName);
        formData.append("color", folderColor);
        if (activeCohortId) formData.append("cohortId", activeCohortId);

        await createClassroomFolder(formData);
        toast.success(`Folder "${folderName}" created!`);
        setFolderName("");
        onOpenChange(false);
        onCreated();
      } catch (err: any) {
        toast.error(err.message || "Failed to create folder");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[440px] rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-ink">Create New Folder</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreateFolder} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Folder Name
            </label>
            <Input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="e.g. Lecture Slides, Lab Handouts"
              required
              className="h-11 rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Folder Color
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setFolderColor(c.hex)}
                  className={cn(
                    "h-8 w-8 rounded-xl transition-all flex items-center justify-center",
                    folderColor === c.hex ? "ring-2 ring-offset-2 ring-slate-800 scale-110" : "opacity-80 hover:opacity-100",
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="submit"
              disabled={isCreatingFolder || !folderName.trim()}
              className="w-full bg-brand hover:bg-brand-hover text-white font-bold rounded-xl h-12"
            >
              {isCreatingFolder ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Save Folder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MaterialVersionHistoryDialog({
  doc,
  onClose,
  companyId,
  companySlug,
  isAdminOrInstructor,
  onVersionPublished,
}: {
  doc: ClassroomMaterial | null;
  onClose: () => void;
  companyId: string;
  companySlug: string;
  isAdminOrInstructor: boolean;
  onVersionPublished: () => void;
}) {
  const [versions, setVersions] = useState<any[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [versionChangeNote, setVersionChangeNote] = useState("");
  const [isUploadingVersion, startUploadVersion] = useTransition();

  useEffect(() => {
    if (!doc) {
      setVersions([]);
      setVersionFile(null);
      setVersionChangeNote("");
      return;
    }

    let cancelled = false;
    setIsLoadingVersions(true);
    getDocumentVersions(doc.id, companyId)
      .then((list) => {
        if (!cancelled) setVersions(list);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load version history");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingVersions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [doc, companyId]);

  function handleUploadVersion(e: React.FormEvent) {
    e.preventDefault();
    if (!doc || !versionFile) return;

    startUploadVersion(async () => {
      try {
        try {
          const uploaded = await uploadClassroomFileWithSignedUrl(companyId, versionFile, `${doc.id}-ver`);

          await recordDocumentVersion({
            companyId,
            companySlug,
            documentId: doc.id,
            fileUrl: uploaded.publicUrl,
            fileName: versionFile.name,
            fileSizeBytes: versionFile.size,
            mimeType: uploaded.type,
            changeNote: versionChangeNote,
          });
        } catch (signedErr) {
          if (versionFile.size > 4 * 1024 * 1024) throw signedErr;
          const fd = new FormData();
          fd.append("companyId", companyId);
          fd.append("companySlug", companySlug);
          fd.append("documentId", doc.id);
          fd.append("file", versionFile);
          if (versionChangeNote) fd.append("changeNote", versionChangeNote);
          await uploadDocumentVersion(fd);
        }

        toast.success("New document version uploaded!");
        setVersionFile(null);
        setVersionChangeNote("");
        const updated = await getDocumentVersions(doc.id, companyId);
        setVersions(updated);
        onVersionPublished();
      } catch (err: any) {
        toast.error(err.message || "Failed to upload new version");
      }
    });
  }

  return (
    <Dialog open={!!doc} onOpenChange={() => onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-[620px] rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-ink flex items-center gap-2">
            <History className="h-5 w-5 text-brand-text" />
            Version History
          </DialogTitle>
          <p className="text-xs text-slate-400 mt-1">{doc?.title}</p>
        </DialogHeader>

        {isAdminOrInstructor && (
          <form onSubmit={handleUploadVersion} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                Publish New Version
              </span>
              <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-md border">
                Next: v{(versions[0]?.version_number || 1) + 1}
              </span>
            </div>
            <div className="space-y-1">
              <Input
                type="file"
                required
                onChange={(e) => setVersionFile(e.target.files?.[0] || null)}
                className="rounded-xl border-slate-200 text-xs h-10 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-bold file:bg-brand/10 file:text-brand-text"
              />
            </div>
            <div className="space-y-1">
              <Input
                type="text"
                placeholder="Change note (e.g. Added Chapter 5 exercises, fixed typos)..."
                value={versionChangeNote}
                onChange={(e) => setVersionChangeNote(e.target.value)}
                className="h-9 rounded-xl text-xs bg-white"
              />
            </div>
            <Button
              type="submit"
              disabled={isUploadingVersion || !versionFile}
              className="w-full bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl h-10 shadow-md shadow-brand/20"
            >
              {isUploadingVersion ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
              Upload &amp; Replace Active Version
            </Button>
          </form>
        )}

        <div className="space-y-2">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Revision Log ({versions.length})
          </h4>

          {isLoadingVersions ? (
            <div className="py-8 text-center text-slate-400 flex items-center justify-center gap-2 text-xs">
              <Loader2 className="h-4 w-4 animate-spin text-brand-text" /> Loading versions...
            </div>
          ) : versions.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400 border border-dashed rounded-xl">
              No past revisions logged for this resource yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden bg-white">
              {versions.map((ver, idx) => (
                <div
                  key={ver.id || ver.version_number}
                  className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider",
                          idx === 0 ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600",
                        )}
                      >
                        v{ver.version_number} {idx === 0 && "(Active)"}
                      </span>
                      <span className="text-xs font-bold text-slate-800 truncate">{ver.file_name}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {ver.change_note || "No change note provided."}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(ver.created_at).toLocaleString()}{" "}
                      {ver.file_size_bytes > 0 && `· ${formatBytes(ver.file_size_bytes)}`}
                    </p>
                  </div>
                  {ver.file_url && (
                    <a
                      href={ver.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8 px-3 rounded-lg bg-slate-100 hover:bg-brand hover:text-white text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function MaterialAcknowledgementsDialog({
  doc,
  onClose,
  companyId,
}: {
  doc: ClassroomMaterial | null;
  onClose: () => void;
  companyId: string;
}) {
  const [acknowledgements, setAcknowledgements] = useState<any[]>([]);
  const [isLoadingAcks, setIsLoadingAcks] = useState(false);

  useEffect(() => {
    if (!doc) {
      setAcknowledgements([]);
      return;
    }

    let cancelled = false;
    setIsLoadingAcks(true);
    getDocumentAcknowledgements(doc.id, companyId)
      .then((list) => {
        if (!cancelled) setAcknowledgements(list);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load student acknowledgements");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAcks(false);
      });

    return () => {
      cancelled = true;
    };
  }, [doc, companyId]);

  return (
    <Dialog open={!!doc} onOpenChange={() => onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-[540px] rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-ink flex items-center gap-2">
            <CheckCheck className="h-5 w-5 text-emerald-600" />
            Document Acknowledgements
          </DialogTitle>
          <p className="text-xs text-slate-400 mt-1">
            Students who confirmed reading &quot;{doc?.title}&quot;
          </p>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {isLoadingAcks ? (
            <div className="py-8 text-center text-slate-400 flex items-center justify-center gap-2 text-xs">
              <Loader2 className="h-4 w-4 animate-spin text-brand-text" /> Loading sign-offs...
            </div>
          ) : acknowledgements.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-2xl bg-slate-50">
              No students have acknowledged reading this document yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden bg-white">
              {acknowledgements.map((ack) => (
                <div key={ack.acknowledged_at} className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                      {ack.student?.full_name?.charAt(0) || "S"}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        {ack.student?.full_name || ack.student?.email || "Student"}
                      </p>
                      <p className="text-[10px] text-slate-400">{ack.student?.email}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">
                    {new Date(ack.acknowledged_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
