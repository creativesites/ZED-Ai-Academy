"use client";

import { useState } from "react";
import { CheckCircle2, HelpCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface KnowledgeCheckProps {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export function KnowledgeCheck({ question, options, correctIndex, explanation }: KnowledgeCheckProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const isCorrect = selected === correctIndex;

  return (
    <div className="my-4 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <HelpCircle className="h-4 w-4 text-amber-500" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Quick Check</span>
      </div>
      
      <h4 className="text-sm font-bold text-slate-900 leading-relaxed mb-4">{question}</h4>
      
      <div className="space-y-2">
        {options.map((option, idx) => (
          <button
            key={idx}
            disabled={submitted}
            onClick={() => setSelected(idx)}
            className={`flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left text-sm transition-all border ${
              selected === idx 
                ? submitted
                  ? isCorrect 
                    ? "bg-green-50 border-green-200 text-green-900" 
                    : "bg-red-50 border-red-200 text-red-900"
                  : "bg-blue-50 border-blue-600 text-blue-900 shadow-sm"
                : "bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <div className="mt-0.5 shrink-0 flex h-4 w-4 items-center justify-center rounded-full border border-current font-bold text-[10px]">
              {String.fromCharCode(65 + idx)}
            </div>
            <span className="flex-1">{option}</span>
            {submitted && idx === correctIndex && !isCorrect && (
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            )}
          </button>
        ))}
      </div>

      {!submitted ? (
        <Button 
          disabled={selected === null}
          onClick={() => setSubmitted(true)}
          className="mt-5 w-full rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400"
        >
          Check Answer
        </Button>
      ) : (
        <div className={`mt-5 rounded-xl p-4 text-xs leading-relaxed ${
          isCorrect ? "bg-green-50 text-green-900 border border-green-100" : "bg-red-50 text-red-900 border border-red-100"
        }`}>
          <div className="flex items-center gap-2 font-bold mb-1">
            {isCorrect ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
            {isCorrect ? "Correct!" : "Not quite."}
          </div>
          {explanation && <p className="opacity-80">{explanation}</p>}
        </div>
      )}
    </div>
  );
}
