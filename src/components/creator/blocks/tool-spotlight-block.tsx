"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "./file-upload";
import { ExternalLink } from "lucide-react";

export interface ToolSpotlightContent {
  name: string;
  description: string;
  url?: string;
  icon_url?: string;
}

export function ToolSpotlightEditor({
  content,
  courseId,
  onChange,
}: {
  content: ToolSpotlightContent;
  courseId: string;
  onChange: (c: ToolSpotlightContent) => void;
}) {
  const [name, setName]               = useState(content.name ?? "");
  const [description, setDescription] = useState(content.description ?? "");
  const [url, setUrl]                 = useState(content.url ?? "");

  function emit(patch: Partial<ToolSpotlightContent>) {
    onChange({ name, description, url, icon_url: content.icon_url, ...patch });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[80px_1fr]">
        <FileUpload
          courseId={courseId}
          folder="tool-icons"
          accept="image/*"
          label="Icon"
          currentUrl={content.icon_url || null}
          isImage
          onUpload={(icon_url) => emit({ icon_url })}
        />

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm text-slate-700">Tool name <span className="text-red-500">*</span></Label>
            <Input
              value={name}
              onChange={(e) => { setName(e.target.value); emit({ name: e.target.value }); }}
              placeholder="e.g. Remove.bg"
              className="border-slate-300 bg-white text-slate-900"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm text-slate-700">URL (optional)</Label>
            <Input
              value={url}
              onChange={(e) => { setUrl(e.target.value); emit({ url: e.target.value }); }}
              placeholder="https://remove.bg"
              type="url"
              className="border-slate-300 bg-white text-slate-900"
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Description</Label>
        <Textarea
          value={description}
          onChange={(e) => { setDescription(e.target.value); emit({ description: e.target.value }); }}
          placeholder="What this tool does and when to use it in the workflow…"
          rows={3}
          className="resize-none border-slate-300 bg-white text-slate-900"
        />
      </div>

      {/* Live preview */}
      {name && (
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          {content.icon_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={content.icon_url} alt={name} className="h-10 w-10 rounded-lg object-contain" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-sm font-bold text-blue-700">
              {name[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-slate-900">{name}</p>
              {url && <ExternalLink className="h-3.5 w-3.5 text-slate-400" />}
            </div>
            {description && <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
