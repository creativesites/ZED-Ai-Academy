"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUpload } from "./file-upload";
import { ChevronsLeftRight } from "lucide-react";

export interface BeforeAfterContent {
  before_url: string;
  after_url: string;
  caption?: string;
}

import { AIImageGenerator } from "../ai-image-generator";

export function BeforeAfterEditor({
  content,
  courseId,
  courseTitle,
  moduleTitle,
  lessonTitle,
  onChange,
}: {
  content: BeforeAfterContent;
  courseId: string;
  courseTitle: string;
  moduleTitle: string;
  lessonTitle: string;
  onChange: (c: BeforeAfterContent) => void;
}) {
  const [caption, setCaption] = useState(content.caption ?? "");

  function emit(patch: Partial<BeforeAfterContent>) {
    onChange({ ...content, caption, ...patch });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <FileUpload
            courseId={courseId}
            folder="before-after"
            accept="image/*"
            label="Before image"
            currentUrl={content.before_url || null}
            isImage
            onUpload={(before_url) => emit({ before_url })}
          />
          <AIImageGenerator 
            courseTitle={courseTitle}
            moduleTitle={moduleTitle}
            lessonTitle={lessonTitle}
            sectionTitle="Before Comparison"
            variant="inline"
            onImageSelected={(asset) => emit({ before_url: asset.public_url })}
            currentImageId={content.before_url ? content.before_url.split('/').pop()?.split('.')[0] : undefined}
          />
        </div>
        <div className="space-y-2">
          <FileUpload
            courseId={courseId}
            folder="before-after"
            accept="image/*"
            label="After image"
            currentUrl={content.after_url || null}
            isImage
            onUpload={(after_url) => emit({ after_url })}
          />
          <AIImageGenerator 
            courseTitle={courseTitle}
            moduleTitle={moduleTitle}
            lessonTitle={lessonTitle}
            sectionTitle="After Comparison"
            variant="inline"
            onImageSelected={(asset) => emit({ after_url: asset.public_url })}
            currentImageId={content.after_url ? content.after_url.split('/').pop()?.split('.')[0] : undefined}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Caption (optional)</Label>
        <Input
          value={caption}
          onChange={(e) => { setCaption(e.target.value); emit({ caption: e.target.value }); }}
          placeholder="e.g. Background removed in 3 seconds with Remove.bg"
          className="border-slate-300 bg-white text-slate-900"
        />
      </div>

      {content.before_url && content.after_url && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <ChevronsLeftRight className="h-3.5 w-3.5" /> Drag the slider to compare
          </p>
          <BeforeAfterSlider beforeUrl={content.before_url} afterUrl={content.after_url} />
          {caption && <p className="text-center text-xs text-slate-500">{caption}</p>}
        </div>
      )}
    </div>
  );
}

export function BeforeAfterSlider({ beforeUrl, afterUrl }: { beforeUrl: string; afterUrl: string }) {
  const [pos, setPos] = useState(50);

  return (
    <div className="relative select-none overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      {/* Before (base) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={beforeUrl} alt="Before" className="block w-full" draggable={false} />

      {/* After (clipped to right of pos) */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={afterUrl} alt="After" className="block h-full w-full object-cover" draggable={false} />
      </div>

      {/* Divider line + handle */}
      <div
        className="pointer-events-none absolute inset-y-0"
        style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
      >
        <div className="h-full w-0.5 bg-white shadow-md" />
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-lg">
          <ChevronsLeftRight className="h-4 w-4 text-slate-700" />
        </div>
      </div>

      {/* Before / After labels */}
      <span className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
        Before
      </span>
      <span className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
        After
      </span>

      {/* Invisible range input for interaction */}
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}
