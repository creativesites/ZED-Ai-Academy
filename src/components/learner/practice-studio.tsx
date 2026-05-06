"use client";

import { useState, useRef, useEffect } from "react";
import {
  X, Sparkles, Loader2, ChevronRight, Wand2,
  Copy, Check, RotateCcw, Zap, Brain, MessageSquare,
  Layout, Code, Info, HelpCircle, History, CheckCircle,
  Menu, ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ── Types & Tool Definitions (unchanged) ──────────────────────────────────────

interface PracticeStudioProps {
  lessonTitle: string;
  onClose: () => void;
  initialTool?: string;
  exerciseContext?: { brief?: string; instructions?: string[] } | null;
  onSelectOutput?: (toolId: string, inputs: Record<string, string>, output: string) => void;
}

const TOOLS = [
  {
    id: "prompt_optimizer",
    icon: Brain,
    label: "Prompt Optimizer",
    desc: "Transform simple ideas into professional-grade prompts.",
    color: "bg-[#fff6ee] text-[#fd5523] border-[#fd5523]/20",
    activeColor: "bg-[#fd5523] text-white border-[#fd5523]",
    category: "optimization",
    fields: [
      { key: "base_prompt", label: "Base Prompt", placeholder: "What do you want to achieve?", multiline: true },
      { key: "context", label: "Context (Optional)", placeholder: "e.g. For a LinkedIn post..." },
      { key: "tone", label: "Tone / Style", placeholder: "e.g. Professional, authoritative..." },
    ],
    help: "The Prompt Optimizer uses a multi-step chain-of-thought process to expand your simple prompt into a structured, role-based instruction."
  },
  {
    id: "midjourney_prompt",
    icon: Wand2,
    label: "Midjourney v6",
    desc: "Build cinematic prompts with precise control.",
    color: "bg-violet-50 text-violet-600 border-violet-100",
    activeColor: "bg-violet-600 text-white border-violet-600",
    category: "image",
    fields: [
      { key: "subject", label: "Subject", placeholder: "e.g. a Zambian woman at a market stall", multiline: true },
      { key: "style", label: "Style", placeholder: "e.g. cinematic photography, film grain" },
      { key: "lighting", label: "Lighting", placeholder: "e.g. soft side lighting" },
      { key: "extras", label: "Parameters", placeholder: "e.g. --ar 16:9 --v 6" },
    ],
    help: "Midjourney v6 excels at natural language. Focus on describing the scene as if you're a cinematographer."
  },
  {
    id: "workflow_generator",
    icon: Layout,
    label: "Workflow Designer",
    desc: "Create step-by-step AI automation roadmaps.",
    color: "bg-indigo-50 text-indigo-600 border-indigo-100",
    activeColor: "bg-indigo-600 text-white border-indigo-600",
    category: "business",
    fields: [
      { key: "process", label: "Business Process", placeholder: "e.g. Customer support email handling", multiline: true },
      { key: "tools", label: "Preferred Tools", placeholder: "e.g. Make.com, OpenAI, Airtable" },
      { key: "goal", label: "Primary Goal", placeholder: "e.g. Save 2 hours daily" },
    ],
    help: "This tool generates a logical flow including trigger, AI processing steps, and final actions."
  },
  {
    id: "social_hooks",
    icon: MessageSquare,
    label: "Viral Hooks",
    desc: "Generate attention-grabbing hooks for AI content.",
    color: "bg-pink-50 text-pink-600 border-pink-100",
    activeColor: "bg-pink-600 text-white border-pink-600",
    category: "content",
    fields: [
      { key: "topic", label: "Topic", placeholder: "e.g. New ChatGPT feature for data analysis", multiline: true },
      { key: "audience", label: "Audience", placeholder: "e.g. Solopreneurs, developers" },
      { key: "platform", label: "Platform", placeholder: "e.g. X/Twitter, LinkedIn" },
    ],
    help: "Strong hooks leverage curiosity, pain points, or controversial takes to stop the scroll."
  },
  {
    id: "code_commentator",
    icon: Code,
    label: "Code Explorer",
    desc: "Explain complex logic and suggest optimizations.",
    color: "bg-slate-50 text-slate-600 border-slate-100",
    activeColor: "bg-slate-900 text-white border-slate-900",
    category: "development",
    fields: [
      { key: "code", label: "Paste Code Block", placeholder: "function handleUpdate() { ... }", multiline: true },
      { key: "language", label: "Language", placeholder: "e.g. TypeScript, Python" },
      { key: "focus", label: "Focus", placeholder: "e.g. Security, performance" },
    ],
    help: "AI will break down each logical block and provide a 'Human Readable' explanation."
  }
] as const;

type ToolId = (typeof TOOLS)[number]["id"];

// ── Markdown Renderer (unchanged) ────────────────────────────────────────────

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let key = 0;
  let inCodeBlock = false;
  let codeContent = "";
  let codeLang = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        out.push(
          <div key={key++} className="my-6 overflow-hidden rounded-2xl bg-[#062e39] shadow-xl ring-1 ring-black/5">
            {codeLang && <div className="bg-black/20 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white/50 border-b border-white/5">{codeLang}</div>}
            <pre className="p-4 overflow-x-auto text-sm text-white/90 font-mono leading-relaxed"><code>{codeContent.trimEnd()}</code></pre>
          </div>
        );
        inCodeBlock = false;
        codeContent = "";
        codeLang = "";
      } else {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent += line + "\n";
      continue;
    }

    if (line.startsWith("### ")) {
      out.push(<h3 key={key++} className="text-xl font-bold text-[#062e39] mt-8 mb-4 tracking-tight">{line.slice(4)}</h3>);
    } else if (line.startsWith("## ")) {
      out.push(<h2 key={key++} className="text-2xl font-bold text-[#062e39] mt-10 mb-5 tracking-tight">{line.slice(3)}</h2>);
    } else if (line.startsWith("**") && line.endsWith("**")) {
      out.push(<p key={key++} className="font-bold text-[#062e39] text-base mb-2">{line.slice(2, -2)}</p>);
    } else if (line.match(/^\d+\.\s/)) {
      out.push(<p key={key++} className="text-base text-slate-600 leading-relaxed pl-1 mb-3">{line}</p>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      out.push(
        <div key={key++} className="flex gap-3 text-base text-slate-600 leading-relaxed mb-3">
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#fd5523]" />
          <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} />
        </div>
      );
    } else if (line.startsWith("> ")) {
      out.push(
        <blockquote key={key++} className="border-l-4 border-[#fd5523] pl-6 py-1 my-6 text-lg italic text-slate-600 bg-[#fff6ee]/50 rounded-r-2xl">
          {line.slice(2)}
        </blockquote>
      );
    } else if (line.trim() === "") {
      out.push(<div key={key++} className="h-4" />);
    } else {
      out.push(
        <p
          key={key++}
          className="text-base text-slate-600 leading-relaxed mb-4"
          dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/`(.*?)`/g, "<code class='bg-[#fff6ee] px-2 py-0.5 rounded-lg text-[#fd5523] text-sm font-mono'>$1</code>") }}
        />
      );
    }
  }
  return out;
}

