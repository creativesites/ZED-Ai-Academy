"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Video } from "lucide-react";

interface MeetingContent {
  meeting_id: string;
  title: string;
  start_time?: string;
}

export function MeetingBlockEditor({
  content,
  onChange,
}: {
  content: MeetingContent;
  onChange: (c: MeetingContent) => void;
}) {
  const [data, setData] = useState<MeetingContent>({
    meeting_id: content.meeting_id ?? "",
    title: content.title ?? "Live Session",
    start_time: content.start_time ?? "",
  });

  function update(patch: Partial<MeetingContent>) {
    const next = { ...data, ...patch };
    setData(next);
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[#062e39] mb-2">
        <Video className="h-4 w-4 text-[#fd5523]" />
        <span className="text-xs font-bold uppercase tracking-widest">Live Meeting Block</span>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Meeting Title</Label>
        <Input
          value={data.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="e.g. Q&A with Senior Retoucher"
          className="border-slate-300 bg-white"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm text-slate-700">Zoom Meeting ID</Label>
          <Input
            value={data.meeting_id}
            onChange={(e) => update({ meeting_id: e.target.value })}
            placeholder="123 4567 8901"
            className="border-slate-300 bg-white"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm text-slate-700">Start Time (Optional)</Label>
          <Input
            value={data.start_time}
            onChange={(e) => update({ start_time: e.target.value })}
            placeholder="e.g. Tomorrow at 10 AM"
            className="border-slate-300 bg-white"
          />
        </div>
      </div>
      
      <p className="text-[10px] text-slate-400 leading-relaxed">
        <strong>Tip:</strong> Users will see a "Join Session" button. Ensure you have the Meeting ID correctly entered.
      </p>
    </div>
  );
}
