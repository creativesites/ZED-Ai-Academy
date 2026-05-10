"use client";

import { useState, useEffect } from "react";
import { Bell, Plus, MoreHorizontal, Loader2, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAnnouncements, postAnnouncement } from "@/actions/classroom";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function NoticeBoardTab({ companyId, isAdminOrInstructor, companySlug }: { companyId: string, isAdminOrInstructor: boolean, companySlug: string }) {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      try {
        const data = await getAnnouncements(companyId);
        setAnnouncements(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
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
      toast.success("Notice posted successfully!");
      setOpen(false);
      // Reload announcements
      const data = await getAnnouncements(companyId);
      setAnnouncements(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to post notice");
    } finally {
      setIsPosting(false);
    }
  }

  function timeAgo(date: string) {
    const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (secs < 60) return "just now";
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return new Date(date).toLocaleDateString();
  }

  return (
    <div className="flex h-full flex-col p-6 bg-slate-50/50">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Notice Board
            <Megaphone className="h-5 w-5 text-[#fd5523]" />
          </h2>
          <p className="text-sm text-slate-500">Important updates and announcements for the class.</p>
        </div>
        
        {isAdminOrInstructor && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={(props) => (
              <Button {...props} className="bg-[#fd5523] text-white hover:bg-[#ef4a16] rounded-xl flex items-center gap-2">
                <Plus className="h-4 w-4" />
                New Post
              </Button>
            )} />
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Post New Announcement</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Title</label>
                  <Input name="title" placeholder="e.g. Welcome to the New Term!" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Content</label>
                  <Textarea name="content" placeholder="Write your announcement here..." rows={5} required />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isPosting} className="w-full bg-[#fd5523] hover:bg-[#ef4a16]">
                    {isPosting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Post Announcement
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p>Loading notices...</p>
          </div>
        ) : (
          <>
            {announcements.map(notice => (
              <div key={notice.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-[#fd5523]/10 text-[#fd5523] flex items-center justify-center font-bold">
                      A
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">Instructor</div>
                      <div className="text-xs text-slate-500">{timeAgo(notice.created_at)}</div>
                    </div>
                  </div>
                </div>
                <h3 className="font-bold text-slate-800 mb-2 text-lg">{notice.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{notice.content}</p>
              </div>
            ))}
            {announcements.length === 0 && (
              <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100">
                <Bell className="mx-auto h-16 w-16 text-slate-100 mb-4" />
                <h3 className="text-lg font-bold text-slate-400">No announcements yet</h3>
                <p className="text-slate-300 text-sm">Check back later for updates from your instructor.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
