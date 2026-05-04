"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import { postComment, getComments, deleteComment } from "@/actions/blog";
import {
  MessageSquare,
  Loader2,
  Reply,
  Trash2,
  Send,
  User,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  X,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────── */

interface Comment {
  id: string;
  content: string;
  created_at: string;
  name: string | null;
  email: string | null;
  user_id: string | null;
  parent_id: string | null;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

type FeedbackState = {
  type: "success" | "error" | "idle";
  message: string;
};

/* ── Main Component ────────────────────────────────────── */

export function BlogComments({
  postId,
  userId,
  userName,
}: {
  postId: string;
  userId: string | null;
  userName?: string | null;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>({ type: "idle", message: "" });
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const reloadComments = useCallback(async () => {
    const data = await getComments(postId);
    setComments(data as Comment[]);
  }, [postId]);

  useEffect(() => {
    reloadComments().then(() => setLoading(false));
  }, [reloadComments]);

  // Auto-clear feedback after 5s
  useEffect(() => {
    if (feedback.type !== "idle") {
      const t = setTimeout(() => setFeedback({ type: "idle", message: "" }), 5000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  function handleReply(commentId: string) {
    setReplyTo(commentId);
    textareaRef.current?.focus();
    textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    // Client-side validation for guests
    if (!userId) {
      if (!name.trim() || name.trim().length < 2) {
        setFeedback({ type: "error", message: "Please enter your name (at least 2 characters)." });
        return;
      }
      if (!email.trim() || !email.includes("@")) {
        setFeedback({ type: "error", message: "Please enter a valid email address." });
        return;
      }
    }
    if (content.trim().length < 3) {
      setFeedback({ type: "error", message: "Your comment is too short." });
      return;
    }

    startTransition(async () => {
      try {
        await postComment(
          postId,
          content,
          replyTo || undefined,
          userId ? undefined : name.trim(),
          userId ? undefined : email.trim()
        );
        setContent("");
        setReplyTo(null);
        setFeedback({
          type: "success",
          message: replyTo ? "Your reply has been posted!" : "Your comment has been posted!",
        });
        await reloadComments();
      } catch (err: any) {
        setFeedback({
          type: "error",
          message: err?.message || "Something went wrong. Please try again.",
        });
      }
    });
  }

  const topLevel = comments.filter((c) => !c.parent_id);
  const getReplies = (id: string) => comments.filter((c) => c.parent_id === id);
  const replyingToComment = replyTo ? comments.find((c) => c.id === replyTo) : null;

  /* ── Loading state ──────────────────────────────── */
  if (loading)
    return (
      <div className="py-24 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#fd5523] mx-auto mb-4" />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-300">
          Loading community…
        </p>
      </div>
    );

  return (
    <div className="blog-comments mt-20 pt-16 border-t border-slate-100">
      {/* ── Header ──────────────────────────────────── */}
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-[#fff2e9] flex items-center justify-center">
            <MessageSquare className="h-6 w-6 text-[#fd5523]" />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-[#062e39] tracking-tight">
              Community{" "}
              <span className="text-slate-300 ml-1 text-2xl">({comments.length})</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Join the conversation</p>
          </div>
        </div>
      </div>

      {/* ── Feedback Toast ──────────────────────────── */}
      {feedback.type !== "idle" && (
        <div
          className={`flex items-center gap-3 px-6 py-4 rounded-2xl mb-8 animate-in slide-in-from-top-4 duration-300 ${
            feedback.type === "success"
              ? "bg-green-50 text-green-700 border border-green-100"
              : "bg-red-50 text-red-700 border border-red-100"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0" />
          )}
          <p className="text-sm font-semibold flex-1">{feedback.message}</p>
          <button
            onClick={() => setFeedback({ type: "idle", message: "" })}
            className="shrink-0 text-current opacity-50 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Comment Form ────────────────────────────── */}
      <div className="bg-[#fffbf8] rounded-[2.5rem] border-2 border-[#fd5523]/5 p-8 sm:p-10 mb-16 shadow-sm">
        {/* Reply indicator */}
        {replyingToComment && (
          <div className="flex items-start gap-3 mb-6 p-4 rounded-2xl bg-white border border-slate-100">
            <Reply className="h-4 w-4 text-[#fd5523] mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black uppercase tracking-widest text-[#fd5523] mb-1">
                Replying to {replyingToComment.profiles?.full_name || replyingToComment.name || "someone"}
              </p>
              <p className="text-sm text-slate-400 truncate">&ldquo;{replyingToComment.content.slice(0, 100)}&rdquo;</p>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {!replyingToComment && (
          <>
            <h3 className="text-xl font-bold text-[#062e39] mb-1">Share your thoughts</h3>
            <p className="text-sm text-slate-400 mb-8">
              {userId
                ? `Posting as ${userName || "a signed-in member"} — your name will appear automatically.`
                : "Join the conversation with other AI learners in Zambia."}
            </p>
          </>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
          {/* Guest fields — hidden for logged-in users */}
          {!userId && (
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 ml-1">
                  Your Name <span className="text-red-400">*</span>
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  required
                  minLength={2}
                  className="w-full h-12 rounded-2xl border-2 border-white bg-white px-5 text-sm text-[#062e39] placeholder:text-slate-300 focus:border-[#fd5523]/20 focus:outline-none focus:ring-4 focus:ring-[#fd5523]/5 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 ml-1">
                  Email <span className="text-red-400">*</span>
                  <span className="normal-case tracking-normal ml-1 text-slate-300">(not published)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full h-12 rounded-2xl border-2 border-white bg-white px-5 text-sm text-[#062e39] placeholder:text-slate-300 focus:border-[#fd5523]/20 focus:outline-none focus:ring-4 focus:ring-[#fd5523]/5 transition-all"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 ml-1">
              {replyTo ? "Your Reply" : "Comment"}
            </label>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={replyTo ? "Write your reply…" : "Share something helpful or ask a question…"}
              rows={4}
              required
              minLength={3}
              maxLength={2000}
              className="w-full rounded-3xl border-2 border-white bg-white p-6 text-sm leading-relaxed text-[#062e39] placeholder:text-slate-300 focus:border-[#fd5523]/20 focus:outline-none focus:ring-4 focus:ring-[#fd5523]/5 transition-all resize-none"
            />
            <div className="flex items-center justify-between px-2">
              <p className="text-[10px] text-slate-300">
                {content.length > 0 && `${content.length} / 2000`}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            {replyTo && (
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="px-6 py-3 rounded-full text-xs font-bold text-slate-400 hover:text-red-500 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={pending || !content.trim()}
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full bg-[#fd5523] text-white font-bold text-sm shadow-xl shadow-[#fd5523]/20 hover:bg-[#ef4a16] disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-[1.03] active:scale-95"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {replyTo ? "Post Reply" : "Post Comment"}
            </button>
          </div>
        </form>
      </div>

      {/* ── Comment List ────────────────────────────── */}
      <div className="space-y-8">
        {topLevel.length === 0 ? (
          <div className="py-20 text-center bg-slate-50/60 rounded-[3rem] border-2 border-dashed border-slate-200/80">
            <MessageSquare className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-2">
              No comments yet
            </p>
            <p className="text-sm text-slate-300">Be the first to share your thoughts!</p>
          </div>
        ) : (
          topLevel.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              replies={getReplies(comment.id)}
              onReply={handleReply}
              userId={userId}
              onDelete={async (id) => {
                try {
                  await deleteComment(id);
                  setFeedback({ type: "success", message: "Comment deleted." });
                  await reloadComments();
                } catch {
                  setFeedback({ type: "error", message: "Failed to delete comment." });
                }
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ── Single Comment ────────────────────────────────────── */

function CommentItem({
  comment,
  replies,
  onReply,
  userId,
  onDelete,
}: {
  comment: Comment;
  replies: Comment[];
  onReply: (id: string) => void;
  userId: string | null;
  onDelete: (id: string) => Promise<void>;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const displayName = comment.profiles?.full_name || comment.name || "Community Member";
  const initial = displayName[0]?.toUpperCase() || "?";
  const isAuthor = userId && userId === comment.user_id;

  const timeAgo = getRelativeTime(comment.created_at);

  return (
    <div className="group animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex gap-5">
        {/* Avatar */}
        <div className="shrink-0">
          {comment.profiles?.avatar_url ? (
            <img
              src={comment.profiles.avatar_url}
              alt={displayName}
              className="h-12 w-12 rounded-2xl object-cover ring-4 ring-[#fff2e9]"
            />
          ) : (
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#fff2e9] to-[#fde3d5] flex items-center justify-center text-[#fd5523] font-black text-lg ring-4 ring-slate-50">
              {initial}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          {/* Meta row */}
          <div className="flex items-center gap-3 mb-2">
            <h4 className="font-extrabold text-[#062e39] text-[15px]">{displayName}</h4>
            {comment.user_id && (
              <span className="px-2 py-0.5 rounded-md bg-[#fff2e9] text-[#fd5523] text-[9px] font-black uppercase tracking-widest">
                Member
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-slate-300 ml-auto">
              <Clock className="h-3 w-3" />
              {timeAgo}
            </span>
          </div>

          {/* Content */}
          <p className="text-[15px] text-slate-600 leading-relaxed mb-4 whitespace-pre-wrap">
            {comment.content}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onReply(comment.id)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider hover:bg-[#fd5523] hover:text-white transition-all"
            >
              <Reply className="h-3.5 w-3.5" />
              Reply
            </button>
            {replies.length > 0 && (
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-slate-400 text-[11px] font-bold uppercase tracking-wider hover:text-[#062e39] transition-colors"
              >
                {showReplies ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {replies.length} {replies.length === 1 ? "reply" : "replies"}
              </button>
            )}
            {isAuthor && (
              <button
                onClick={async () => {
                  if (!confirm("Delete this comment?")) return;
                  setIsDeleting(true);
                  await onDelete(comment.id);
                }}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-slate-300 text-[11px] font-bold uppercase tracking-wider hover:text-red-500 hover:bg-red-50 transition-all ml-auto"
              >
                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete
              </button>
            )}
          </div>

          {/* Replies */}
          {showReplies && replies.length > 0 && (
            <div className="mt-6 space-y-6 border-l-2 border-slate-100 pl-6 ml-2">
              {replies.map((reply) => {
                const rName = reply.profiles?.full_name || reply.name || "Community Member";
                const rInitial = rName[0]?.toUpperCase() || "?";
                const rIsAuthor = userId && userId === reply.user_id;

                return (
                  <div key={reply.id} className="flex gap-4 animate-in fade-in duration-300">
                    <div className="shrink-0">
                      {reply.profiles?.avatar_url ? (
                        <img
                          src={reply.profiles.avatar_url}
                          alt={rName}
                          className="h-9 w-9 rounded-xl object-cover ring-2 ring-white"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-xl bg-slate-50 flex items-center justify-center text-[#fd5523] font-bold text-xs ring-2 ring-white">
                          {rInitial}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="text-sm font-extrabold text-[#062e39]">{rName}</h5>
                        {reply.user_id && (
                          <span className="px-1.5 py-0.5 rounded bg-[#fff2e9] text-[#fd5523] text-[8px] font-black uppercase tracking-widest">
                            Member
                          </span>
                        )}
                        <span className="text-[10px] text-slate-300 ml-auto">
                          {getRelativeTime(reply.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 leading-relaxed whitespace-pre-wrap">
                        {reply.content}
                      </p>
                      {rIsAuthor && (
                        <button
                          onClick={async () => {
                            if (!confirm("Delete this reply?")) return;
                            await onDelete(reply.id);
                          }}
                          className="text-[10px] font-bold text-slate-300 hover:text-red-500 mt-2 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-100 mt-8" />
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────── */

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(dateStr).toLocaleDateString("en-ZM", { dateStyle: "medium" });
}
