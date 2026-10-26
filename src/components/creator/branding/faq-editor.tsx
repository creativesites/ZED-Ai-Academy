"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, HelpCircle, ChevronDown, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface FAQItem {
  question: string;
  answer: string;
}

interface FAQEditorProps {
  faqs: FAQItem[];
  onChange: (faqs: FAQItem[]) => void;
  academyName: string;
}

export function FAQEditor({ faqs = [], onChange, academyName }: FAQEditorProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [isGenerating, setIsGenerating] = useState(false);

  const addFAQ = () => {
    const updated = [...faqs, { question: "New Question", answer: "Provide a helpful, clear answer here." }];
    onChange(updated);
    setOpenIndex(updated.length - 1);
  };

  const removeFAQ = (index: number) => {
    const updated = [...faqs];
    updated.splice(index, 1);
    onChange(updated);
    if (openIndex === index) setOpenIndex(null);
  };

  const updateFAQ = (index: number, field: "question" | "answer", value: string) => {
    const updated = [...faqs];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const generateDefaultFAQs = () => {
    const defaults: FAQItem[] = [
      {
        question: `How do I enroll in ${academyName || "this academy"}?`,
        answer: "Select your desired course or program above, click 'Enroll Now', and create your student account. You'll get immediate access to the classroom materials.",
      },
      {
        question: "Are the sessions live or self-paced?",
        answer: "We offer both! You can participate in scheduled live interactive workshops and access our comprehensive self-paced library 24/7.",
      },
      {
        question: "Will I receive an accredited certificate?",
        answer: "Yes, upon completing all modules, assignments, and passing the final assessment, you will be awarded a verified, shareable digital certificate.",
      },
      {
        question: "What equipment or prerequisites do I need?",
        answer: "All you need is a laptop or smartphone with an internet connection. Any specialized tools or resources are provided inside the curriculum.",
      },
    ];
    onChange(defaults);
    toast.success("Added recommended FAQs!");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
            <HelpCircle className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-black text-[#062e39] uppercase tracking-wide">Frequently Asked Questions</h4>
            <p className="text-[11px] text-slate-400">Reassure prospective students and reduce inquiries.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {faqs.length === 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={generateDefaultFAQs}
              className="rounded-xl text-xs font-bold border-indigo-200 text-indigo-600 hover:bg-indigo-50"
            >
              <Sparkles className="h-3 w-3 mr-1" /> Use Starter FAQs
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={addFAQ}
            className="rounded-xl text-xs font-bold bg-[#062e39] text-white hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Question
          </Button>
        </div>
      </div>

      {faqs.length === 0 ? (
        <div className="p-8 rounded-2xl border border-dashed border-slate-200 text-center space-y-3 bg-slate-50/50">
          <HelpCircle className="h-8 w-8 text-slate-300 mx-auto" />
          <div>
            <p className="text-xs font-bold text-slate-600">No FAQs added yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">FAQs help convert undecided visitors by addressing their doubts.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={generateDefaultFAQs}
            className="rounded-xl text-xs font-bold text-[#fd5523] border-[#fd5523]/30 bg-white"
          >
            Add Starter FAQs
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden transition-all"
            >
              <div
                className="p-3.5 sm:p-4 flex items-center justify-between cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-colors"
                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-[10px] font-black font-mono text-slate-400 uppercase">Q{idx + 1}</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                    {faq.question || "Untitled Question"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 ml-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFAQ(idx);
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                    title="Delete Question"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                      openIndex === idx ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </div>

              {openIndex === idx && (
                <div className="p-4 space-y-3 border-t border-slate-100 bg-white animate-in fade-in duration-200">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Question</Label>
                    <Input
                      value={faq.question}
                      onChange={(e) => updateFAQ(idx, "question", e.target.value)}
                      placeholder="e.g. Do I get lifetime access?"
                      className="h-10 rounded-xl text-xs font-bold text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Answer</Label>
                    <textarea
                      rows={3}
                      value={faq.answer}
                      onChange={(e) => updateFAQ(idx, "answer", e.target.value)}
                      placeholder="Provide a clear, reassuring answer..."
                      className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-200 resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
