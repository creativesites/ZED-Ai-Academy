"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CodeSnippetProps {
  code: string;
  language?: string;
  title?: string;
}

export function CodeSnippet({ code, language, title }: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-lg">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-800/50 px-4 py-2">
        <div className="flex items-center gap-2">
          {language && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded">
              {language}
            </span>
          )}
          {title && <span className="text-xs font-medium text-slate-300">{title}</span>}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCopy}
          className="h-7 text-slate-400 hover:text-white hover:bg-slate-700"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span className="ml-1.5 text-[10px]">{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
      <div className="p-4 overflow-x-auto">
        <pre className="text-xs leading-relaxed text-slate-100 font-mono">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
