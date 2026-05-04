"use client";

import { useState, useTransition } from "react";
import { postDiscussion, deleteDiscussion } from "@/actions/discussions";
import { MessageSquare, Loader2, Reply, Trash2, Send } from "lucide-react";
import type { Discussion } from "@/types/database";
import { cn } from "@/lib/utils";

type DiscussionWithProfile = Discussion & {
  profiles: { full_name: string | null; avatar_url: string | null } | null;
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
      // eslint-disable-next-line @next/next/no-img-element
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
  mini = false,
}: {
  item: DiscussionWithProfile;
  courseId: string;
  lessonId: string;
  userId: string | null;
  depth: number;
  replies: DiscussionWithProfile[];
  mini?: boolean;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  function submitReply() {
    if (!replyText.trim()) return;
    setError(null);
    start(async () => {
      try {
        await postDiscussion(courseId, lessonId, replyText, item.id);
        setReplyText("");
        setReplyOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to post reply.");
      }
    });
  }

  function handleDelete() {
    startDelete(async () => {
      await deleteDiscussion(item.id, courseId);
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
          <div className="flex items-center gap-3 mb-1">
            <span className="text-sm font-bold text-[#062e39]">{item.profiles?.full_name ?? "Anonymous"}</span>
            <span className="text-xs text-slate-300 font-medium">{timeAgo(item.created_at)}</span>
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
            {userId === item.user_id && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-red-500 transition-colors"
              >
                {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Delete
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
                  className="px-5 py-2 rounded-full bg-[#fd5523] text-white text-xs font-bold hover:bg-[#ef4a16] disabled:opacity-50 transition-all"
                >
                  {pending ? "Posting…" : "Post Reply"}
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

      {/* Nested replies */}
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
  mini = false,
}: {
  courseId: string;
  lessonId: string;
  discussions: DiscussionWithProfile[];
  userId: string | null;
  mini?: boolean;
}) {
  const [content, setContent] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const topLevel = discussions.filter((d) => !d.parent_id);
  const getReplies = (parentId: string) => discussions.filter((d) => d.parent_id === parentId);

  function submit() {
    if (!content.trim()) return;
    setError(null);
    start(async () => {
      try {
        await postDiscussion(courseId, lessonId, content);
        setContent("");
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
              placeholder="Join discussion..."
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs focus:bg-white focus:ring-2 focus:ring-[#fd5523]/20 outline-none pr-10"
              onKeyDown={(e) => e.key === 'Enter' && submit()}
             />
             <button 
              onClick={submit}
              disabled={pending || !content.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#fd5523] disabled:opacity-30"
             >
               {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
             </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-[#fff6ee] flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-[#fd5523]" />
          </div>
          <h3 className="text-lg font-bold text-[#062e39]">
            Discussions <span className="text-slate-300 ml-1">({discussions.length})</span>
          </h3>
        </div>
      </div>

      {/* Compose */}
      {userId && (
        <div className="bg-[#fffbf8] rounded-[2rem] border-2 border-[#fd5523]/5 p-6 shadow-sm">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Ask a question or share your insight about this lesson…"
            rows={3}
            className="w-full rounded-2xl border-2 border-slate-100 bg-white p-5 text-sm leading-relaxed focus:border-[#fd5523]/30 transition-all outline-none resize-none"
          />
          {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
          <div className="flex justify-end mt-4">
            <button
              onClick={submit}
              disabled={pending || !content.trim()}
              className={cn(
                "px-8 py-3 rounded-full text-white font-bold text-sm shadow-lg shadow-[#fd5523]/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-2",
                content.trim() ? "bg-[#fd5523] hover:bg-[#ef4a16]" : "bg-slate-200 cursor-not-allowed"
              )}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Post Comment
            </button>
          </div>
        </div>
      )}

      {/* Thread list */}
      {topLevel.length === 0 ? (
        <div className="py-12 text-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-100">
           <MessageSquare className="h-12 w-12 text-slate-200 mx-auto mb-4" />
           <p className="text-slate-400 font-medium">No discussions yet. Start the conversation!</p>
        </div>
      ) : (
        <div className="space-y-10">
          {topLevel.map((item) => (
            <div key={item.id} className="pb-10 border-b border-slate-50 last:border-0 last:pb-0">
              <DiscussionItem
                item={item}
                courseId={courseId}
                lessonId={lessonId}
                userId={userId}
                depth={0}
                replies={getReplies(item.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
