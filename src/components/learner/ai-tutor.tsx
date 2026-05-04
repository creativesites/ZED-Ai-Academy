"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, History, Loader2, Send, Sparkles, X } from "lucide-react";
import { MessageContent } from "./chat-components/MessageContent";

type Message = { role: "user" | "assistant"; content: string };

const STARTER_PROMPTS = [
  { label: "Build a workflow", body: "Turn this lesson into a step-by-step workflow I can use in my job today." },
  { label: "Critique my prompt", body: "I'll share a prompt I'm planning to use at work — review it for quality and suggest improvements." },
  { label: "Plain-language summary", body: "Summarize this lesson in plain language, like I'm explaining it to a colleague who missed it." },
  { label: "Verification checklist", body: "What should I verify before I trust and share the AI output from this lesson?" },
] as const;

function renderContent(text: string) {
  // Split on double newlines → paragraphs; single newlines → <br>
  const paragraphs = text.split(/\n{2,}/);
  return paragraphs.map((para, pi) => {
    const lines = para.split("\n");
    return (
      <p key={pi} className={pi > 0 ? "mt-3" : ""}>
        {lines.map((line, li) => {
          // Inline: **bold** and `code`
          const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
          return (
            <span key={li}>
              {parts.map((part, ti) => {
                if (part.startsWith("**") && part.endsWith("**"))
                  return <strong key={ti} className="font-semibold">{part.slice(2, -2)}</strong>;
                if (part.startsWith("`") && part.endsWith("`"))
                  return <code key={ti} className="rounded bg-black/10 px-1 font-mono text-[0.82em]">{part.slice(1, -1)}</code>;
                return part;
              })}
              {li < lines.length - 1 ? <br /> : null}
            </span>
          );
        })}
      </p>
    );
  });
}

export function AiTutor({
  courseId,
  lessonId,
  courseTitle,
  lessonTitle,
  onClose,
}: {
  courseId: string;
  lessonId: string;
  courseTitle: string;
  lessonTitle: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "I can help you apply this lesson to real work. Try one of the prompts below, or ask me anything about the lesson.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasUserMessages = messages.some((m) => m.role === "user");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(message: string) {
    if (!message.trim() || isStreaming) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setIsStreaming(true);

    try {
      const res = await fetch("/api/ai/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, courseId, lessonId }),
      });

      if (!res.ok || !res.body) throw new Error("No response");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last) next[next.length - 1] = { ...last, content: last.content + chunk };
          return next;
        });
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again with a shorter prompt." },
      ]);
    } finally {
      setIsStreaming(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input.trim());
    }
  }

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm sm:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:w-[420px] sm:border-l sm:border-slate-200">

        {/* Header */}
        <div className="flex-shrink-0 bg-[#062e39] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fd5523]/20">
                <Sparkles className="h-5 w-5 text-[#fd5523]" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#fd5523]/70">AI Coach</p>
                <h3 className="mt-0.5 line-clamp-1 text-sm font-bold text-white">{lessonTitle}</h3>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-white/40">{courseTitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close AI coach"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Message thread */}
        <div className="flex-1 overflow-y-auto bg-[#f7f8fb] px-4 py-4 space-y-4">

          {/* Starter prompt cards — visible until first user message */}
          {!hasUserMessages && (
            <div className="grid grid-cols-2 gap-2 pb-2">
              {STARTER_PROMPTS.map((sp) => (
                <button
                  key={sp.label}
                  type="button"
                  onClick={() => void sendMessage(sp.body)}
                  disabled={isStreaming}
                  className="group rounded-2xl border-2 border-slate-100 bg-white p-3 text-left transition-all hover:border-[#fd5523]/30 hover:shadow-md disabled:opacity-50"
                >
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#fd5523]">{sp.label}</p>
                  <p className="text-[12px] leading-snug text-slate-600">{sp.body}</p>
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            <div
              key={`${msg.role}-${i}`}
              className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              {/* Avatar */}
              <div className={`
                mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold
                ${msg.role === "user"
                  ? "bg-[#fd5523] text-white"
                  : "bg-[#062e39] text-white"
                }
              `}>
                {msg.role === "user" ? "You" : <Sparkles className="h-3.5 w-3.5" />}
              </div>

              {/* Bubble */}
              <div className={`
                max-w-[85%] rounded-[1.8rem] px-5 py-4 text-sm leading-relaxed shadow-sm
                ${msg.role === "user"
                  ? "rounded-tr-sm bg-[#fd5523] text-white"
                  : "rounded-tl-sm border border-slate-100 bg-white text-slate-700"
                }
              `}>
                {msg.content ? (
                  <>
                    <MessageContent content={msg.content} />
                    {msg.role === "assistant" && (
                      <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-3">
                        <button 
                          onClick={() => void navigator.clipboard.writeText(msg.content)}
                          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <Copy className="h-3 w-3" />
                          Copy
                        </button>
                        <button 
                          onClick={() => void sendMessage(messages[messages.length - 2]?.content || "")}
                          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-[#fd5523] transition-colors"
                        >
                          <History className="h-3 w-3" />
                          Regenerate
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="flex items-center gap-2 text-current opacity-60">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking…
                  </span>
                )}
              </div>
            </div>
          ))}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 border-t border-slate-100 bg-white px-4 pb-4 pt-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this lesson…"
              rows={2}
              className="
                min-h-[52px] max-h-[120px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50
                px-4 py-3 text-sm text-slate-900 placeholder-slate-400
                focus:border-[#fd5523]/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#fd5523]/15
                transition-all
              "
            />
            <button
              type="button"
              onClick={() => void sendMessage(input.trim())}
              disabled={!input.trim() || isStreaming}
              className="
                flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl
                bg-[#fd5523] text-white shadow-md shadow-[#fd5523]/25
                transition-all hover:bg-[#ef4a16] hover:scale-105 active:scale-95
                disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:scale-100
              "
            >
              {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-400">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  );
}
