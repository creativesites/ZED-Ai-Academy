"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { MessageSquare, Send, Globe, Loader2, Sparkles, User, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getClassroomDiscussions, postClassroomDiscussion } from "@/actions/classroom-discussions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export function DiscussionsTab({ companyId, companySlug }: { companyId: string, companySlug: string }) {
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      const data = await getClassroomDiscussions(companyId);
      setDiscussions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();

    // Real-time subscription
    const supabase = createClient();
    const channel = supabase
      .channel(`classroom-chat-${companyId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'discussions',
        filter: `company_id=eq.${companyId}`
      }, (payload) => {
        // If it's a classroom level message (lesson_id is null)
        if (!payload.new.lesson_id) {
          fetchMessages(); // Re-fetch to get profile data
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [discussions]);

  async function handlePost() {
    const trimmed = content.trim();
    if (!trimmed || pending) return;
    
    setContent(""); // Optimistic clear
    startTransition(async () => {
      try {
        await postClassroomDiscussion(companyId, companySlug, trimmed);
        // fetchMessages is called by real-time subscription
      } catch (e: any) {
        toast.error(e.message || "Failed to post message");
        setContent(trimmed); // Restore on fail
      }
    });
  }

  function timeAgo(date: string) {
    const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (secs < 60) return "just now";
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return new Date(date).toLocaleDateString();
  }

  return (
    <div className="flex h-full flex-col bg-[#f8fafc]">
      {/* Header Info */}
      <div className="px-6 py-3 bg-white border-b border-slate-100 flex items-center justify-between">
         <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Classroom Live Chat</span>
         </div>
         <div className="text-[10px] font-bold text-slate-300 italic">Messages are public to all members</div>
      </div>

      {/* Messages List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-[#fd5523]" />
            <p className="text-[10px] font-black uppercase tracking-widest">Opening Discussion Board...</p>
          </div>
        ) : (
          <>
            {[...discussions].reverse().map((msg) => (
              <div key={msg.id} className="flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 group">
                <div className="h-12 w-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center font-black shrink-0 overflow-hidden">
                  {msg.profiles?.avatar_url ? (
                    <img src={msg.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center text-slate-300">
                       <User className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-[#062e39]">{msg.profiles?.full_name || "Academy Member"}</span>
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{timeAgo(msg.created_at)}</span>
                  </div>
                  <div className="bg-white p-5 rounded-[1.8rem] rounded-tl-none border border-slate-100 shadow-sm inline-block max-w-[85%] group-hover:border-[#fd5523]/20 transition-all">
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">{msg.content}</p>
                  </div>
                </div>
              </div>
            ))}
            {discussions.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-20 animate-in zoom-in duration-500">
                <div className="h-24 w-24 rounded-[2.5rem] bg-white shadow-xl border border-slate-100 flex items-center justify-center mb-8 rotate-6">
                  <MessageSquare className="h-12 w-12 text-[#fd5523]/20" />
                </div>
                <h3 className="text-2xl font-black text-[#062e39]">No Messages Yet</h3>
                <p className="text-slate-400 text-sm max-w-xs mt-3 font-medium">
                  Be the first to start a conversation with your classmates!
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="p-8 bg-white border-t border-slate-100">
        <div className="max-w-4xl mx-auto relative group">
          <div className="absolute -inset-2 bg-gradient-to-r from-[#fd5523] to-orange-400 rounded-[2.5rem] opacity-0 group-focus-within:opacity-5 blur-xl transition duration-500" />
          <div className="relative bg-[#f8fafc] rounded-[2.2rem] border-2 border-slate-100 p-3 pr-4 flex items-center gap-4 shadow-sm focus-within:border-[#fd5523]/30 focus-within:bg-white transition-all">
            <div className="h-12 w-12 rounded-2xl bg-white shadow-inner flex items-center justify-center shrink-0 border border-slate-100">
              <Sparkles className="h-5 w-5 text-[#fd5523]" />
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type your message to the class..."
              className="flex-1 bg-transparent border-none outline-none text-sm py-3 resize-none h-12 max-h-40 scrollbar-hide font-medium text-[#062e39]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handlePost();
                }
              }}
            />
            <Button 
              onClick={handlePost}
              disabled={pending || !content.trim()}
              className="h-12 px-6 rounded-2xl bg-[#062e39] hover:bg-[#fd5523] text-white shrink-0 shadow-lg transition-all active:scale-95 flex items-center gap-2 group/btn"
            >
              {pending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                   <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">Send</span>
                   <Send className="h-4 w-4 group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
