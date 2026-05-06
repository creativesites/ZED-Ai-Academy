"use client";

import { Video } from "lucide-react";

export function VideoBlock({ content }: { content: Record<string, unknown> }) {
  const youtubeId = content.youtube_id as string;
  const title = content.title as string | undefined;
  
  if (!youtubeId) return (
    <div className="flex aspect-video items-center justify-center rounded-3xl bg-slate-100 border-2 border-dashed border-slate-200">
      <div className="text-center">
        <Video className="mx-auto mb-3 h-12 w-12 text-slate-300" />
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No video configured</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {title && <h3 className="text-xl font-bold text-[#062e39] tracking-tight">{title}</h3>}
      <div className="group relative aspect-video overflow-hidden rounded-[2.5rem] bg-black shadow-2xl shadow-black/20 ring-1 ring-white/10">
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1&autoplay=0`}
          title={title ?? "Video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
    </div>
  );
}
