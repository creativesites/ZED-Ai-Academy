"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Star, Quote, Sparkles } from "lucide-react";
import { toast } from "sonner";

export interface TestimonialItem {
  name: string;
  role: string;
  content: string;
  rating: number;
}

interface TestimonialEditorProps {
  testimonials: TestimonialItem[];
  onChange: (testimonials: TestimonialItem[]) => void;
  academyName: string;
}

export function TestimonialEditor({
  testimonials = [],
  onChange,
  academyName,
}: TestimonialEditorProps) {
  const addTestimonial = () => {
    const updated = [
      ...testimonials,
      {
        name: "Student Name",
        role: "Graduate / Cohort 2026",
        content: `Learning with ${academyName || "this academy"} completely transformed my confidence and practical abilities.`,
        rating: 5,
      },
    ];
    onChange(updated);
  };

  const removeTestimonial = (index: number) => {
    const updated = [...testimonials];
    updated.splice(index, 1);
    onChange(updated);
  };

  const updateTestimonial = (index: number, field: keyof TestimonialItem, value: any) => {
    const updated = [...testimonials];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const generateDefaultTestimonials = () => {
    const defaults: TestimonialItem[] = [
      {
        name: "Chanda Mwila",
        role: "Data Analyst & Alum",
        content: `The direct guidance and hands-on exercises at ${academyName || "Zed AI Academy"} helped me transition into a high-paying tech role within 3 months.`,
        rating: 5,
      },
      {
        name: "Blessing Tembo",
        role: "Secondary School Scholar",
        content: "The live interactive sessions and personalized feedback gave me the exact confidence I needed to score distinction marks.",
        rating: 5,
      },
      {
        name: "Kabaso Musonda",
        role: "Founder & Creator",
        content: "Practical, no-fluff learning. The curriculum is built for real-world impact rather than just theory.",
        rating: 5,
      },
    ];
    onChange(defaults);
    toast.success("Added starter testimonials!");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
            <Quote className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-black text-[#062e39] uppercase tracking-wide">Student Testimonials & Reviews</h4>
            <p className="text-[11px] text-slate-400">Social proof is the #1 driver of course enrollment.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {testimonials.length === 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={generateDefaultTestimonials}
              className="rounded-xl text-xs font-bold border-amber-200 text-amber-700 hover:bg-amber-50"
            >
              <Sparkles className="h-3 w-3 mr-1" /> Use Starter Reviews
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={addTestimonial}
            className="rounded-xl text-xs font-bold bg-[#062e39] text-white hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Review
          </Button>
        </div>
      </div>

      {testimonials.length === 0 ? (
        <div className="p-8 rounded-2xl border border-dashed border-slate-200 text-center space-y-3 bg-slate-50/50">
          <Quote className="h-8 w-8 text-slate-300 mx-auto" />
          <div>
            <p className="text-xs font-bold text-slate-600">No student reviews added</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Show prospective students real success stories.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={generateDefaultTestimonials}
            className="rounded-xl text-xs font-bold text-[#fd5523] border-[#fd5523]/30 bg-white"
          >
            Add Starter Reviews
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {testimonials.map((t, idx) => (
            <div
              key={idx}
              className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 bg-white shadow-sm space-y-3 relative group"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1 text-amber-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => updateTestimonial(idx, "rating", star)}
                      className="hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`h-4 w-4 ${
                          star <= (t.rating || 5) ? "fill-amber-400 text-amber-400" : "text-slate-200"
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-[10px] font-bold text-slate-400 ml-1.5 font-mono">{t.rating || 5}.0</span>
                </div>

                <button
                  type="button"
                  onClick={() => removeTestimonial(idx)}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                  title="Remove review"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Student Name</Label>
                  <Input
                    value={t.name}
                    onChange={(e) => updateTestimonial(idx, "name", e.target.value)}
                    placeholder="e.g. Mwila Chanda"
                    className="h-10 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Role / Credential</Label>
                  <Input
                    value={t.role}
                    onChange={(e) => updateTestimonial(idx, "role", e.target.value)}
                    placeholder="e.g. Alumni · Class of 2026"
                    className="h-10 rounded-xl text-xs font-medium text-slate-600"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Review Quote</Label>
                <textarea
                  rows={2}
                  value={t.content}
                  onChange={(e) => updateTestimonial(idx, "content", e.target.value)}
                  placeholder="What did they achieve or love about your academy?"
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-200 resize-none"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
