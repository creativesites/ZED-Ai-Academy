"use client";

import { useState, useRef, useEffect } from "react";
import {
  X, Sparkles, Loader2, ChevronRight, Wand2,
  Copy, Check, RotateCcw, Zap, Brain, MessageSquare,
  Layout, Code, Info, HelpCircle, History
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PracticeStudioProps {
  lessonTitle: string;
  onClose: () => void;
}

// ── Tool definitions ──────────────────────────────────────────────────────────

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
      { key: "context", label: "Context (Optional)", placeholder: "e.g. For a LinkedIn post, for a coding project..." },
      { key: "tone", label: "Tone / Style", placeholder: "e.g. Professional, authoritative, creative..." },
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
      { key: "subject", label: "Subject", placeholder: "e.g. a Zambian woman at a market stall, late afternoon", multiline: true },
      { key: "style", label: "Style", placeholder: "e.g. cinematic photography, film grain, 35mm" },
      { key: "lighting", label: "Lighting", placeholder: "e.g. soft side lighting, dappled sunlight" },
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
      { key: "goal", label: "Primary Goal", placeholder: "e.g. Save 2 hours daily on triaging" },
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
      { key: "topic", label: "What is the post about?", placeholder: "e.g. New ChatGPT feature for data analysis", multiline: true },
      { key: "audience", label: "Who are you talking to?", placeholder: "e.g. Solopreneurs, developers..." },
      { key: "platform", label: "Platform", placeholder: "e.g. X/Twitter, LinkedIn, TikTok" },
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
      { key: "language", label: "Language", placeholder: "e.g. TypeScript, Python, Rust" },
      { key: "focus", label: "Focus", placeholder: "e.g. Security, performance, readability" },
    ],
    help: "AI will break down each logical block and provide a 'Human Readable' explanation."
  }
] as const;

type ToolId = (typeof TOOLS)[number]["id"];

// ── Markdown Renderer ─────────────────────────────────────────────────────────

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
        // Close block
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
        // Open block
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

