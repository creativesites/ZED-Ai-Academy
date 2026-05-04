"use client";

import { useMemo, useState, useRef, useEffect, useTransition } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { 
  Bot, Briefcase, Compass, GraduationCap, Sparkles, X, 
  Send, Loader2, Maximize2, Minimize2, Trash2, 
  ChevronRight, Info, Zap
} from "lucide-react";
import { MessageContent } from "@/components/learner/chat-components/MessageContent";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; content: string };

type Suggestion = {
  label: string;
  body: string;
  prompt: string;
};

const MARKETING_SUGGESTIONS: Suggestion[] = [
  {
    label: "Explore Curriculum",
    body: "What AI courses do you have?",
    prompt: "I want to see all your available AI courses. Show me the full curriculum.",
  },
  {
    label: "AI for Business",
    body: "How can AI help my Zambian business?",
    prompt: "I run a business in Zambia. How can AI help me optimize my workflows, save time, and grow using tools like Midjourney or automation?",
  },
  {
    label: "Career Growth",
    body: "Which path should I take?",
    prompt: "I want to upskill in AI to advance my career. Which learning path do you recommend for the highest impact?",
  },
];

const CREATOR_SUGGESTIONS: Suggestion[] = [
  {
    label: "Lesson Blueprint",
    body: "Help me design a lesson",
    prompt: "I want to create a high-impact AI lesson. Help me design a blueprint with a clear 'first-win' outcome and practical steps.",
  },
  {
    label: "Outcome Optimization",
    body: "Improve my course goal",
    prompt: "I've drafted a course outcome. Can you help me make it more specific, measurable, and professional for the Zambian market?",
  },
];

const LEARNER_SUGGESTIONS: Suggestion[] = [
  {
    label: "Apply to Work",
    body: "Turn this into a workflow",
    prompt: "I just finished a lesson. Help me turn what I learned into a step-by-step workflow I can apply at my job tomorrow morning.",
  },
  {
    label: "Deep Dive",
    body: "Explain this further",
    prompt: "Can you explain the core concepts of this module in more detail and give me a few real-world examples of how they are used?",
  },
];

function getContext(pathname: string) {
  if (pathname.startsWith("/creator")) {
    return {
      icon: Briefcase,
      eyebrow: "Studio Intelligence",
      title: "Creator Support Active",
      description: "Ask me to help shape lessons, refine outcomes, or build your curriculum.",
      suggestions: CREATOR_SUGGESTIONS,
      color: "from-amber-500 to-orange-600",
      accent: "text-amber-600",
    };
  }

  if (pathname.includes("/learn") || pathname.startsWith("/dashboard")) {
    return {
      icon: GraduationCap,
      eyebrow: "Learning Intelligence",
      title: "Coach Active",
      description: "Ask me to explain concepts, build workflows, or critique your work.",
      suggestions: LEARNER_SUGGESTIONS,
      color: "from-[#fd5523] to-[#ef4a16]",
      accent: "text-[#fd5523]",
    };
  }

  return {
    icon: Compass,
    eyebrow: "Site Intelligence",
    title: "Zed Guide Active",
    description: "Ask me about courses, career paths, or how to get started with AI.",
    suggestions: MARKETING_SUGGESTIONS,
    color: "from-blue-600 to-indigo-700",
    accent: "text-blue-600",
  };
}

