"use client";

import { Download, FileText } from "lucide-react";

export function ResourceBlock({ content }: { content: Record<string, unknown> }) {
  const fileUrl = content.file_url as string;
  const fileName = (content.file_name as string) || "Resource";
  const fileSize = content.file_size as number | undefined;
  const description = content.description as string | undefined;
  
  const formatBytes = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;
  
  if (!fileUrl) return null;
  
  return (
    <div className="flex flex-col sm:flex-row items-center gap-5 rounded-[2rem] border-2 border-slate-100 bg-white p-6 hover:shadow-lg transition-all group">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#fff6ee] group-hover:scale-110 transition-transform">
        <FileText className="h-6 w-6 text-[#fd5523]" />
      </div>
      <div className="flex-1 min-w-0 text-center sm:text-left">
        <p className="font-bold text-[#062e39] text-lg truncate mb-1">{fileName}</p>
        <p className="text-sm text-slate-500">
          {fileSize ? formatBytes(fileSize) : "Document"}
          {description ? ` · ${description}` : ""}
        </p>
      </div>
      <a href={fileUrl} target="_blank" rel="noreferrer"
        className="flex w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#062e39] px-6 py-3 text-sm font-bold text-white transition-all hover:bg-[#0a4055] hover:scale-105 active:scale-95 shadow-lg shadow-[#062e39]/10">
        <Download className="h-4 w-4" />
        Download
      </a>
    </div>
  );
}
