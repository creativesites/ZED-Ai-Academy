"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, History, Loader2, Mic, MicOff, Send, Square, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import { recordDockKnowledgeCheck } from "@/actions/tutor-learner";
import { MessageContent } from "./chat-components/MessageContent";
import type { KnowledgeCheckResult } from "./chat-components/KnowledgeCheck";
import { Teacher } from "@/components/tutor/avatar/Teacher";
import { PERSONA_PRESETS } from "@/components/tutor/avatar/persona-presets";
import type { AvatarDriver, PersonaLook } from "@/components/tutor/avatar/types";
import { TeacherVoice } from "@/components/tutor/voice/teacher-voice";
import { TeachingBoard } from "@/components/tutor/practice/TeachingBoard";
import { useLiteMode } from "@/components/tutor/practice/use-lite-mode";
import { DEFAULT_TEACHER_NAME, DEFAULT_TEACHER_VOICE } from "@/lib/tutor/course-teacher";
import { stripDockMarkupForSpeech } from "@/lib/tutor/dock-chat";
import { dispatchLessonSeek, extractDockBoardFromText } from "@/lib/tutor/lesson-seek";
import type { VisemeValue } from "@/lib/tutor/contract.generated";
import type { TutorEvent } from "@/lib/tutor/events";
import { choiceReply, type ConfidenceLevel } from "@/lib/tutor/board";
import { ASK_QUICK_ACTIONS, deriveAskBoard, isAskRuntimeEnabled } from "@/lib/tutor/runtime/ask";
import { EventPlayer, type PlayerUI, type SaySpeechEvent } from "@/components/tutor/EventPlayer";
import { AskThread } from "./ask/AskThread";
import { useAskRuntime } from "./ask/use-ask-runtime";

// P1-06: the dock runs on the Teacher Runtime (`ask` session, streamed turns) when this flag is on and the server
// accepts the learner's session; otherwise it keeps the /api/ai/tutor path below unchanged. Inlined at build time.
const ASK_RUNTIME_FLAG = isAskRuntimeEnabled(process.env.NEXT_PUBLIC_TEACHER_ASK_RUNTIME);

const NOOP_AVATAR: AvatarDriver = {
  playGesture: () => undefined,
  setMood: () => undefined,
  setViseme: () => undefined,
  setSpeaking: () => undefined,
  setListening: () => undefined,
  setThinking: () => undefined,
  lookAt: () => undefined,
};

// In the dock the thread and the pinned board render events directly (deriveAskBoard); the player only animates
// the teacher (gestures, mood, mouth, read-aloud), so its UI callbacks are no-ops.
const AVATAR_ONLY_UI: PlayerUI = {
  onCaption: () => undefined,
  onCard: () => undefined,
  onText: () => undefined,
  onListen: () => undefined,
  onMistake: () => undefined,
  onEnd: () => undefined,
};

type Message = { role: "user" | "assistant"; content: string };

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function createSpeechRecognition(): BrowserSpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

// Teaching moves the learner can ask for in one tap. Same for every subject (and both dock paths).
const STARTER_PROMPTS = ASK_QUICK_ACTIONS;

