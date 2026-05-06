"use client";

import { useState } from "react";
import { CheckCircle, Code2, Sparkles } from "lucide-react";

export function AiPromptBlock({ content }: { content: Record<string, unknown> }) {
  const prompt = content.prompt as string;
  const tool = content.tool as string | undefined;
  const label = content.label as string | undefined;
  const [copied, setCopied] = useState(false);
  
  if (!prompt) return null;

  function handleCopy() {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-[2rem] border-2 border-[#fd5523]/20 bg-[#fff8f5] overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 bg-[#fd5523]/10 border-b border-[#fd5523]/15 gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#fd5523] shadow-md shadow-[#fd5523]/20">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#fd5523]">{label ?? "AI Prompt"}</p>
            {tool && <p className="text-xs font-bold text-slate-500">{tool}</p>}
          </div>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#fd5523] px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-[#ef4a16] active:scale-95 shadow-md shadow-[#fd5523]/20 w-full sm:w-auto"
        >
          {copied ? <CheckCircle className="h-3.5 w-3.5" /> : <Code2 className="h-3.5 w-3.5" />}
          {copied ? "Copied!" : "Copy Prompt"}
        </button>
      </div>
      <pre className="whitespace-pre-wrap p-6 text-sm leading-relaxed text-[#062e39] font-mono">{prompt}</pre>
    </div>
  );
}
