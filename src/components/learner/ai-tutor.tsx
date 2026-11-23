"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, History, Loader2, Send, X } from "lucide-react";
import { MessageContent } from "./chat-components/MessageContent";
import { Teacher } from "@/components/tutor/avatar/Teacher";
import { PERSONA_PRESETS } from "@/components/tutor/avatar/persona-presets";
import type { AvatarDriver, PersonaLook } from "@/components/tutor/avatar/types";
import { TeachingBoard } from "@/components/tutor/practice/TeachingBoard";
import { useLiteMode } from "@/components/tutor/practice/use-lite-mode";
import { DEFAULT_TEACHER_NAME } from "@/lib/tutor/course-teacher";
import { dispatchLessonSeek, extractDockBoardFromText } from "@/lib/tutor/lesson-seek";
import type { VisemeValue } from "@/lib/tutor/contract.generated";

type Message = { role: "user" | "assistant"; content: string };

// Teaching moves the learner can ask for in one tap. Same for every subject.
const STARTER_PROMPTS = [
  { label: "Explain simpler", body: "Explain the main idea of this lesson more simply, with one everyday example." },
  { label: "Give me an example", body: "Give me a real, local example of how this lesson applies at work or in a small business." },
  { label: "Quiz me", body: "Ask me one question at a time to check I understood this lesson. Wait for my answer before the next one." },
  { label: "Summarise", body: "Summarise this lesson in five short bullet points I can review later." },
] as const;

export function AiTutor({
  courseId,
  lessonId,
  courseTitle,
  lessonTitle,
  moduleTitle,
  sectionTitle,
  teacher,
  onClose,
}: {
  /** The course's AI teacher (see courseTeacher()). Defaults to the platform default teacher. */
  teacher?: { name: string; look?: Partial<PersonaLook> };
  courseId: string;
  lessonId: string;
  courseTitle: string;
  lessonTitle: string;
  moduleTitle?: string;
  sectionTitle?: string;
  onClose: () => void;
}) {
  const teacherName = teacher?.name ?? DEFAULT_TEACHER_NAME;
  const greeting = `Hi, I'm ${teacherName}, your teacher for this course. Ask me anything about this lesson, or pick one below.`;
  const storageKey = `zed-ai-coach-history-${lessonId}-${sectionTitle || "default"}`;
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed as Message[];
        }
      } catch (e) {
        console.error("Failed to parse saved chat history", e);
      }
    }
    return [{ role: "assistant", content: greeting }];
  });
  const [lite, setLite] = useLiteMode();
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const avatarRef = useRef<AvatarDriver | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasUserMessages = messages.some((m) => m.role === "user");
  const defaultLook = (PERSONA_PRESETS.find((p) => p.key === "tinashe") ?? PERSONA_PRESETS[0]).look;
  const look = teacher?.look ?? defaultLook;

  // Latest board & video/lesson references emitted by the teacher across the thread.
  const dockBoard = useMemo(() => {
    let latestBoard: ReturnType<typeof extractDockBoardFromText>["board"] = null;
    let latestRefs: ReturnType<typeof extractDockBoardFromText>["lessonRefs"] = [];
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      const extracted = extractDockBoardFromText(msg.content);
      if (extracted.board) latestBoard = extracted.board;
      if (extracted.lessonRefs.length > 0) latestRefs = extracted.lessonRefs;
    }
    return { board: latestBoard, lessonRefs: latestRefs };
  }, [messages]);

  // Save history when messages change
  useEffect(() => {
    if (messages.length > 1 || messages[0]?.role === "user") {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    }
  }, [messages, storageKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(message: string) {
    if (!message.trim() || isStreaming) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setIsStreaming(true);
    avatarRef.current?.setThinking(true);
    avatarRef.current?.setMood("curious", 75);

    let visemeStep = 0;
    const visemeCycle: VisemeValue[] = [1, 3, 4, 2, 6, 8, 5];

    try {
      const res = await fetch("/api/ai/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message, 
          courseId, 
          lessonId,
          moduleTitle,
          sectionTitle,
          teacherName,
        }),
      });

      if (!res.ok || !res.body) throw new Error("No response");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      avatarRef.current?.setThinking(false);
      avatarRef.current?.setSpeaking(true);
      avatarRef.current?.setMood("warm", 80);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        visemeStep = (visemeStep + 1) % visemeCycle.length;
        avatarRef.current?.setViseme(visemeCycle[visemeStep]);
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last) next[next.length - 1] = { ...last, content: last.content + chunk };
          return next;
        });
      }
      avatarRef.current?.setMood("happy", 75);
      avatarRef.current?.playGesture("nod");
    } catch {
      avatarRef.current?.setMood("concerned", 70);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again with a shorter prompt." },
      ]);
    } finally {
      avatarRef.current?.setThinking(false);
      avatarRef.current?.setSpeaking(false);
      avatarRef.current?.setViseme(0);
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

        {/* Header: the course's AI teacher */}
        <div className="flex-shrink-0 border-b border-slate-200 bg-gradient-to-br from-[#ecfdf5] to-[#eff6ff] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white bg-white/70 shadow-sm">
                <Teacher
                  ref={avatarRef}
                  engine={lite ? "placeholder" : "rive"}
                  variant="bust"
                  persona={look}
                  className="h-16 w-16"
                  label={`${teacherName}, your AI teacher`}
                />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0f766e]">
                  {teacherName} · AI teacher
                </p>
                <h2 className="mt-0.5 line-clamp-1 text-sm font-bold text-[#062e39]">{lessonTitle}</h2>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-600">{courseTitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (confirm("Clear chat history for this section?")) {
                    setMessages([{ role: "assistant", content: greeting }]);
                    localStorage.removeItem(storageKey);
                  }
                }}
                className="shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 transition-colors hover:bg-white hover:text-[#062e39]"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-full p-2 text-slate-600 transition-colors hover:bg-white hover:text-[#062e39]"
                aria-label={`Close ${teacherName}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-600">
            <span>Answers come from this course.</span>
            <button
              type="button"
              onClick={() => setLite(!lite)}
              aria-pressed={lite}
              className="rounded-full border border-slate-300 bg-white/80 px-2.5 py-1 font-semibold hover:bg-white"
            >
              {lite ? "Data saver on" : "Data saver off"}
            </button>
          </div>
        </div>

        {/* Message thread */}
        <div className="flex-1 overflow-y-auto bg-[#f7f8fb] px-4 py-4 space-y-4">

          {/* Pinned Teaching Board & lesson references (v2 contract unified into the dock) */}
          {(dockBoard.board || dockBoard.lessonRefs.length > 0) && (
            <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-sm">
              <TeachingBoard
                board={dockBoard.board}
                choice={null}
                confidence={null}
                lessonRefs={dockBoard.lessonRefs}
                clip={null}
                award={null}
                lite={lite}
                disabled={isStreaming}
                onChoose={() => {}}
                onConfidence={() => {}}
                onDismissAward={() => {}}
                onLessonRefClick={(ref) => dispatchLessonSeek(ref)}
              />
            </div>
          )}

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
              {/* <div className={`
                mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold
                ${msg.role === "user"
                  ? "bg-[#fd5523] text-white"
                  : "bg-[#062e39] text-white"
                }
              `}>
                {msg.role === "user" ? "You" : <Sparkles className="h-3.5 w-3.5" />}
              </div> */}

              {/* Bubble */}
              <div className={`
                max-w-[95%] rounded-[1.8rem] px-4 py-4 text-sm leading-relaxed shadow-sm
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

export const TeacherDock = AiTutor;
