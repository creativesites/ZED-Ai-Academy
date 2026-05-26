"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { MessageSquare, Send, Globe, Loader2, Sparkles, User, AlertCircle, ChevronDown } from "lucide-react";
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

    const supabase = createClient();
    const channel = supabase
      .channel(`classroom-chat-${companyId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'discussions',
        filter: `company_id=eq.${companyId}`
      }, (payload) => {
        if (!payload.new.lesson_id) {
          fetchMessages();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [discussions]);

  async function handlePost() {
    const trimmed = content.trim();
    if (!trimmed || pending) return;
    
    setContent(""); 
    startTransition(async () => {
      try {
        await postClassroomDiscussion(companyId, companySlug, trimmed);
      } catch (e: any) {
        toast.error(e.message || "Failed to post message");
        setContent(trimmed); 
      }
    });
  }

  function timeAgo(date: string) {
    const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (secs < 60) return "now";
    if (secs < 3600) return `${Math.floor(secs / 60)}m`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
    return new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  return (
    <div className="flex h-[calc(100vh-140px)] lg:h-full flex-col bg-[#f8fafc] overflow-hidden">
      {/* Compact Header */}
      <div className="px-4 lg:px-6 py-3 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
         <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Live Chat</span>
         </div>
         <div className="hidden xs:block text-[9px] font-bold text-slate-300 italic uppercase tracking-tighter">Public Session</div>
      </div>

      {/* Messages List */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto px-4 py-6 lg:p-8 space-y-6 lg:space-y-8 scroll-smooth"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin mb-4 text-[#fd5523]" />
            <p className="text-[9px] font-black uppercase tracking-widest opacity-50">Syncing Messages...</p>
          </div>
        ) : (
          <>
            {[...discussions].reverse().map((msg) => (
              <div key={msg.id} className="flex gap-3 lg:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 group">
                {/* Avatar - Smaller on Mobile */}
                <div className="h-9 w-9 lg:h-12 lg:w-12 rounded-xl lg:rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center shrink-0 overflow-hidden self-start mt-1">
                  {msg.profiles?.avatar_url ? (
                    <img src={msg.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-slate-50 flex items-center justify-center text-slate-300">
                       <User className="h-5 w-5 lg:h-6 lg:w-6" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-baseline gap-2 lg:gap-3">
                    <span className="text-xs lg:text-sm font-black text-[#062e39] truncate">
                      {msg.profiles?.full_name || "Academy Member"}
                    </span>
                    <span className="text-[9px] font-bold text-slate-300 uppercase shrink-0">
                      {timeAgo(msg.created_at)}
                    </span>
                  </div>
                  
                  {/* Bubble - Dynamic radius and width */}
                  <div className="bg-white px-4 py-3 lg:p-5 rounded-2xl lg:rounded-[1.8rem] rounded-tl-none border border-slate-100 shadow-sm inline-block max-w-[95%] lg:max-w-[85%] transition-all">
                    <p className="text-xs lg:text-sm text-slate-600 leading-relaxed whitespace-pre-wrap font-medium break-words">
                      {msg.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {discussions.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-10 lg:py-20">
                <div className="h-16 w-16 lg:h-24 lg:w-24 rounded-[1.5rem] lg:rounded-[2.5rem] bg-white shadow-xl border border-slate-100 flex items-center justify-center mb-6">
                  <MessageSquare className="h-8 w-8 lg:h-12 lg:w-12 text-[#fd5523]/20" />
                </div>
                <h3 className="text-lg lg:text-2xl font-black text-[#062e39]">No Messages</h3>
                <p className="text-slate-400 text-[11px] lg:text-sm max-w-[200px] lg:max-w-xs mt-2 font-medium">
                  Be the first to start the conversation!
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input Area - Thumb Optimized */}
      <div className="p-1 lg:p-4 bg-white border-t border-slate-100 shrink-0">
        <div className="max-w-4xl mx-auto relative group">
          <div className="relative bg-[#f8fafc] rounded-2xl lg:rounded-[2.2rem] border-2 border-slate-100 p-2 lg:p-3 flex items-center gap-2 lg:gap-4 transition-all focus-within:border-[#fd5523]/30 focus-within:bg-white shadow-sm">
            
            {/* Sparkle Icon - Hidden on very small screens */}
            <div className="hidden xs:flex h-10 w-10 lg:h-12 lg:w-12 rounded-xl lg:rounded-2xl bg-white shadow-inner items-center justify-center shrink-0 border border-slate-100 mb-0.5">
              <Sparkles className="h-4 w-4 lg:h-5 lg:w-5 text-[#fd5523]" />
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Message class..."
              rows={1}
              className="flex-1 bg-transparent border-none outline-none text-xs lg:text-sm py-3 px-1 resize-none min-h-[44px] max-h-32 scrollbar-hide font-medium text-[#062e39] placeholder:text-slate-400"
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
              className="h-10 w-10 lg:h-12 lg:w-12 px-4 lg:px-6 rounded-[1.2rem] lg:rounded-2xl bg-[#062e39] hover:bg-[#fd5523] text-white shrink-0 shadow-lg active:scale-95 flex items-center gap-2 group/btn"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 lg:h-5 lg:w-5 animate-spin" />
              ) : (
                <>
                   <span className="text-[10px] font-black uppercase tracking-widest hidden lg:inline">Send</span>
                   <Send className="h-4 w-4 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                </>
              )}
            </Button>
          </div>
          {/* Subtle mobile hint */}
          <div className="mt-2 text-center lg:hidden">
             <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest flex items-center justify-center gap-1">
               Press Enter to send <ChevronDown className="h-2 w-2" />
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}