export function AiTutor({
  courseId,
  lessonId,
  courseTitle,
  lessonTitle,
  moduleTitle,
  sectionTitle,
  teacher,
  isGuest,
  onClose,
}: {
  /** The course's AI teacher (see courseTeacher()). Defaults to the platform default teacher. */
  teacher?: { name: string; look?: Partial<PersonaLook>; voiceName?: string };
  /** Signed-out visitor on a free preview: always the in-memory /api/ai/tutor path, nothing stored. */
  isGuest?: boolean;
  courseId: string;
  lessonId: string;
  courseTitle: string;
  lessonTitle: string;
  moduleTitle?: string;
  sectionTitle?: string;
  onClose: () => void;
}) {
  const teacherName = teacher?.name ?? DEFAULT_TEACHER_NAME;
  const teacherVoice = teacher?.voiceName ?? DEFAULT_TEACHER_VOICE;
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
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speakingMsgIdx, setSpeakingMsgIdx] = useState<number | null>(null);
  const [dictating, setDictating] = useState(false);
  const avatarRef = useRef<AvatarDriver | null>(null);
  const audioRef = useRef<TeacherVoice | null>(null);
  const autoSpeakRef = useRef(autoSpeak);
  const playerRef = useRef<EventPlayer | null>(null);
  const playQueueRef = useRef<Promise<void>>(Promise.resolve());
  const speakAbortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const messagesRef = useRef<Message[]>(messages);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasUserMessages = messages.some((m) => m.role === "user");
  const defaultLook = (PERSONA_PRESETS.find((p) => p.key === "tinashe") ?? PERSONA_PRESETS[0]).look;
  const look = teacher?.look ?? defaultLook;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const audio = new TeacherVoice();
    audio.setLanguage("en");
    audioRef.current = audio;
    return () => {
      playerRef.current?.stop();
      speakAbortRef.current?.abort();
      audio.stopPlayback();
      recognitionRef.current?.stop();
    };
  }, []);

  // The course teacher's own voice (same as in sessions), not a hard-coded one.
  useEffect(() => {
    audioRef.current?.setTtsVoice(teacherVoice);
  }, [teacherVoice]);

  const stopSpeaking = useCallback(() => {
    playerRef.current?.stop();
    playQueueRef.current = Promise.resolve();
    speakAbortRef.current?.abort();
    speakAbortRef.current = null;
    audioRef.current?.stopPlayback();
    avatarRef.current?.setSpeaking(false);
    avatarRef.current?.setViseme(0);
    setSpeakingMsgIdx(null);
  }, []);

  const speakMessage = useCallback(
    async (rawText: string, idx: number) => {
      const audio = audioRef.current;
      const avatar = avatarRef.current;
      if (!audio) return;
      if (speakingMsgIdx === idx) {
        stopSpeaking();
        return;
      }
      const clean = stripDockMarkupForSpeech(rawText);
      if (!clean) return;

      stopSpeaking();
      audio.unlock();
      const controller = new AbortController();
      speakAbortRef.current = controller;
      setSpeakingMsgIdx(idx);
      avatar?.setSpeaking(true);
      avatar?.setMood("warm", 80);

      const fallbackDriver: AvatarDriver = avatar ?? {
        playGesture: () => undefined,
        setMood: () => undefined,
        setViseme: () => undefined,
        setSpeaking: () => undefined,
        setListening: () => undefined,
        setThinking: () => undefined,
        lookAt: () => undefined,
      };

      try {
        await audio.speak({ type: "say", text: clean }, fallbackDriver, controller.signal);
      } finally {
        if (speakAbortRef.current === controller) {
          speakAbortRef.current = null;
          setSpeakingMsgIdx(null);
          avatar?.setSpeaking(false);
          avatar?.setViseme(0);
        }
      }
    },
    [speakingMsgIdx, stopSpeaking],
  );

  // ---- Teacher Runtime path (P1-06) ----
  // Voice for a streamed `say` line: read aloud when "Voice on", otherwise the player moves the mouth for the
  // reading time. Kept beside speakMessage so a single teacher-voice component can replace both.
  useEffect(() => {
    autoSpeakRef.current = autoSpeak;
  }, [autoSpeak]);
  const speakLine = useCallback(async (event: SaySpeechEvent, avatar: AvatarDriver, signal: AbortSignal) => {
    const audio = audioRef.current;
    if (!autoSpeakRef.current || !audio) return "unavailable" as const;
    const clean = stripDockMarkupForSpeech(event.text);
    if (!clean) return "played" as const;
    return audio.speak({ ...event, text: clean }, avatar, signal);
  }, []);
  const playEvents = useCallback(
    (events: TutorEvent[]) => {
      if (events.length === 0) return;
      if (!playerRef.current) {
        // Forward to whichever avatar is mounted now (Data saver swaps the Rive teacher for a placeholder).
        const current = () => avatarRef.current ?? NOOP_AVATAR;
        const avatar: AvatarDriver = {
          playGesture: (name, opts) => current().playGesture(name, opts),
          setMood: (mood, intensity) => current().setMood(mood, intensity),
          setViseme: (v) => current().setViseme(v),
          setSpeaking: (on) => current().setSpeaking(on),
          setListening: (on, level) => current().setListening(on, level),
          setThinking: (on) => current().setThinking(on),
          lookAt: (x, y) => current().lookAt(x, y),
        };
        playerRef.current = new EventPlayer({ avatar, ui: AVATAR_ONLY_UI, speak: speakLine });
      }
      const player = playerRef.current;
      // Events arrive one by one while streaming; play them in order, one at a time.
      playQueueRef.current = playQueueRef.current.then(() => player.play(events)).catch(() => undefined);
    },
    [speakLine],
  );
  const runtime = useAskRuntime({
    lessonId,
    enabled: ASK_RUNTIME_FLAG && !isGuest,
    onTurnStart: () => {
      avatarRef.current?.setThinking(true);
      avatarRef.current?.setMood("curious", 75);
    },
    onStreamEvent: (event) => {
      avatarRef.current?.setThinking(false);
      playEvents([event]);
    },
    onTurnDone: (events, streamed) => {
      avatarRef.current?.setThinking(false);
      // Nothing streamed (non-stream fallback): play the final turn now.
      if (streamed === 0) playEvents(events);
    },
    onTurnFailed: () => {
      avatarRef.current?.setThinking(false);
      avatarRef.current?.setMood("concerned", 70);
    },
  });
  const onRuntime = runtime.status === "ready";
  const askBoard = useMemo(
    () =>
      deriveAskBoard(
        runtime.messages.map((m) => (m.role === "user" ? { role: "user" as const, text: m.text } : { role: "assistant" as const, events: m.events })),
      ),
    [runtime.messages],
  );
  const sendRuntime = useCallback(
    (text: string) => {
      stopSpeaking();
      audioRef.current?.unlock();
      setInput("");
      void runtime.send(text).finally(() => textareaRef.current?.focus());
    },
    [runtime, stopSpeaking],
  );
  const handleRuntimeChoose = useCallback((option: string) => sendRuntime(choiceReply(option)), [sendRuntime]);
  const handleRuntimeConfidence = useCallback((level: ConfidenceLevel) => sendRuntime(level), [sendRuntime]);

  const toggleDictation = useCallback(() => {
    if (dictating) {
      recognitionRef.current?.stop();
      setDictating(false);
      return;
    }
    const rec = createSpeechRecognition();
    if (!rec) {
      toast.error("Voice dictation is not supported in this browser.");
      return;
    }
    recognitionRef.current = rec;
    rec.lang = "en-GB";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const heard = e.results?.[0]?.[0]?.transcript?.trim();
      if (heard) {
        setInput((prev) => (prev ? `${prev} ${heard}` : heard));
      }
    };
    rec.onerror = () => setDictating(false);
    rec.onend = () => setDictating(false);
    try {
      setDictating(true);
      rec.start();
    } catch {
      setDictating(false);
    }
  }, [dictating]);

  const handleKnowledgeCheckResult = useCallback(
    (result: KnowledgeCheckResult) => {
      if (result.isCorrect) {
        avatarRef.current?.setMood("proud", 90);
        avatarRef.current?.playGesture("thumbs_up");
      } else {
        avatarRef.current?.setMood("warm", 80);
        avatarRef.current?.playGesture("nod");
      }
      void recordDockKnowledgeCheck({
        courseId,
        lessonTitle,
        question: result.question,
        selectedOption: result.selectedOption,
        correctOption: result.correctOption,
        isCorrect: result.isCorrect,
      })
        .then((res) => {
          if (res.recorded) {
            toast.success(
              result.isCorrect
                ? "Mastery updated — nice work!"
                : "Noted for your review plan.",
            );
          }
        })
        .catch(() => undefined);
    },
    [courseId, lessonTitle],
  );

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

  // Save history when messages change (legacy path only: on the runtime the conversation lives on the server).
  useEffect(() => {
    if (onRuntime) return;
    if (messages.length > 1 || messages[0]?.role === "user") {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    }
  }, [messages, storageKey, onRuntime]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, runtime.messages]);

  async function sendMessage(message: string, opts?: { replaceLastAssistant?: boolean }) {
    if (onRuntime) {
      if (message.trim() && !runtime.busy) sendRuntime(message);
      return;
    }
    if (runtime.status === "checking") return;
    if (!message.trim() || isStreaming) return;
    stopSpeaking();
    setInput("");

    const priorHistory = opts?.replaceLastAssistant
      ? messagesRef.current.slice(0, Math.max(0, messagesRef.current.length - 2))
      : messagesRef.current;

    const assistantIndex = priorHistory.length + 1;
    setMessages([...priorHistory, { role: "user", content: message }]);
    setIsStreaming(true);
    avatarRef.current?.setThinking(true);
    avatarRef.current?.setMood("curious", 75);

    let visemeStep = 0;
    const visemeCycle: VisemeValue[] = [1, 3, 4, 2, 6, 8, 5];
    let fullReply = "";

    try {
      const res = await fetch("/api/ai/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message,
          history: priorHistory.slice(-12),
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
        fullReply += chunk;
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
      if (autoSpeak && fullReply.trim()) {
        void speakMessage(fullReply, assistantIndex);
      }
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

  const threadBusy = onRuntime ? runtime.busy : isStreaming || runtime.status === "checking";
  const showStarters = onRuntime ? !runtime.messages.some((m) => m.role === "user") : !hasUserMessages;
  const pinned = onRuntime
    ? { board: askBoard.board, lessonRefs: askBoard.lessonRefs, clip: askBoard.clip, award: askBoard.award }
    : { board: dockBoard.board, lessonRefs: dockBoard.lessonRefs, clip: null, award: null };
  const hasPinned = Boolean(pinned.board || pinned.lessonRefs.length > 0 || pinned.clip || pinned.award);

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
                  if (onRuntime) {
                    if (confirm("Start a new conversation? This one stays saved in your history.")) {
                      stopSpeaking();
                      void runtime.restart().then((ok) => {
                        if (!ok) toast.error("Could not start a new conversation. Try again.");
                      });
                    }
                    return;
                  }
                  if (confirm("Clear chat history for this section?")) {
                    setMessages([{ role: "assistant", content: greeting }]);
                    localStorage.removeItem(storageKey);
                  }
                }}
                disabled={threadBusy}
                className="shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 transition-colors hover:bg-white hover:text-[#062e39] disabled:opacity-40"
              >
                {onRuntime ? "New chat" : "Clear"}
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
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const next = !autoSpeak;
                  setAutoSpeak(next);
                  if (!next) stopSpeaking();
                  else audioRef.current?.unlock();
                }}
                aria-pressed={autoSpeak}
                title={autoSpeak ? "Auto-read replies is on" : "Read replies aloud automatically"}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold transition ${
                  autoSpeak
                    ? "border-[#0f766e]/40 bg-[#ecfdf5] text-[#0f766e]"
                    : "border-slate-300 bg-white/80 hover:bg-white"
                }`}
              >
                {autoSpeak ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
                {autoSpeak ? "Voice on" : "Voice"}
              </button>
              <button
                type="button"
                onClick={() => setLite(!lite)}
                aria-pressed={lite}
                className="rounded-full border border-slate-300 bg-white/80 px-2.5 py-1 font-semibold hover:bg-white"
              >
                {lite ? "Data saver on" : "Data saver"}
              </button>
            </div>
          </div>
        </div>

        {/* Message thread */}
        <div className="flex-1 overflow-y-auto bg-[#f7f8fb] px-4 py-4 space-y-4">

          {/* Pinned Teaching Board & lesson references (v2 contract unified into the dock) */}
          {hasPinned && (
            <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-sm">
              <TeachingBoard
                board={pinned.board}
                choice={null}
                confidence={null}
                lessonRefs={pinned.lessonRefs}
                clip={pinned.clip}
                award={pinned.award}
                lite={lite}
                disabled={threadBusy}
                onChoose={() => {}}
                onConfidence={() => {}}
                onDismissAward={() => {}}
                onLessonRefClick={(ref) => dispatchLessonSeek(ref)}
                onInteract={onRuntime ? (prompt) => sendRuntime(prompt) : undefined}
              />
            </div>
          )}

          {/* On the runtime the greeting is not a stored turn: show it above the saved conversation. */}
          {onRuntime && (
            <div className="flex flex-row gap-2.5">
              <div className="max-w-[95%] rounded-[1.8rem] rounded-tl-sm border border-slate-100 bg-white px-4 py-4 text-sm leading-relaxed text-slate-700 shadow-sm">
                {greeting}
              </div>
            </div>
          )}
          {runtime.status === "checking" && (
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading your conversation…
            </p>
          )}

          {/* Starter prompt cards — visible until first user message */}
          {showStarters && runtime.status !== "checking" && (
            <div className="grid grid-cols-2 gap-2 pb-2">
              {STARTER_PROMPTS.map((sp) => (
                <button
                  key={sp.label}
                  type="button"
                  onClick={() => void sendMessage(sp.body)}
                  disabled={threadBusy}
                  className="group rounded-2xl border-2 border-slate-100 bg-white p-3 text-left transition-all hover:border-[#fd5523]/30 hover:shadow-md disabled:opacity-50"
                >
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#fd5523]">{sp.label}</p>
                  <p className="text-[12px] leading-snug text-slate-600">{sp.body}</p>
                </button>
              ))}
            </div>
          )}

          {/* Messages (legacy /api/ai/tutor path) */}
          {runtime.status === "legacy" && messages.map((msg, i) => (
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
                    <MessageContent
                      content={msg.content}
                      onKnowledgeCheckResult={handleKnowledgeCheckResult}
                    />
                    {msg.role === "assistant" && (
                      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
                        <button
                          type="button"
                          onClick={() => void speakMessage(msg.content, i)}
                          className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                            speakingMsgIdx === i
                              ? "text-[#0f766e]"
                              : "text-slate-400 hover:text-[#0f766e]"
                          }`}
                        >
                          {speakingMsgIdx === i ? (
                            <>
                              <Square className="h-3 w-3 fill-current" />
                              Stop
                            </>
                          ) : (
                            <>
                              <Volume2 className="h-3 w-3" />
                              Listen
                            </>
                          )}
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(msg.content);
                            toast.success("Copied reply");
                          }}
                          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <Copy className="h-3 w-3" />
                          Copy
                        </button>
                        {i === messages.length - 1 && i >= 2 && messages[i - 1]?.role === "user" && (
                          <button 
                            type="button"
                            onClick={() =>
                              void sendMessage(messages[i - 1].content, { replaceLastAssistant: true })
                            }
                            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-[#fd5523] transition-colors"
                          >
                            <History className="h-3 w-3" />
                            Regenerate
                          </button>
                        )}
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

          {onRuntime && (
            <AskThread
              messages={runtime.messages}
              boardState={askBoard}
              busy={runtime.busy}
              speakingIdx={speakingMsgIdx}
              onListen={(text, idx) => void speakMessage(text, idx)}
              onChoose={handleRuntimeChoose}
              onConfidence={handleRuntimeConfidence}
            />
          )}

          <div ref={bottomRef} />
        </div>

        {/* Quick actions stay one tap away once the conversation has started (runtime path). */}
        {onRuntime && !showStarters && (
          <div className="flex flex-shrink-0 gap-1.5 overflow-x-auto bg-white px-4 pt-2">
            {STARTER_PROMPTS.map((sp) => (
              <button
                key={sp.label}
                type="button"
                onClick={() => sendRuntime(sp.body)}
                disabled={threadBusy}
                className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-white disabled:opacity-50"
              >
                {sp.label}
              </button>
            ))}
          </div>
        )}

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
              onClick={toggleDictation}
              disabled={threadBusy}
              aria-label={dictating ? "Stop voice dictation" : "Dictate question"}
              title={dictating ? "Stop listening" : "Speak your question"}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-all disabled:opacity-40 ${
                dictating
                  ? "border-rose-300 bg-rose-50 text-rose-600 animate-pulse"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-[#062e39]"
              }`}
            >
              {dictating ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => void sendMessage(input.trim())}
              disabled={!input.trim() || threadBusy}
              className="
                flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl
                bg-[#fd5523] text-white shadow-md shadow-[#fd5523]/25
                transition-all hover:bg-[#ef4a16] hover:scale-105 active:scale-95
                disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:scale-100
              "
            >
              {threadBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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
