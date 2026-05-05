"use client";

import { useState, useEffect, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Video, Plus, Loader2, Calendar } from "lucide-react";
import { getInstructorLiveSessionServices, createLiveSessionService } from "@/actions/live-sessions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface MeetingContent {
  meeting_id: string;
  service_id?: string;
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
    service_id: content.service_id ?? "",
    title: content.title ?? "Live Session",
    start_time: content.start_time ?? "",
  });
  const [services, setServices] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, startCreate] = useTransition();

  useEffect(() => {
    async function load() {
      try {
        const s = await getInstructorLiveSessionServices();
        setServices(s || []);
      } catch (err) {
        console.error("Failed to load services", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function update(patch: Partial<MeetingContent>) {
    const next = { ...data, ...patch };
    setData(next);
    onChange(next);
  }

  async function handleQuickCreate() {
    startCreate(async () => {
      try {
        const formData = new FormData();
        formData.append("title", data.title || "Live Session");
        formData.append("duration_minutes", "30");
        
        await createLiveSessionService(formData);
        
        // Refresh list
        const s = await getInstructorLiveSessionServices();
        setServices(s || []);
        
        // Auto-select the newest one
        if (s && s.length > 0) {
          update({ service_id: s[0].id });
          toast.success("Service created and linked!");
        }
      } catch (err) {
        toast.error("Failed to create service");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[#062e39] mb-2">
        <Video className="h-4 w-4 text-[#fd5523]" />
        <span className="text-xs font-bold uppercase tracking-widest">Live Meeting Block</span>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm font-bold text-slate-700">Display Time (Optional)</Label>
          <Input
            value={data.start_time}
            onChange={(e) => update({ start_time: e.target.value })}
            placeholder="e.g. Tomorrow at 10 AM"
            className="border-slate-300 bg-white"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-bold text-slate-700">Zoom Meeting ID (Legacy)</Label>
          <Input
            value={data.meeting_id}
            onChange={(e) => update({ meeting_id: e.target.value })}
            placeholder="123 4567 8901"
            className="border-slate-300 bg-white"
          />
        </div>
      </div>

      <div className="rounded-2xl border-2 border-emerald-100 bg-emerald-50/30 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">Bookable Service</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleQuickCreate}
            disabled={creating}
            className="h-8 text-[10px] font-bold uppercase tracking-widest text-emerald-600 hover:bg-emerald-100"
          >
            {creating ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Plus className="mr-1.5 h-3 w-3" />}
            Quick Create New
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Booking Service</Label>
          {loading ? (
            <div className="h-10 w-full animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <Select 
              value={data.service_id} 
              onValueChange={(v) => update({ service_id: v ?? undefined })}
            >
              <SelectTrigger className="border-slate-200 bg-white">
                <SelectValue placeholder="Choose a service to enable booking..." />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
                {services.length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No services found. Click "Quick Create" to start.
                  </div>
                )}
              </SelectContent>
            </Select>
          )}
        </div>
        
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Linking a <strong>Service ID</strong> enables the calendar booking flow for learners. They will choose a time slot based on your availability rules.
        </p>
      </div>
    </div>
  );
}
