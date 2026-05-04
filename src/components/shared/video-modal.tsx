"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
  channel?: "youtube" | "vimeo";
}

export default function VideoModal({ isOpen, onClose, videoId, channel = "youtube" }: VideoModalProps) {
  const videoUrl = channel === "youtube" 
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`
    : `https://player.vimeo.com/video/${videoId}?autoplay=1`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        showCloseButton={false}
        className="max-w-5xl p-0 bg-black border-none overflow-hidden aspect-video shadow-2xl rounded-2xl"
      >
        <DialogTitle className="sr-only">Video Player</DialogTitle>
        <button 
          onClick={onClose}
          className="absolute -top-10 right-0 md:-right-10 text-white hover:text-[#fd5523] transition-all hover:scale-110 p-2 z-[60] bg-black/20 rounded-full backdrop-blur-sm"
          aria-label="Close video"
        >
          <X className="h-8 w-8" />
        </button>
        {isOpen && (
          <iframe
            src={videoUrl}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title="Video Player"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
