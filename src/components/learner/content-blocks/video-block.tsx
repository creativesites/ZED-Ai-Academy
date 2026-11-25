"use client";

import { useEffect, useRef, useState } from "react";
import { Video } from "lucide-react";
import {
  formatSeekTime,
  LESSON_SEEK_EVENT,
  type LessonSeekDetail,
} from "@/lib/tutor/lesson-seek";

export function VideoBlock({
  content,
  blockId,
}: {
  content: Record<string, unknown>;
  blockId?: string;
}) {
  const youtubeId = content.youtube_id as string;
  const title = content.title as string | undefined;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [jumpedTo, setJumpedTo] = useState<number | null>(null);

  useEffect(() => {
    if (!youtubeId) return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<LessonSeekDetail>).detail;
      if (!detail) return;
      if (detail.blockId && blockId && detail.blockId !== blockId) return;

      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

      if (typeof detail.seconds === "number" && Number.isFinite(detail.seconds)) {
        const secs = Math.max(0, Math.floor(detail.seconds));
        setJumpedTo(secs);
        const win = iframeRef.current?.contentWindow;
        if (win) {
          win.postMessage(
            JSON.stringify({ event: "command", func: "seekTo", args: [secs, true] }),
            "*",
          );
          win.postMessage(
            JSON.stringify({ event: "command", func: "playVideo", args: [] }),
            "*",
          );
        }
      }
    };

    window.addEventListener(LESSON_SEEK_EVENT, handler);
    return () => window.removeEventListener(LESSON_SEEK_EVENT, handler);
  }, [youtubeId, blockId]);

  if (!youtubeId) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-100">
        <div className="text-center">
          <Video className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="text-sm font-bold uppercase tracking-widest text-slate-400">
            No video configured
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} data-lesson-block-id={blockId} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {title && <h3 className="text-xl font-bold tracking-tight text-ink">{title}</h3>}
        {jumpedTo !== null && (
          <span
            aria-live="polite"
            className="rounded-full bg-[#eff6ff] px-3 py-1 text-xs font-semibold text-[#1d4ed8]"
          >
            Jumped to {formatSeekTime(jumpedTo)}
          </span>
        )}
      </div>
      <div className="group relative aspect-video overflow-hidden rounded-[2.5rem] bg-black shadow-2xl shadow-black/20 ring-1 ring-white/10">
        <iframe
          ref={iframeRef}
          src={`https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1&autoplay=0&enablejsapi=1`}
          title={title ?? "Video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
    </div>
  );
}
