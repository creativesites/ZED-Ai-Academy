"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Video, Check } from "lucide-react";

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/embed\/([^?]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

interface VideoBlockContent {
  youtube_id: string;
  title?: string;
}

export function VideoBlockEditor({
  content,
  onChange,
}: {
  content: VideoBlockContent;
  onChange: (c: VideoBlockContent) => void;
}) {
  const [url, setUrl] = useState(
    content.youtube_id ? `https://youtube.com/watch?v=${content.youtube_id}` : ""
  );
  const [title, setTitle] = useState(content.title ?? "");
  const [error, setError] = useState("");

  function handleApply() {
    const id = extractYouTubeId(url.trim());
    if (!id) {
      setError("Please enter a valid YouTube URL");
      return;
    }
    setError("");
    onChange({ youtube_id: id, title: title || undefined });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">YouTube URL</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Video className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-red-500" />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="border-slate-300 bg-white pl-9 text-slate-900 placeholder:text-slate-500"
            />
          </div>
          <Button onClick={handleApply} className="shrink-0 bg-blue-600 text-white hover:bg-blue-500">
            <Check className="h-4 w-4" />
          </Button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Video Title (optional)</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Introduction to Prompt Engineering"
          className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-500"
        />
      </div>

      {content.youtube_id && (
        <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${content.youtube_id}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      )}
    </div>
  );
}

export function VideoBlockPreview({ content }: { content: VideoBlockContent }) {
  if (!content.youtube_id) return null;
  return (
    <div className="space-y-2">
      {content.title && <p className="font-medium text-slate-900">{content.title}</p>}
      <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${content.youtube_id}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
    </div>
  );
}
