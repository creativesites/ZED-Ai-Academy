"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  Plus,
  Loader2,
  Megaphone,
  Pin,
  AlertTriangle,
  Calendar,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getAnnouncements,
  postAnnouncement,
  deleteAnnouncement,
  getClassroomGroups,
} from "@/actions/classroom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PRIORITIES = [
  { value: "notice", label: "General Notice", icon: Megaphone, color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "urgent", label: "Urgent Alert", icon: AlertTriangle, color: "bg-red-50 text-red-700 border-red-200" },
  { value: "exam", label: "Exam Notice", icon: Calendar, color: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "event", label: "School Event", icon: Sparkles, color: "bg-purple-50 text-purple-700 border-purple-200" },
];

function getPriorityBadge(priority: string) {
  switch (priority) {
    case "urgent":
      return {
        label: "Urgent Alert",
        icon: AlertTriangle,
        className: "bg-red-500/10 text-red-600 border-red-200",
      };
    case "exam":
      return {
        label: "Exam Notice",
        icon: Calendar,
        className: "bg-amber-500/10 text-amber-700 border-amber-200",
      };
    case "event":
      return {
        label: "Event",
        icon: Sparkles,
        className: "bg-purple-500/10 text-purple-700 border-purple-200",
      };
    default:
      return {
        label: "General Notice",
        icon: Megaphone,
        className: "bg-blue-500/10 text-blue-700 border-blue-200",
      };
  }
}

