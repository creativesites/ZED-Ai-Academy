"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUpload } from "./file-upload";

export interface ImageBlockContent {
  url: string;
  caption?: string;
  alt?: string;
  display?: "full" | "contained";
}

import { AIImageGenerator } from "../ai-image-generator";

export function ImageBlockEditor({
  content,
  courseId,
  courseTitle,
  moduleTitle,
  lessonTitle,
  onChange,
}: {
  content: ImageBlockContent;
  courseId: string;
  courseTitle: string;
  moduleTitle: string;
  lessonTitle: string;
  onChange: (c: ImageBlockContent) => void;
}) {
  const [caption, setCaption] = useState(content.caption ?? "");
  const [alt, setAlt] = useState(content.alt ?? "");
  const [display, setDisplay] = useState<"full" | "contained">(content.display ?? "contained");

  function emit(patch: Partial<ImageBlockContent>) {
    onChange({ ...content, caption, alt, display, ...patch });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <FileUpload
          courseId={courseId}
          folder="images"
          accept="image/*"
          label="Image"
          currentUrl={content.url || null}
          isImage
          onUpload={(url) => emit({ url })}
        />
        <AIImageGenerator 
          courseTitle={courseTitle}
          moduleTitle={moduleTitle}
          lessonTitle={lessonTitle}
          onImageSelected={(asset) => emit({ url: asset.public_url })}
          currentImageId={content.url ? content.url.split('/').pop()?.split('.')[0] : undefined}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm text-slate-700">Caption (optional)</Label>
          <Input
            value={caption}
            onChange={(e) => { setCaption(e.target.value); emit({ caption: e.target.value }); }}
            placeholder="e.g. Before/after using Remove.bg"
            className="border-slate-300 bg-white text-slate-900"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm text-slate-700">Alt text (accessibility)</Label>
          <Input
            value={alt}
            onChange={(e) => { setAlt(e.target.value); emit({ alt: e.target.value }); }}
            placeholder="Describe the image for screen readers"
            className="border-slate-300 bg-white text-slate-900"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Display</Label>
        <div className="flex gap-2">
          {(["contained", "full"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => { setDisplay(opt); emit({ display: opt }); }}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                display === opt
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