// ── Component ─────────────────────────────────────────────────────────────────

type HistoryItem = { id: string; toolId: ToolId; inputs: Record<string, string>; output: string; timestamp: number };

export function PracticeStudio({
  lessonTitle,
  onClose,
  initialTool,
  exerciseContext,
  onSelectOutput,
}: PracticeStudioProps) {
  const [selectedTool, setSelectedTool] = useState<ToolId>((initialTool as ToolId) || "prompt_optimizer");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showContext, setShowContext] = useState(!!exerciseContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // closed by default on mobile
  const [activeTab, setActiveTab] = useState<"tools" | "history">("tools");
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const outputRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const tool = TOOLS.find((t) => t.id === selectedTool)!;

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem(`zed-studio-history-${lessonTitle}`);
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch {}
    }
  }, [lessonTitle]);

  // Save history on change
  useEffect(() => {
    localStorage.setItem(`zed-studio-history-${lessonTitle}`, JSON.stringify(history));
  }, [history, lessonTitle]);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Keyboard shortcut
  const handleRunRef = useRef(handleRun);
  handleRunRef.current = handleRun;
  
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleRunRef.current();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function setField(key: string, value: string) {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  async function handleRun() {
    if (!inputs[tool.fields[0].key]?.trim()) {
      toast.error(`Please provide a ${tool.fields[0].label} to start.`);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setOutput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/practice-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: selectedTool, inputs }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        toast.error("Generation failed. Please try again.");
        setLoading(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setOutput(accumulated);
      }

      if (accumulated) {
        setHistory(prev => [{
          id: Date.now().toString(),
          toolId: selectedTool,
          inputs: { ...inputs },
          output: accumulated,
          timestamp: Date.now()
        }, ...prev].slice(0, 50));
      }
    } catch (e: unknown) {
      if ((e as Error).name !== "AbortError") {
        toast.error("Connection failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleReset() {
    if (confirm("Are you sure you want to clear your current progress?")) {
      abortRef.current?.abort();
      setOutput("");
      setInputs({});
      setLoading(false);
    }
  }

  // ── Mobile-first layout ─────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#f8fafc] animate-in fade-in zoom-in-95 duration-300">
      
      {/* ── Compact Header ── */}
      <header className="flex h-14 sm:h-16 shrink-0 items-center justify-between border-b border-slate-200/60 bg-white/90 backdrop-blur-xl px-3 sm:px-5">
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#062e39] shadow-md">
              <Sparkles className="h-5 w-5 text-[#fd5523]" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#062e39] leading-none">Practice Studio</p>
              <p className="text-[10px] text-slate-400 truncate max-w-[180px]">{lessonTitle}</p>
            </div>
          </div>
          {/* Mobile title */}
          <div className="sm:hidden">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#fd5523]" />
              <span className="text-sm font-bold text-[#062e39] truncate max-w-[150px]">Studio</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {exerciseContext && (
            <Button
              variant={showContext ? "default" : "ghost"}
              size="sm"
              onClick={() => setShowContext(!showContext)}
              className={cn(
                "rounded-xl font-bold text-[10px] uppercase tracking-wider h-8 px-3",
                showContext ? "bg-[#fd5523] text-white" : "text-slate-400 hover:text-[#062e39] hover:bg-slate-100"
              )}
            >
              <Info className="h-3.5 w-3.5 mr-1" />
              Brief
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHelp(!showHelp)}
            className="h-8 w-8 p-0 rounded-full text-slate-400 hover:text-[#062e39] hover:bg-slate-100"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 border-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* ── Main Canvas: Mobile-first vertical stack, desktop side-by-side ── */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Exercise Brief (Slide-over on mobile, sidebar on desktop) */}
        {showContext && exerciseContext && (
          <>
            {/* Mobile backdrop */}
            <div 
              className="fixed inset-0 bg-black/20 z-40 md:hidden backdrop-blur-sm"
              onClick={() => setShowContext(false)}
            />
            <aside className={cn(
              "fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white border-l border-slate-200 shadow-2xl animate-in slide-in-from-right duration-300 md:relative md:inset-auto md:z-0 md:shadow-none md:w-72 md:block",
              showContext ? "block" : "hidden"
            )}>
              <div className="flex flex-col h-full">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-[#062e39]">Exercise Brief</h3>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setShowContext(false)} className="md:hidden">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Objective</p>
                    <p className="text-sm leading-relaxed text-slate-600">{exerciseContext.brief}</p>
                  </div>
                  {exerciseContext.instructions?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Steps</p>
                      <div className="space-y-2">
                        {exerciseContext.instructions.map((step, i) => (
                          <div key={i} className="flex gap-2 text-sm text-slate-600">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-700">
                              {i + 1}
                            </span>
                            <span className="leading-relaxed">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </>
        )}

        {/* Help Overlay (kept fullscreen) */}
        {showHelp && (
          <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm p-8 flex items-center justify-center animate-in fade-in duration-300">
            <div className="max-w-lg w-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[#062e39]">Studio Guide</h2>
                <Button variant="ghost" onClick={() => setShowHelp(false)} className="rounded-full">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="bg-[#fff6ee] p-6 rounded-[2rem] border-2 border-[#fd5523]/10">
                <h3 className="text-lg font-bold text-[#062e39] mb-3 flex items-center gap-2">
                  <Info className="h-4 w-4 text-[#fd5523]" />
                  How to use {tool.label}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">{tool.help}</p>
                <ul className="space-y-2">
                  {["Autosaves your work as you type", "Use 'Parameters' for fine-tuned MJ control", "Markdown output ready for copy-pasting"].map(t => (
                    <li key={t} className="flex items-center gap-2 text-xs font-medium text-[#062e39]">
                      <Check className="h-3.5 w-3.5 text-green-500" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <Button onClick={() => setShowHelp(false)} className="w-full mt-6 py-6 rounded-2xl bg-[#062e39] text-white font-bold">
                Got it, let's build
              </Button>
            </div>
          </div>
        )}

        {/* ── Left Sidebar: Tool Library / History (overlay on mobile, static on desktop) ── */}
        <>
          {/* Mobile sidebar backdrop */}
          {isSidebarOpen && (
            <div 
              className="fixed inset-0 bg-black/20 z-40 md:hidden backdrop-blur-sm"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}
          <aside className={cn(
            "fixed inset-y-0 left-0 z-50 w-80 bg-white border-r border-slate-200 shadow-2xl flex flex-col transition-transform duration-300 md:relative md:inset-auto md:z-0 md:shadow-none md:w-72 md:translate-x-0",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Zap className="h-4 w-4" /> Studio
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setIsSidebarOpen(false)} className="md:hidden">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 pb-2">
              <div className="flex p-1 bg-slate-100 rounded-xl">
                <button 
                  onClick={() => setActiveTab("tools")}
                  className={cn("flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all", activeTab === "tools" ? "bg-white text-[#062e39] shadow-sm" : "text-slate-400")}
                >
                  Tools
                </button>
                <button 
                  onClick={() => setActiveTab("history")}
                  className={cn("flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all", activeTab === "history" ? "bg-white text-[#062e39] shadow-sm" : "text-slate-400")}
                >
                  History
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
              {activeTab === "tools" ? TOOLS.map((t) => {
                const Icon = t.icon;
                const active = t.id === selectedTool;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTool(t.id);
                      if (window.innerWidth < 768) setIsSidebarOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-start gap-3 rounded-xl p-3 text-left transition-all border-2",
                      active 
                        ? "bg-[#062e39] border-[#062e39] text-white shadow-lg" 
                        : "bg-white border-slate-50 hover:border-slate-200 text-slate-400"
                    )}
                  >
                    <div className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                      active ? "bg-[#fd5523]" : "bg-slate-50"
                    )}>
                      <Icon className={cn("h-4 w-4", active ? "text-white" : "text-slate-400")} />
                    </div>
                    <div className="min-w-0">
                      <p className={cn("text-xs font-bold leading-tight", active ? "text-white" : "text-[#062e39]")}>{t.label}</p>
                      <p className={cn("text-[10px] leading-snug line-clamp-1", active ? "text-white/60" : "text-slate-400")}>{t.desc}</p>
                    </div>
                  </button>
                );
              }) : (
                history.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 mt-8">No history yet.</p>
                ) : history.map(item => {
                  const hTool = TOOLS.find(t => t.id === item.toolId);
                  const HIcon = hTool?.icon || Zap;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelectedTool(item.toolId);
                        setInputs(item.inputs);
                        setOutput(item.output);
                        if (window.innerWidth < 768) setIsSidebarOpen(false);
                      }}
                      className="w-full flex items-start gap-2 p-2 rounded-xl border border-slate-100 bg-white hover:border-[#fd5523]/30 hover:bg-[#fff6ee] transition-all text-left"
                    >
                      <div className="h-6 w-6 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                        <HIcon className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#062e39] truncate">{hTool?.label || "Tool"}</p>
                        <p className="text-[10px] text-slate-400 truncate">{new Date(item.timestamp).toLocaleTimeString()}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>
        </>

        {/* ── Main Work Area (Inputs + Output stacked on mobile) ── */}
        <div className="flex-1 flex flex-col md:flex-row min-w-0 overflow-hidden">
          
          {/* Input Panel */}
          <div className="w-full md:w-[400px] shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-slate-200/60 bg-white overflow-y-auto">
            <div className="flex-1 p-4 sm:p-6 space-y-4">
              <div className="animate-in fade-in">
                <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2", tool.color)}>
                  <Zap className="h-3 w-3" />
                  {tool.category}
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-[#062e39] tracking-tight">{tool.label}</h2>
                <p className="text-sm text-slate-500 mt-1">{tool.desc}</p>
              </div>

              <div className="space-y-4">
                {tool.fields.map((field, idx) => (
                  <div key={field.key} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                    <label className="block text-sm font-bold text-[#062e39] mb-1.5">
                      {field.label}
                    </label>
                    {"multiline" in field && field.multiline ? (
                      <textarea
                        rows={4}
                        value={inputs[field.key] ?? ""}
                        onChange={(e) => setField(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full resize-none rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-sm text-[#062e39] placeholder:text-slate-300 focus:border-[#fd5523]/30 focus:bg-white focus:outline-none transition-all"
                      />
                    ) : (
                      <input
                        type="text"
                        value={inputs[field.key] ?? ""}
                        onChange={(e) => setField(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full h-12 rounded-xl border-2 border-slate-100 bg-slate-50 px-4 text-sm text-[#062e39] placeholder:text-slate-300 focus:border-[#fd5523]/30 focus:bg-white focus:outline-none transition-all"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/50">
              <Button
                onClick={handleRun}
                disabled={loading}
                className="w-full py-6 rounded-2xl bg-[#fd5523] text-white text-base font-bold hover:bg-[#ef4a16] shadow-xl shadow-[#fd5523]/20 transition-all active:scale-[0.98] group"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-3" />
                ) : (
                  <Sparkles className="h-5 w-5 text-[#fd8d69] mr-2 group-hover:rotate-12 transition-transform" />
                )}
                {loading ? "Synthesizing..." : "Generate Output"}
              </Button>
            </div>
          </div>

          {/* Output Panel */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafc]">
            {/* Output header bar (compact on mobile) */}
            <div className="h-12 shrink-0 flex items-center justify-between px-4 sm:px-6 bg-white border-b border-slate-200/60">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Output</span>
              {output && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span className="hidden sm:inline">Reset</span>
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#062e39] text-white text-[10px] font-bold hover:bg-[#0a4055] transition-all shadow-md"
                  >
                    {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                    <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
                  </button>
                  {onSelectOutput && (
                    <button
                      onClick={() => onSelectOutput(selectedTool, inputs, output)}
                      className="flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-700 transition-all shadow-md"
                    >
                      <Check className="h-3 w-3" />
                      <span className="hidden sm:inline">Use Result</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Output Display */}
            <div ref={outputRef} className="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-hide">
              {!output && !loading ? (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-xs mx-auto">
                  <div className="h-16 w-16 rounded-2xl bg-white shadow-lg flex items-center justify-center mb-4 animate-bounce duration-[3000ms]">
                    <Zap className="h-8 w-8 text-[#fd5523]/20" />
                  </div>
                  <h3 className="text-lg font-bold text-[#062e39] mb-2">Ready to Build</h3>
                  <p className="text-sm text-slate-500 mb-6">Fill in the fields and tap Generate.</p>
                  <div className="space-y-2 text-left w-full">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Tips</p>
                    {[
                      "Work is autosaved to your history.",
                      "Use the Help icon for guidance.",
                      "Combine tools for advanced workflows."
                    ].map((tip, i) => (
                      <div key={i} className="flex items-start gap-2 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                        <div className="h-1.5 w-1.5 rounded-full bg-[#fd5523] mt-1.5 shrink-0" />
                        <p className="text-xs font-medium text-[#062e39]/70">{tip}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : loading && !output ? (
                <div className="h-full flex flex-col items-center justify-center gap-4">
                  <div className="relative">
                    <div className="h-16 w-16 rounded-2xl bg-white shadow-lg flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-[#fd5523]" />
                    </div>
                    <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[#fd5523] animate-ping" />
                  </div>
                  <p className="text-sm font-bold text-[#062e39]">AI is Synthesizing...</p>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto animate-in fade-in duration-500">
                  <div className="bg-white rounded-2xl p-5 sm:p-8 shadow-xl border border-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#fd5523] to-[#fd8d69]" />
                    {renderMarkdown(output)}
                    {loading && (
                      <div className="mt-4 flex items-center gap-2 text-[#fd5523] font-bold text-xs animate-pulse">
                        <div className="h-1.5 w-1.5 rounded-full bg-[#fd5523] animate-ping" />
                        Thinking...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}