export function PracticeStudio({ lessonTitle, onClose }: PracticeStudioProps) {
  const [selectedTool, setSelectedTool] = useState<ToolId>("prompt_optimizer");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#f8fafc] animate-in fade-in zoom-in-95 duration-300">
      
      {/* ── Immersive Header ── */}
      <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200/60 bg-white/80 backdrop-blur-xl px-8">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <History className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-[#062e39] shadow-xl shadow-[#062e39]/10">
              <Sparkles className="h-6 w-6 text-[#fd5523]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-[#062e39] tracking-tight">Practice Studio</span>
                <span className="px-2 py-0.5 rounded-full bg-[#fff6ee] text-[#fd5523] text-[10px] font-bold uppercase tracking-widest ring-1 ring-[#fd5523]/10">Pro Mode</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
                <span className="text-[#062e39]/60 truncate max-w-[200px]">{lessonTitle}</span>
                <span>·</span>
                <span>{tool.label}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHelp(!showHelp)}
            className="rounded-full text-slate-400 hover:text-[#062e39] hover:bg-slate-100"
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
          <Button
            size="sm"
            onClick={onClose}
            className="h-10 w-10 p-0 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 border-0"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* ── Studio Canvas ── */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Help Overlay */}
        {showHelp && (
          <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm p-12 flex items-center justify-center animate-in fade-in duration-300">
            <div className="max-w-2xl w-full">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-bold text-[#062e39]">Studio Guide</h2>
                <Button variant="ghost" onClick={() => setShowHelp(false)} className="rounded-full">
                  <X className="h-6 w-6" />
                </Button>
              </div>
              <div className="grid gap-8">
                <div className="bg-[#fff6ee] p-8 rounded-[2.5rem] border-2 border-[#fd5523]/10">
                   <h3 className="text-xl font-bold text-[#062e39] mb-4 flex items-center gap-2">
                     <Info className="h-5 w-5 text-[#fd5523]" />
                     How to use {tool.label}
                   </h3>
                   <p className="text-slate-600 leading-relaxed mb-6">{tool.help}</p>
                   <ul className="space-y-3">
                     {["Autosaves your work as you type", "Use 'Parameters' for fine-tuned MJ control", "Markdown output ready for copy-pasting"].map(t => (
                       <li key={t} className="flex items-center gap-3 text-sm font-medium text-[#062e39]">
                          <Check className="h-4 w-4 text-green-500" />
                          {t}
                       </li>
                     ))}
                   </ul>
                </div>
                <Button onClick={() => setShowHelp(false)} className="py-8 rounded-[2rem] bg-[#062e39] text-white font-bold text-lg">
                  Got it, let's build
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Left Sidebar: Tool Library / History ── */}
        <aside className={cn(
          "shrink-0 overflow-y-auto border-r border-slate-200/60 bg-white transition-all duration-500 ease-in-out scrollbar-hide flex flex-col absolute inset-y-0 left-0 z-40 md:relative",
          isSidebarOpen ? "w-80 translate-x-0" : "w-80 -translate-x-full md:w-0 md:translate-x-0 border-0"
        )}>
          <div className="p-6 pb-4 shrink-0">
            <div className="flex p-1 bg-slate-100 rounded-2xl mb-6">
              <button 
                onClick={() => setActiveTab("tools")}
                className={cn("flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all", activeTab === "tools" ? "bg-white text-[#062e39] shadow-sm" : "text-slate-400 hover:text-slate-600")}
              >
                Tools
              </button>
              <button 
                onClick={() => setActiveTab("history")}
                className={cn("flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all", activeTab === "history" ? "bg-white text-[#062e39] shadow-sm" : "text-slate-400 hover:text-slate-600")}
              >
                History
              </button>
            </div>
            {activeTab === "tools" && (
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Tool Library</h3>
                <span className="bg-slate-100 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full">{TOOLS.length}</span>
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-2">
            {activeTab === "tools" ? TOOLS.map((t) => {
              const Icon = t.icon;
              const active = t.id === selectedTool;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTool(t.id)}
                  className={cn(
                    "w-full flex items-start gap-4 rounded-[1.5rem] p-4 text-left transition-all border-2",
                    active 
                      ? "bg-[#062e39] border-[#062e39] text-white shadow-xl shadow-[#062e39]/10 scale-[1.02]" 
                      : "bg-white border-slate-50 hover:border-slate-200 text-slate-400 hover:text-slate-600"
                  )}
                >
                  <div className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                    active ? "bg-[#fd5523]" : "bg-slate-50"
                  )}>
                    <Icon className={cn("h-5 w-5", active ? "text-white" : "text-slate-400")} />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className={cn("text-sm font-bold leading-tight mb-1", active ? "text-white" : "text-[#062e39]")}>{t.label}</p>
                    <p className={cn("text-[11px] leading-snug line-clamp-2", active ? "text-white/60" : "text-slate-400")}>
                      {t.desc}
                    </p>
                  </div>
                </button>
              );
            }) : (
              <div className="space-y-3">
                {history.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 mt-10">No history yet.</p>
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
                      className="w-full flex items-start gap-3 p-3 rounded-2xl border border-slate-100 bg-white hover:border-[#fd5523]/30 hover:bg-[#fff6ee] transition-all text-left group"
                    >
                      <div className="h-8 w-8 rounded-lg bg-slate-50 group-hover:bg-white flex items-center justify-center shrink-0">
                        <HIcon className="h-4 w-4 text-slate-400 group-hover:text-[#fd5523]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#062e39] truncate">{hTool?.label || "Tool"}</p>
                        <p className="text-[10px] text-slate-400 truncate">{new Date(item.timestamp).toLocaleTimeString()}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {activeTab === "tools" && (
            <div className="mt-auto p-6 shrink-0">
              <div className="p-6 rounded-[2rem] bg-indigo-50/50 border border-indigo-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-2">Pro Tip</p>
                <p className="text-xs text-indigo-600 leading-relaxed font-medium">
                  Combine the Prompt Optimizer with Midjourney v6 for incredible visual consistency.
                </p>
              </div>
            </div>
          )}
        </aside>

        {/* Overlay for mobile sidebar */}
        {isSidebarOpen && (
          <div 
            className="absolute inset-0 bg-black/20 z-30 md:hidden backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* ── Main Canvas: Workbench ── */}
        <main className="flex-1 flex flex-col md:flex-row min-w-0 bg-[#f8fafc]">
          
          {/* Workbench Controls */}
          <div className="w-full md:w-[450px] shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-slate-200/60 bg-white">
            <div className="flex-1 overflow-y-auto p-10 space-y-8 scrollbar-hide">
              <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                <div className={cn("inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4", tool.color)}>
                  <Zap className="h-3 w-3" />
                  {tool.category} Tool
                </div>
                <h2 className="text-3xl font-extrabold text-[#062e39] tracking-tight">{tool.label}</h2>
                <p className="text-slate-500 mt-2 text-lg leading-relaxed">{tool.desc}</p>
              </div>

              <div className="space-y-6">
                {tool.fields.map((field, idx) => (
                  <div key={field.key} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                    <label className="block text-sm font-bold text-[#062e39] mb-3 ml-1">
                      {field.label}
                    </label>
                    {"multiline" in field && field.multiline ? (
                      <textarea
                        rows={5}
                        value={inputs[field.key] ?? ""}
                        onChange={(e) => setField(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full resize-none rounded-[1.5rem] border-2 border-slate-100 bg-slate-50 px-5 py-4 text-base text-[#062e39] placeholder:text-slate-300 focus:border-[#fd5523]/30 focus:bg-white focus:outline-none transition-all"
                      />
                    ) : (
                      <input
                        type="text"
                        value={inputs[field.key] ?? ""}
                        onChange={(e) => setField(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full h-14 rounded-[1.5rem] border-2 border-slate-100 bg-slate-50 px-5 text-base text-[#062e39] placeholder:text-slate-300 focus:border-[#fd5523]/30 focus:bg-white focus:outline-none transition-all"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 bg-slate-50/50">
              <Button
                onClick={handleRun}
                disabled={loading}
                className="w-full py-8 rounded-[2.5rem] bg-[#fd5523] text-white text-lg font-bold hover:bg-[#ef4a16] shadow-2xl shadow-[#fd5523]/20 transition-all hover:scale-[1.02] active:scale-95 group"
              >
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin mr-3" />
                ) : (
                  <Sparkles className="h-6 w-6 text-[#fd8d69] mr-3 group-hover:rotate-12 transition-transform" />
                )}
                {loading ? "Synthesizing..." : "Generate Output"}
                {!loading && <ChevronRight className="ml-2 h-5 w-5" />}
              </Button>
            </div>
          </div>

          {/* Workbench Output */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafc]">
            {/* Output Bar */}
            <div className="h-14 shrink-0 flex items-center justify-between px-8 bg-white border-b border-slate-200/60">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Workbench Output</span>
              {output && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-6 py-1.5 rounded-full bg-[#062e39] text-white text-xs font-bold hover:bg-[#0a4055] transition-all shadow-lg shadow-[#062e39]/10"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy Result"}
                  </button>
                </div>
              )}
            </div>

            {/* Output Display */}
            <div ref={outputRef} className="flex-1 overflow-y-auto p-12 scrollbar-hide">
              {!output && !loading ? (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                  <div className="h-24 w-24 rounded-[2.5rem] bg-white shadow-2xl shadow-slate-200/50 flex items-center justify-center mb-8 animate-bounce duration-[3000ms]">
                    <Zap className="h-10 w-10 text-[#fd5523]/20" />
                  </div>
                  <h3 className="text-2xl font-bold text-[#062e39] mb-4 tracking-tight">Synthesizer Active</h3>
                  <p className="text-slate-500 leading-relaxed mb-10">
                    Input your parameters on the left to generate premium AI content.
                  </p>

                  <div className="w-full space-y-4 text-left">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300 ml-4">Current Session Tips</p>
                    {[
                      "All work is automatically saved to your profile.",
                      "Use detailed descriptions for better MJ output.",
                      "Click the Help icon for tool-specific advice."
                    ].map((tip, i) => (
                      <div key={i} className="flex items-start gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm animate-in fade-in slide-in-from-right-4 duration-500" style={{ animationDelay: `${i * 150}ms` }}>
                        <div className="h-2 w-2 rounded-full bg-[#fd5523] mt-1.5 shrink-0" />
                        <p className="text-xs font-medium text-[#062e39]/70 leading-relaxed">{tip}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : loading && !output ? (
                <div className="h-full flex flex-col items-center justify-center gap-6">
                  <div className="relative">
                    <div className="h-20 w-20 rounded-[2rem] bg-white shadow-2xl flex items-center justify-center">
                       <Loader2 className="h-8 w-8 animate-spin text-[#fd5523]" />
                    </div>
                    <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-[#fd5523] animate-ping" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-[#062e39] tracking-tight">AI is Synthesizing</p>
                    <p className="text-sm text-slate-400 mt-1">Generating high-fidelity output...</p>
                  </div>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto animate-in fade-in duration-500">
                  <div className="bg-white rounded-[3rem] p-12 shadow-2xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#fd5523] to-[#fd8d69]" />
                    <div className="prose-container">
                      {renderMarkdown(output)}
                    </div>
                    {loading && (
                      <div className="mt-8 flex items-center gap-3 text-[#fd5523] font-bold text-sm animate-pulse">
                         <div className="h-2 w-2 rounded-full bg-[#fd5523] animate-ping" />
                         Thinking...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
