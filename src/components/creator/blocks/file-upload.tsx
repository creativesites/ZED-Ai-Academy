"use client";

import { useRef, useState, useTransition, DragEvent, ChangeEvent } from "react";
import { uploadMedia } from "@/actions/upload";
import { Loader2, Upload, X, ImageIcon, FileText } from "lucide-react";

type Props = {
  courseId: string;
  folder: string;
  accept?: string;
  label?: string;
  currentUrl?: string | null;
  isImage?: boolean;
  onUpload: (url: string, name: string, size: number) => void;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({ courseId, folder, accept, label, currentUrl, isImage = false, onUpload }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function handleFile(file: File) {
    setError(null);
    const maxBytes = isImage ? 5 * 1024 * 1024 : 25 * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(`File exceeds ${isImage ? "5 MB" : "25 MB"} limit`);
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("courseId", courseId);
    fd.append("folder", folder);

    start(async () => {
      try {
        const result = await uploadMedia(fd);
        onUpload(result.url, result.name, result.size);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  const hasPreview = isImage && currentUrl;

  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium text-slate-700">{label}</p>}

      {hasPreview ? (
        <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={currentUrl!} alt="Uploaded" className="max-h-48 w-full object-contain p-2" />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-900">
              Replace
            </span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          disabled={pending}
          className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-sm transition-colors ${
            dragging
              ? "border-blue-400 bg-blue-50"
              : "border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50"
          }`}
        >
          {pending ? (
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          ) : isImage ? (
            <ImageIcon className="h-6 w-6 text-slate-400" />
          ) : (
            <FileText className="h-6 w-6 text-slate-400" />
          )}
          <span className="text-slate-500">
            {pending
              ? "Uploading…"
              : `Drop file here or `}
            {!pending && (
              <span className="font-medium text-blue-600">browse</span>
            )}
          </span>
          <span className="text-xs text-slate-400">
            {isImage ? "PNG, JPG, WebP · max 5 MB" : "PDF, ZIP, etc. · max 25 MB"}
          </span>
        </button>
      )}

      {currentUrl && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {isImage ? (
            <ImageIcon className="h-3.5 w-3.5" />
          ) : (
            <FileText className="h-3.5 w-3.5" />
          )}
          <span className="truncate flex-1">{currentUrl.split("/").pop()}</span>
          <Upload className="h-3.5 w-3.5 cursor-pointer text-blue-500 hover:text-blue-600" onClick={() => inputRef.current?.click()} />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          <X className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="sr-only"
      />
    </div>
  );
}
