"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface PromptTemplateProps {
  title: string;
  prompt: string;
  description?: string;
}

export function PromptTemplate({ title, prompt, description }: PromptTemplateProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
      <div className="border-b border-blue-100 bg-blue-50 px-4 py-3">
        <h4 className="text-sm font-semibold text-blue-900">{title}</h4>
        {description && <p className="mt-1 text-xs text-blue-700/80">{description}</p>}
      </div>
      <div className="relative p-4">
        <pre className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 font-mono bg-slate-50 p-3 rounded-xl border border-slate-100">
          {prompt}
        </pre>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCopy}
          className="absolute right-6 top-6 h-8 w-8 rounded-lg border-blue-200 bg-white p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Prompt Template</span>
        <Button variant="ghost" size="sm" className="h-7 text-xs font-medium text-blue-600 hover:bg-blue-100/50">
          Use in Studio
        </Button>
      </div>
    </div>
  );
}
