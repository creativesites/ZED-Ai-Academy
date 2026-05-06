"use client";

import { useState, useTransition } from "react";
import { postDiscussion, deleteDiscussion, updateDiscussionStatus } from "@/actions/discussions";
import { 
  MessageSquare, Loader2, Reply, Trash2, Send, Globe, Lock, ShieldCheck, 
  Flag, EyeOff, CheckCircle2, MoreVertical
} from "lucide-react";
import type { Discussion } from "@/types/database";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type DiscussionWithProfile = Discussion & {
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  is_public: boolean;
  status: 'approved' | 'pending' | 'flagged' | 'hidden';
};

function timeAgo(date: string): string {
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function Avatar({ profile, size = "md" }: { profile: DiscussionWithProfile["profiles"]; size?: "sm" | "md" }) {
  const sizeClasses = size === "sm" ? "h-6 w-6 text-[10px]" : "h-9 w-9 text-xs";
  if (profile?.avatar_url) {
    return (
      <img src={profile.avatar_url} alt="" className={cn("rounded-full object-cover shrink-0 ring-2 ring-white", sizeClasses)} />
    );
  }
  return (
    <div className={cn("rounded-full bg-[#fff6ee] text-[#fd5523] font-bold flex items-center justify-center shrink-0 ring-2 ring-white", sizeClasses)}>
      {profile?.full_name?.[0] ?? "?"}
    </div>
  );
}

function DiscussionItem({
  item, courseId, lessonId, userId, depth,
  replies,
  isInstructor = false,
  mini = false,
}: {
  item: DiscussionWithProfile;
  courseId: string;
  lessonId: string;
  userId: string | null;
  depth: number;
  replies: DiscussionWithProfile[];
  isInstructor?: boolean;
  mini?: boolean;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [moderating, startMod] = useTransition();

  function submitReply() {
    if (!replyText.trim()) return;
    setError(null);
    start(async () => {
      try {
        await postDiscussion(courseId, lessonId, replyText, item.id, item.is_public);
        setReplyText("");
        setReplyOpen(false);
        toast.success("Reply posted.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to post reply.");
      }
    });
  }

  function handleStatus(status: 'approved' | 'flagged' | 'hidden') {
    startMod(async () => {
      try {
        await updateDiscussionStatus(item.id, courseId, status);
        toast.success(`Post marked as ${status}.`);
      } catch (e) {
        toast.error("Failed to update status.");
      }
    });
  }

  function handleDelete() {
    if (!confirm("Are you sure you want to delete this?")) return;
    startMod(async () => {
      try {
        await deleteDiscussion(item.id, courseId);
        toast.success("Post deleted.");
      } catch (e) {
        toast.error("Failed to delete.");
      }
    });
  }

  if (mini) {
    return (
      <div className="group">
        <div className="flex gap-3">
          <Avatar profile={item.profiles} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold text-[#062e39] truncate">{item.profiles?.full_name || "Member"}</span>
              <span className="text-[10px] text-slate-300">{timeAgo(item.created_at)}</span>
              {!item.is_public && <Lock className="h-2.5 w-2.5 text-slate-300" />}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{item.content}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("animate-in fade-in slide-in-from-left-2 duration-300", depth > 0 && "ml-10 pl-6 border-l-2 border-slate-50 mt-4")}>
      <div className="flex gap-4">
        <Avatar profile={item.profiles} />
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-[#062e39]">{item.profiles?.full_name ?? "Anonymous"}</span>
              <span className="text-xs text-slate-300 font-medium">{timeAgo(item.created_at)}</span>
              {item.is_public ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                  <Globe className="h-2.5 w-2.5" /> Public
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#fd5523] bg-[#fd5523]/5 px-2 py-0.5 rounded-full">
                  <Lock className="h-2.5 w-2.5" /> Private
                </span>
              )}
              {isInstructor && (
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                  item.status === 'approved' ? "text-green-600 bg-green-50" : 
                  item.status === 'flagged' ? "text-amber-600 bg-amber-50" : 
                  "text-slate-400 bg-slate-100"
                )}>
                  {item.status}
                </span>
              )}
            </div>

            {(isInstructor || userId === item.user_id) && (
              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <button className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-400">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                } />
                <DropdownMenuContent align="end" className="w-48 rounded-xl p-1">
                  {isInstructor && (
                    <>
                      <DropdownMenuItem onClick={() => handleStatus('approved')} className="rounded-lg gap-2 text-green-600">
                        <CheckCircle2 className="h-4 w-4" /> Approve
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatus('flagged')} className="rounded-lg gap-2 text-amber-600">
                        <Flag className="h-4 w-4" /> Flag
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatus('hidden')} className="rounded-lg gap-2 text-slate-600">
                        <EyeOff className="h-4 w-4" /> Hide
                      </DropdownMenuItem>
                      <div className="h-px bg-slate-100 my-1" />
                    </>
                  )}
                  <DropdownMenuItem onClick={handleDelete} className="rounded-lg gap-2 text-red-600">
                    <Trash2 className="h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          
          <p className="text-sm text-slate-600 leading-relaxed mb-3 whitespace-pre-wrap">
            {item.content}
          </p>
          
          <div className="flex items-center gap-4">
            {depth < 2 && (
              <button
                onClick={() => setReplyOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#fd5523] hover:underline"
              >
                <Reply className="h-3.5 w-3.5" />
                Reply
              </button>
            )}
          </div>

          {replyOpen && (
            <div className="mt-4 animate-in zoom-in-95 duration-200">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply…"
                rows={2}
                className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 text-sm focus:bg-white focus:border-[#fd5523]/30 transition-all outline-none"
              />
              {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
              <div className="flex gap-3 mt-2">
                <button
                  onClick={submitReply}
                  disabled={pending || !replyText.trim()}
                  className="px-5 py-2 rounded-full bg-[#fd5523] text-white text-xs font-bold hover:bg-[#ef4a16] disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {pending && <Loader2 className="h-3 w-3 animate-spin" />}
                  Post Reply
                </button>
                <button
                  onClick={() => setReplyOpen(false)}
                  className="px-5 py-2 rounded-full bg-slate-100 text-slate-500 text-xs font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {replies.length > 0 && (
        <div className="space-y-4">
          {replies.map((reply) => (
            <DiscussionItem
              key={reply.id}
              item={reply}
              courseId={courseId}
              lessonId={lessonId}
              userId={userId}
              depth={depth + 1}
              replies={[]}
              isInstructor={isInstructor}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function LessonDiscussions({
  courseId,
  lessonId,
  discussions,
  userId,
  isInstructor = false,
  mini = false,
}: {
  courseId: string;
  lessonId: string;
  discussions: DiscussionWithProfile[];
  userId: string | null;
  isInstructor?: boolean;
  mini?: boolean;
}) {
  const [content, setContent] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const topLevel = discussions.filter((d) => !d.parent_id);
  const getReplies = (parentId: string) => discussions.filter((d) => d.parent_id === parentId);

  function submit() {
    if (!content.trim()) return;
    setError(null);
    start(async () => {
      try {
        await postDiscussion(courseId, lessonId, content, undefined, isPublic);
        setContent("");
        toast.success(isPublic ? "Discussion posted." : "Private question sent to tutor.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to post.");
      }
    });
  }

  if (mini) {
    return (
      <div className="space-y-6">
        {topLevel.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-4">No discussions yet.</p>
        ) : (
          <div className="space-y-6">
            {topLevel.slice(0, 3).map((item) => (
              <DiscussionItem
                key={item.id}
                item={item}
                courseId={courseId}
                lessonId={lessonId}
                userId={userId}
                depth={0}
                replies={[]}
                isInstructor={isInstructor}
                mini
              />
            ))}
          </div>
        )}
        {userId && (
          <div className="relative mt-4">
             <input 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={isPublic ? "Join discussion..." : "Ask tutor privately..."}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs focus:bg-white focus:ring-2 focus:ring-[#fd5523]/20 outline-none pr-20"
              onKeyDown={(e) => e.key === 'Enter' && submit()}
             />
             <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
               <button 
                onClick={() => setIsPublic(!isPublic)}
                className={cn("p-1.5 rounded-md transition-colors", isPublic ? "text-slate-300" : "text-[#fd5523] bg-[#fd5523]/10")}
                title={isPublic ? "Make Private" : "Make Public"}
               >
                 {isPublic ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
               </button>
               <button 
                onClick={submit}
                disabled={pending || !content.trim()}
                className="text-[#fd5523] disabled:opacity-30 p-1.5"
               >
                 {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
               </button>
             </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-[#fff6ee] flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-[#fd5523]" />
          </div>
          <h3 className="text-lg font-bold text-[#062e39]">
            Discussions <span className="text-slate-300 ml-1">({discussions.length})</span>
          </h3>
        </div>
        {isInstructor && (
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <ShieldCheck className="h-4 w-4 text-green-500" /> Moderation Active
          </div>
        )}
      </div>

      {/* Compose */}
      {userId && (
        <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 p-8 shadow-sm">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={isPublic ? "Ask a question or share your insight..." : "Ask the tutor a private question..."}
            rows={3}
            className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-5 text-sm leading-relaxed focus:bg-white focus:border-[#fd5523]/30 transition-all outline-none resize-none"
          />
          {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
          
          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center gap-6">
              <button 
                onClick={() => setIsPublic(true)}
                className={cn(
                  "flex items-center gap-2 text-xs font-bold transition-colors",
                  isPublic ? "text-[#fd5523]" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <div className={cn("h-4 w-4 rounded-full border-2 flex items-center justify-center", isPublic ? "border-[#fd5523]" : "border-slate-300")}>
                  {isPublic && <div className="h-2 w-2 rounded-full bg-[#fd5523]" />}
                </div>
                Public Discussion
              </button>
              <button 
                onClick={() => setIsPublic(false)}
                className={cn(
                  "flex items-center gap-2 text-xs font-bold transition-colors",
                  !isPublic ? "text-[#fd5523]" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <div className={cn("h-4 w-4 rounded-full border-2 flex items-center justify-center", !isPublic ? "border-[#fd5523]" : "border-slate-300")}>
                  {!isPublic && <div className="h-2 w-2 rounded-full bg-[#fd5523]" />}
                </div>
                Private to Tutor
              </button>
            </div>

            <button
              onClick={submit}
              disabled={pending || !content.trim()}
              className={cn(
                "px-8 py-3 rounded-full text-white font-bold text-sm shadow-lg shadow-[#fd5523]/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-2",
                content.trim() ? "bg-[#fd5523] hover:bg-[#ef4a16]" : "bg-slate-200 cursor-not-allowed"
              )}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isPublic ? "Post Publicly" : "Send Privately"}
            </button>
          </div>
        </div>
      )}

      {/* Thread list */}
      {topLevel.length === 0 ? (
        <div className="py-20 text-center bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-100">
           <MessageSquare className="h-16 w-16 text-slate-100 mx-auto mb-4" />
           <p className="text-slate-400 font-medium">No discussions here yet.</p>
           <p className="text-xs text-slate-300 mt-1">Be the first to ask a question!</p>
        </div>
      ) : (
        <div className="space-y-12">
          {topLevel.map((item) => (
            <div key={item.id} className="pb-12 border-b border-slate-50 last:border-0 last:pb-0">
              <DiscussionItem
                item={item}
                courseId={courseId}
                lessonId={lessonId}
                userId={userId}
                depth={0}
                replies={getReplies(item.id)}
                isInstructor={isInstructor}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
