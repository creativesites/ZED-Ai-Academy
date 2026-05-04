"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUpload } from "./file-upload";
import { FileText, Download } from "lucide-react";

export interface ResourceBlockContent {
  file_url: string;
  file_name: string;
  file_size: number;
  description?: string;
}

function formatBytes(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ResourceBlockEditor({
  content,
  courseId,
  onChange,
}: {
  content: ResourceBlockContent;
  courseId: string;
  onChange: (c: ResourceBlockContent) => void;
}) {
  const [description, setDescription] = useState(content.description ?? "");

  function emit(patch: Partial<ResourceBlockContent>) {
    onChange({ ...content, description, ...patch });
  }

  return (
    <div className="space-y-4">
      <FileUpload
        courseId={courseId}
        folder="resources"
        accept=".pdf,.zip,.xlsx,.docx,.pptx,.csv,.txt"
        label="Upload file"
        currentUrl={content.file_url || null}
        isImage={false}
        onUpload={(url, name, size) => emit({ file_url: url, file_name: name, file_size: size })}
      />

      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Description (optional)</Label>
        <Input
          value={description}
          onChange={(e) => { setDescription(e.target.value); emit({ description: e.target.value }); }}
          placeholder="e.g. Prompt template worksheet — fill in for each client shoot"
          className="border-slate-300 bg-white text-slate-900"
        />
      </div>

      {content.file_url && (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{content.file_name || "Resource"}</p>
            <p className="text-xs text-slate-500">
              {formatBytes(content.file_size)}
              {description ? ` · ${description}` : ""}
            </p>
          </div>
          <a
            href={content.file_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
        </div>
      )}
    </div>
  );
}