export function NoticeBoardTab({
  companyId,
  isAdminOrInstructor,
  companySlug,
}: {
  companyId: string;
  isAdminOrInstructor: boolean;
  companySlug: string;
}) {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");

  async function load() {
    try {
      const [data, cohortsData] = await Promise.all([
        getAnnouncements(companyId),
        getClassroomGroups(companyId),
      ]);
      setAnnouncements(data);
      setCohorts(cohortsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [companyId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsPosting(true);
    const formData = new FormData(e.currentTarget);
    formData.append("companyId", companyId);
    formData.append("companySlug", companySlug);

    try {
      await postAnnouncement(formData);
      toast.success("Announcement broadcasted and alerts dispatched to students!");
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to post notice");
    } finally {
      setIsPosting(false);
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete announcement "${title}"?`)) return;
    try {
      await deleteAnnouncement(id, companyId, companySlug);
      toast.success("Announcement deleted");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    }
  }

  function timeAgo(date: string) {
    const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (secs < 60) return "just now";
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return new Date(date).toLocaleDateString();
  }

  const filteredAnnouncements = announcements.filter((a) => {
    if (selectedFilter === "all") return true;
    return a.priority === selectedFilter;
  });

  return (
    <div className="flex h-full flex-col p-6 md:p-8 bg-slate-50/40 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-[#062e39] tracking-tight">
              Class Notice Board
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 font-black text-slate-500">
              {announcements.length}
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">
            Important broadcasts, urgent alerts, exam reminders, and schedule updates.
          </p>
        </div>

        {isAdminOrInstructor && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={(props) => (
              <Button
                {...props}
                className="bg-[#fd5523] text-white hover:bg-[#ef4a16] rounded-xl h-11 px-5 font-bold text-xs uppercase tracking-wider shadow-lg shadow-[#fd5523]/20 flex items-center gap-2"
              >
                <Plus className="h-4 w-4" /> Broadcast Notice
              </Button>
            )} />
            <DialogContent className="sm:max-w-[540px] rounded-3xl p-6">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black text-[#062e39]">
                  Broadcast Announcement
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Notice Title
                  </label>
                  <Input
                    name="title"
                    placeholder="e.g. Exam Timetable Released / Lab Room Shift"
                    required
                    className="h-11 rounded-xl text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Priority Level
                    </label>
                    <Select name="priority" defaultValue="notice">
                      <SelectTrigger className="h-11 rounded-xl text-xs">
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="notice" className="text-xs">General Notice</SelectItem>
                        <SelectItem value="urgent" className="text-xs">🚨 Urgent Alert</SelectItem>
                        <SelectItem value="exam" className="text-xs">📝 Exam Notice</SelectItem>
                        <SelectItem value="event" className="text-xs">🎉 School Event</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {cohorts.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Target Audience
                      </label>
                      <Select name="cohortId" defaultValue="all">
                        <SelectTrigger className="h-11 rounded-xl text-xs">
                          <SelectValue placeholder="Target" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all" className="text-xs">All Students in Academy</SelectItem>
                          {cohorts.map((c) => (
                            <SelectItem key={c.id} value={c.id} className="text-xs">
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Notice Content
                  </label>
                  <Textarea
                    name="content"
                    placeholder="Provide full details. A notification will also be dispatched to students' notification bells..."
                    rows={5}
                    required
                    className="rounded-xl text-xs resize-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input type="checkbox" name="isPinned" value="true" id="pinNotice" className="rounded" />
                  <label htmlFor="pinNotice" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Pin notice to top of board
                  </label>
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="submit"
                    disabled={isPosting}
                    className="w-full bg-[#fd5523] hover:bg-[#ef4a16] text-white font-bold rounded-xl h-12 shadow-lg shadow-[#fd5523]/20"
                  >
                    {isPosting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Broadcast Announcement &amp; Alert Students
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedFilter("all")}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all",
            selectedFilter === "all"
              ? "bg-[#062e39] text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
          )}
        >
          All Notices ({announcements.length})
        </button>
        {PRIORITIES.map((p) => {
          const count = announcements.filter((a) => a.priority === p.value).length;
          return (
            <button
              key={p.value}
              onClick={() => setSelectedFilter(p.value)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                selectedFilter === p.value
                  ? "bg-[#fd5523] text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
              )}
            >
              {p.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Notices List */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-[#fd5523] mb-3" />
            <p className="text-xs font-bold uppercase tracking-widest">Loading notices...</p>
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200 p-8">
            <div className="h-16 w-16 rounded-2xl bg-orange-50 text-[#fd5523] flex items-center justify-center mx-auto mb-4">
              <Bell className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-black text-[#062e39]">No announcements posted</h3>
            <p className="text-xs text-slate-400 font-medium mt-1 max-w-sm mx-auto">
              Check back for updates, room assignments, and academic alerts from your instructors.
            </p>
          </div>
        ) : (
          filteredAnnouncements.map((notice) => {
            const badge = getPriorityBadge(notice.priority);
            const BadgeIcon = badge.icon;
            const isUrgent = notice.priority === "urgent";

            return (
              <div
                key={notice.id}
                className={cn(
                  "bg-white rounded-3xl p-6 border shadow-sm transition-all hover:shadow-md",
                  notice.is_pinned
                    ? "border-amber-300/80 bg-amber-50/20 shadow-amber-500/5"
                    : isUrgent
                    ? "border-red-200 bg-red-50/10"
                    : "border-slate-100"
                )}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border",
                        badge.className
                      )}
                    >
                      <BadgeIcon className="h-3 w-3" />
                      {badge.label}
                    </span>

                    {notice.is_pinned && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                        <Pin className="h-3 w-3 text-amber-700" />
                        Pinned Notice
                      </span>
                    )}

                    {notice.cohort && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                        <Users className="h-2.5 w-2.5" />
                        {notice.cohort.name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">
                      {timeAgo(notice.created_at)}
                    </span>
                    {isAdminOrInstructor && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(notice.id, notice.title)}
                        className="h-8 w-8 text-slate-400 hover:text-red-500 rounded-lg"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <h3 className="text-lg font-black text-[#062e39] tracking-tight mb-2">
                  {notice.title}
                </h3>
                <p className="text-slate-600 text-xs md:text-sm leading-relaxed whitespace-pre-wrap font-medium">
                  {notice.content}
                </p>

                {notice.author && (
                  <div className="mt-4 pt-3 border-t border-slate-100/80 flex items-center gap-2 text-xs text-slate-400 font-semibold">
                    <span>Posted by {notice.author.full_name || "Instructor"}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