export function SiteIntelligenceDock() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const context = useMemo(() => getContext(pathname), [pathname]);
  const Icon = context.icon;

  useEffect(() => {
    if (messages.length === 0) {
      let initialMessage = "";
      if (pathname.startsWith("/creator")) {
        initialMessage = "Ready to build something world-class? I'm here to help you design high-impact AI lessons, refine your curriculum, or optimize student outcomes. What's on your mind today?";
      } else if (pathname.includes("/learn") || pathname.startsWith("/dashboard")) {
        initialMessage = "Hey there! I'm your AI learning coach. Whether you're stuck on a concept or want to turn today's lesson into a real-world workflow, I've got your back. What can we master today?";
      } else {
        initialMessage = "Welcome to Zed AI Academy! I'm **Zed Intelligence**, your guide to the future of skills. I can help you find the perfect course, explain how AI transforms businesses, or map out your learning path. Where should we begin?";
      }

      setMessages([
        {
          role: "assistant",
          content: initialMessage,
        },
      ]);
    }
  }, [messages.length, pathname]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isMinimized]);

  async function sendMessage(text: string) {
    if (!text.trim() || isStreaming) return;
    
    const userMessage = text.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsStreaming(true);
    setIsMinimized(false);

    try {
      const response = await fetch("/api/ai/site-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: userMessage, 
          pathname,
          history: messages.slice(-5) // Send some context
        }),
      });

      if (!response.ok || !response.body) throw new Error("Failed to get response");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last) {
            next[next.length - 1] = { ...last, content: last.content + chunk };
          }
          return next;
        });
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "I'm sorry, I encountered an error. Please try again." 
      }]);
    } finally {
      setIsStreaming(false);
      textareaRef.current?.focus();
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: "assistant",
        content: `Hi! I'm **Zed Intelligence**. ${context.description}`,
      },
    ]);
  };

  // ── Render Closed State ──────────────────────────────────────────────
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-[9999] flex h-14 w-14 rounded-full items-center justify-center  shadow-2xl transition-all hover:scale-110 active:scale-95 bg-gradient-to-br",
          context.color
        )}
        style={{ borderRadius: "50%" }}
      >
        <Bot className="h-7 w-7 text-white" />
        <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white bg-green-500 animate-pulse" />
      </button>
    );
  }

  // ── Render Minimized State ───────────────────────────────────────────
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 z-[9999] flex w-72 items-center justify-between rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur-xl transition-all hover:translate-y-[-4px]"
      >
        <div className="flex items-center gap-3">
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br text-white", context.color)}>
            <Bot className="h-4 w-4" />
          </div>
          <p className="text-sm font-bold text-[#062e39]">Zed Intelligence</p>
        </div>
        <Maximize2 className="h-4 w-4 text-slate-400" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 h-[90vh] right-6 z-[9999] flex w-[90vw] max-w-[400px] flex-col overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white/98 shadow-2xl backdrop-blur-2xl transition-all animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {/* Header */}
      <div className={cn("relative flex items-center justify-between px-6 py-1 text-white bg-gradient-to-r", context.color)}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">{context.eyebrow}</p>
            <h6 className="font-bold tracking-tight">Zed Intelligence</h6>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={clearChat}
            className="rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            title="Clear chat"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button 
            onClick={() => setIsMinimized(true)}
            className="rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
          <button 
            onClick={() => setIsOpen(false)}
            className="rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Message Thread */}
      <div className="flex h-[450px] flex-col overflow-y-auto bg-[#f8fafc] px-4 py-6 space-y-6">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-3",
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            )}
          >
            <div className={cn(
              "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold shadow-sm",
              msg.role === "user" 
                ? "bg-[#062e39] text-white" 
                : cn("bg-white border border-slate-100", context.accent)
            )}>
              {msg.role === "user" ? "Me" : <Bot className="h-4 w-4" />}
            </div>
            <div className={cn(
              "max-w-[85%] rounded-[1.8rem] px-5 py-4 text-sm leading-relaxed shadow-sm",
              msg.role === "user"
                ? "bg-[#062e39] text-white rounded-tr-sm"
                : "bg-white text-slate-700 border border-slate-100 rounded-tl-sm"
            )}>
              {msg.content ? (
                <MessageContent content={msg.content} />
              ) : (
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Thinking...
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-100 bg-white p-4">
        
        {/* Quick Actions / Suggestions */}
        {messages.length < 3 && (
          <div className="mb-2 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 min-w-max">
              {context.suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(s.prompt)}
                  className="flex items-center gap-2 rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-[8px]  text-[#062e39] transition-all whitespace-nowrap hover:border-[#fd5523]/20 hover:bg-[#fff6ee] hover:text-[#fd5523]"
                >
                  <Zap className="h-3 w-3 flex-shrink-0" />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="relative flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            rows={1}
            className="min-h-[50px] max-h-[120px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 pl-4 pr-12 py-3.5 text-sm text-[#062e39] placeholder:text-slate-400 focus:border-[#fd5523]/40 focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#fd5523]/5 transition-all"
          />
          <button
            disabled={!input.trim() || isStreaming}
            onClick={() => sendMessage(input)}
            className={cn(
              "absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-xl text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 shadow-lg",
              context.color
            )}
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        
      </div>
    </div>
  );
}
