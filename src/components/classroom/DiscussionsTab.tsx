"use client";

import React, { useState, useEffect, useTransition, useRef } from "react";
import {
  MessageSquare,
  Send,
  Loader2,
  User,
  Hash,
  Paperclip,
  Plus,
  Trash2,
  Pin,
  Download,
  Image as ImageIcon,
  FileText,
  X,
  HelpCircle,
  Sparkles,
  BookOpen,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getClassroomChannels,
  createClassroomChannel,
  getClassroomMessages,
  postClassroomMessage,
  deleteClassroomMessage,
  togglePinClassroomMessage,
  type ClassroomChannel,
  type ClassroomMessage,
} from "@/actions/classroom-discussions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface DiscussionsTabProps {
  companyId: string;
  companySlug: string;
  isAdminOrInstructor: boolean;
  selectedCohortId?: string;
  cohorts?: { id: string; name: string }[];
}

export function DiscussionsTab({
  companyId,
  companySlug,
  isAdminOrInstructor,
  selectedCohortId = "all",
  cohorts = [],
}: DiscussionsTabProps) {
  const [channels, setChannels] = useState<ClassroomChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ClassroomMessage[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [content, setContent] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);

  // New channel modal
  const [isNewChannelOpen, setIsNewChannelOpen] = useState(false);
  const [newChannelTitle, setNewChannelTitle] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const [newChannelCohort, setNewChannelCohort] = useState("all");

  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch Channels
  const fetchChannels = async () => {
    setLoadingChannels(true);
    try {
      const data = await getClassroomChannels(companyId, selectedCohortId);
      setChannels(data);
      if (data.length > 0 && !selectedChannelId) {
        setSelectedChannelId(data[0].id);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load discussion topics");
    } finally {
      setLoadingChannels(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, [companyId, selectedCohortId]);

  // 2. Fetch Messages for active channel
  const fetchMessages = async (channelId: string) => {
    setLoadingMessages(true);
    try {
      const data = await getClassroomMessages(channelId, companyId);
      setMessages(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (!selectedChannelId) return;
    fetchMessages(selectedChannelId);

    // Subscribe to realtime changes for this channel
    const supabase = createClient();
    const realtimeChannel = supabase
      .channel(`classroom-channel-${selectedChannelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "classroom_messages",
          filter: `channel_id=eq.${selectedChannelId}`,
        },
        () => {
          fetchMessages(selectedChannelId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, [selectedChannelId, companyId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const activeChannel = channels.find((c) => c.id === selectedChannelId) || channels[0] || null;

  // Handle Attachment Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error("File is too large (maximum size is 50MB).");
      return;
    }

    setAttachmentFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (re) => setAttachmentPreview(re.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setAttachmentPreview(null);
    }
  };

  const clearAttachment = () => {
    setAttachmentFile(null);
    setAttachmentPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Post Message
  const handlePost = async () => {
    const trimmed = content.trim();
    if ((!trimmed && !attachmentFile) || !selectedChannelId || pending) return;

    const currentText = trimmed;
    const currentFile = attachmentFile;

    // Optimistically reset input
    setContent("");
    clearAttachment();

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("companyId", companyId);
        formData.append("companySlug", companySlug);
        formData.append("channelId", selectedChannelId);
        formData.append("content", currentText);
        if (currentFile) {
          formData.append("file", currentFile);
        }

        await postClassroomMessage(formData);
        await fetchMessages(selectedChannelId);
      } catch (err: any) {
        toast.error(err.message || "Failed to post message");
        setContent(currentText);
        setAttachmentFile(currentFile);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handlePost();
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelTitle.trim()) return;

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("companyId", companyId);
        formData.append("companySlug", companySlug);
        formData.append("displayName", newChannelTitle.trim());
        formData.append("description", newChannelDesc.trim());
        formData.append("cohortId", newChannelCohort);

        const res = await createClassroomChannel(formData);
        toast.success("Topic channel created!");
        setIsNewChannelOpen(false);
        setNewChannelTitle("");
        setNewChannelDesc("");
        await fetchChannels();
        if ((res as any)?.channel?.id) {
          setSelectedChannelId((res as any).channel.id);
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to create channel");
      }
    });
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!confirm("Are you sure you want to delete this message?")) return;
    try {
      await deleteClassroomMessage(msgId, companyId);
      toast.success("Message deleted");
      if (selectedChannelId) fetchMessages(selectedChannelId);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete message");
    }
  };

  const handleTogglePin = async (msgId: string, currentPinned: boolean) => {
    try {
      await togglePinClassroomMessage(msgId, companyId, !currentPinned);
      toast.success(!currentPinned ? "Message pinned" : "Message unpinned");
      if (selectedChannelId) fetchMessages(selectedChannelId);
    } catch (err: any) {
      toast.error(err.message || "Failed to update pin");
    }
  };

  function getChannelIcon(iconName: string) {
    switch (iconName) {
      case "help-circle":
        return HelpCircle;
      case "sparkles":
        return Sparkles;
      case "book-open":
        return BookOpen;
      case "message-square":
      default:
        return Hash;
    }
  }

  function timeAgo(date: string) {
    const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (secs < 60) return "just now";
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return new Date(date).toLocaleDateString([], { month: "short", day: "numeric" });
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col md:flex-row h-[750px] max-h-[85vh]">
      {/* LEFT: Topics & Channels Sidebar */}
      <div className="w-full md:w-72 bg-slate-50/70 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
              Class Discussions
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">Topic channels & forums</p>
          </div>
          {isAdminOrInstructor && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsNewChannelOpen(true)}
              className="h-8 w-8 rounded-xl text-slate-500 hover:text-slate-900"
              title="Add Topic Channel"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Channels List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {loadingChannels ? (
            <div className="py-8 text-center text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-[#fd5523]" />
            </div>
          ) : channels.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-6">No channels available</p>
          ) : (
            channels.map((ch) => {
              const isSelected = ch.id === selectedChannelId;
              const IconComp = getChannelIcon(ch.icon);
              return (
                <button
                  key={ch.id}
                  onClick={() => setSelectedChannelId(ch.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left group",
                    isSelected
                      ? "bg-white text-[#fd5523] shadow-xs ring-1 ring-slate-200"
                      : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
                  )}
                >
                  <IconComp
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isSelected ? "text-[#fd5523]" : "text-slate-400 group-hover:text-slate-600"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black">{ch.display_name}</p>
                    {ch.cohort && (
                      <span className="text-[9px] text-slate-400 block truncate">
                        {ch.cohort.name}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT: Chat Feed & Input */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafc]/50">
        {/* Channel Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-[#fd5523]" />
              <h2 className="text-base font-black text-[#062e39] truncate">
                {activeChannel?.display_name || "Discussions"}
              </h2>
              {activeChannel?.cohort && (
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                  {activeChannel.cohort.name}
                </span>
              )}
            </div>
            {activeChannel?.description && (
              <p className="text-xs text-slate-400 font-medium truncate mt-0.5">
                {activeChannel.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Live Lounge
            </span>
          </div>
        </div>

        {/* Messages Feed */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-6 py-6 space-y-5 scroll-smooth"
        >
          {loadingMessages ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin mb-2 text-[#fd5523]" />
              <p className="text-xs font-bold">Syncing messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16 text-slate-400">
              <div className="h-14 w-14 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center mb-3">
                <MessageSquare className="h-7 w-7 text-slate-300" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">No messages in #{activeChannel?.display_name}</h4>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Start the discussion! Ask questions, share updates, or collaborate on coursework.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isInstructor =
                msg.user?.role === "instructor" ||
                msg.user?.role === "teacher" ||
                msg.user?.role === "company_admin" ||
                msg.user?.role === "super_admin";

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3 group animate-in fade-in slide-in-from-bottom-1 duration-200",
                    msg.is_pinned && "p-3 rounded-2xl bg-amber-50/40 border border-amber-200/60"
                  )}
                >
                  {/* User Avatar */}
                  <div className="h-9 w-9 rounded-xl bg-white border border-slate-100 shadow-xs flex items-center justify-center shrink-0 overflow-hidden mt-0.5">
                    {msg.user?.avatar_url ? (
                      <img src={msg.user.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-4 w-4 text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[#062e39]">
                          {msg.user?.full_name || "Academy Member"}
                        </span>
                        {isInstructor && (
                          <span className="px-1.5 py-0.2 rounded-md bg-[#fd5523]/10 text-[#fd5523] text-[9px] font-black uppercase">
                            Instructor
                          </span>
                        )}
                        {msg.is_pinned && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                            <Pin className="h-2.5 w-2.5" /> Pinned
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-medium">
                          {timeAgo(msg.created_at)}
                        </span>
                      </div>

                      {/* Instructor / Author Actions */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        {isAdminOrInstructor && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleTogglePin(msg.id, msg.is_pinned)}
                            className="h-6 w-6 text-slate-400 hover:text-amber-600 rounded-md"
                            title={msg.is_pinned ? "Unpin message" : "Pin message"}
                          >
                            <Pin className="h-3 w-3" />
                          </Button>
                        )}
                        {(isAdminOrInstructor || true) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="h-6 w-6 text-slate-400 hover:text-red-500 rounded-md"
                            title="Delete message"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Bubble Content */}
                    <div className="bg-white p-3.5 rounded-2xl rounded-tl-none border border-slate-100 shadow-xs inline-block max-w-[90%] space-y-2">
                      <p className="text-xs md:text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>

                      {/* Attachments (Image / PDF / File) */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                          {msg.attachments.map((att, aIdx) => {
                            const isImg =
                              att.type?.startsWith("image/") ||
                              att.url.match(/\.(jpeg|jpg|gif|png|webp)$/i);

                            if (isImg) {
                              return (
                                <a
                                  key={aIdx}
                                  href={att.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block rounded-xl overflow-hidden border border-slate-200 max-w-sm hover:opacity-95 transition-opacity"
                                >
                                  <img
                                    src={att.url}
                                    alt={att.name}
                                    className="max-h-60 w-auto object-cover"
                                  />
                                </a>
                              );
                            }

                            return (
                              <a
                                key={aIdx}
                                href={att.url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all text-xs text-slate-700 font-semibold"
                              >
                                <FileText className="h-4 w-4 text-sky-600 shrink-0" />
                                <span className="truncate flex-1">{att.name}</span>
                                <Download className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Attachment Preview (if staged for upload) */}
        {attachmentFile && (
          <div className="px-6 py-2 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 truncate">
              {attachmentPreview ? (
                <img
                  src={attachmentPreview}
                  alt=""
                  className="h-8 w-8 rounded-lg object-cover border"
                />
              ) : (
                <FileText className="h-5 w-5 text-sky-600" />
              )}
              <span className="truncate max-w-xs">{attachmentFile.name}</span>
              <span className="text-[10px] text-slate-400">
                ({(attachmentFile.size / 1024).toFixed(0)} KB)
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={clearAttachment}
              className="h-6 w-6 text-slate-400 hover:text-red-500 rounded-full"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-4 bg-white border-t border-slate-100 flex items-end gap-2 shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="h-10 w-10 text-slate-400 hover:text-slate-600 rounded-xl shrink-0"
            title="Attach file or screenshot"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${activeChannel?.display_name || "channel"}... (Enter to send)`}
            className="min-h-[44px] max-h-32 text-xs font-medium rounded-xl border-slate-200 focus:border-[#fd5523] resize-none"
            rows={1}
          />

          <Button
            onClick={handlePost}
            disabled={pending || (!content.trim() && !attachmentFile)}
            className="h-10 px-4 bg-[#fd5523] hover:bg-[#e0481d] text-white rounded-xl shadow-md shadow-[#fd5523]/20 shrink-0 gap-1.5"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* MODAL: New Channel */}
      {isNewChannelOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-[#062e39]">Create Discussion Channel</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsNewChannelOpen(false)}
                className="h-7 w-7 rounded-xl text-slate-400"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleCreateChannel} className="space-y-4 pt-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                  Channel Name *
                </label>
                <Input
                  placeholder="e.g. Exam Prep or Final Project Showcase"
                  value={newChannelTitle}
                  onChange={(e) => setNewChannelTitle(e.target.value)}
                  className="rounded-xl font-medium text-xs"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                  Cohort / Class Restriction
                </label>
                <Select value={newChannelCohort} onValueChange={(v: string | null) => setNewChannelCohort(v ?? "all")}>
                  <SelectTrigger className="rounded-xl text-xs font-bold">
                    <SelectValue placeholder="All Cohorts (Institution)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cohorts (Institution)</SelectItem>
                    {cohorts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                  Channel Topic / Description
                </label>
                <Textarea
                  placeholder="What should students and teachers discuss in this room?"
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  className="rounded-xl text-xs font-medium min-h-[70px]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsNewChannelOpen(false)}
                  className="rounded-xl text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={pending}
                  className="bg-[#fd5523] hover:bg-[#e0481d] text-white rounded-xl text-xs font-black"
                >
                  {pending ? "Creating..." : "Create Channel"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
