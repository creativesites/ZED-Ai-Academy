"use client";

import { useState } from "react";
import Link from "next/link";
import { createCourse } from "@/actions/courses";
import { CourseBlueprintAssistant } from "@/components/creator/course-blueprint-assistant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COURSE_CATEGORIES } from "@/lib/course-experience";
import { ArrowLeft, Briefcase, CircleDollarSign, Layers, Rocket, ShieldCheck } from "lucide-react";

type Blueprint = {
  title: string;
  description: string;
  category: string;
  level: "beginner" | "intermediate" | "advanced";
  price_type: "free" | "one_time" | "subscription_only" | "both";
  audience: string;
  quick_win: string;
  capstone: string;
  module_outline: string[];
};

export function NewCourseForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState("");
  const [priceType, setPriceType] = useState<Blueprint["price_type"]>("free");
  const [priceAmount, setPriceAmount] = useState("");
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);

  function applyBlueprint(next: Blueprint) {
    setBlueprint(next);
    setTitle(next.title);
    setDescription(next.description);
    setCategory(next.category);
    setLevel(next.level);
    setPriceType(next.price_type);
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            className="rounded-full h-12 w-12 p-0 text-slate-400 hover:bg-[#062e39] hover:text-white transition-all"
            render={<Link href="/creator/courses" />}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-[#062e39]">Create New Curriculum</h1>
            <p className="text-slate-500 font-medium mt-1 text-lg">Bring your expertise to life with a professional-first approach.</p>
          </div>
        </div>
      </div>

      <CourseBlueprintAssistant onApply={applyBlueprint} />

      <div className="grid gap-10 xl:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <Card className="marketing-card rounded-[3rem] border-0 p-4 shadow-xl">
            <CardContent className="p-8">
              <form action={createCourse} className="space-y-10">
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff6ee] text-[#fd5523]">
                      <Briefcase className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold uppercase tracking-[0.15em] text-[#062e39]">Commercial Identity</h3>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="title" className="text-sm font-bold uppercase tracking-widest text-slate-500">
                      Curriculum Title
                    </Label>
                    <Input
                      id="title"
                      name="title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="e.g. AI Workflows for Client-Facing Teams"
                      required
                      className="h-14 rounded-2xl border-slate-200 bg-white text-xl font-bold text-[#062e39] transition-all focus:border-[#fd5523] focus:ring-[#fd5523]/10"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="description" className="text-sm font-bold uppercase tracking-widest text-slate-500">
                      Transformation Summary
                    </Label>
                    <Textarea
                      id="description"
                      name="description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Focus on the professional outcome, first quick win, and what learners will be able to apply at work."
                      rows={5}
                      className="resize-none rounded-[2rem] border-slate-200 bg-white p-6 text-lg leading-relaxed text-[#062e39] focus:border-[#fd5523] focus:ring-[#fd5523]/10"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="thumbnail_url" className="text-sm font-bold uppercase tracking-widest text-slate-500">
                      Visual Identity (URL)
                    </Label>
                    <Input
                      id="thumbnail_url"
                      name="thumbnail_url"
                      type="url"
                      value={thumbnailUrl}
                      onChange={(event) => setThumbnailUrl(event.target.value)}
                      placeholder="https://..."
                      className="h-14 rounded-2xl border-slate-200 bg-white text-base text-[#062e39]"
                    />
                  </div>
                </section>

                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff6ee] text-[#fd5523]">
                      <Layers className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold uppercase tracking-[0.15em] text-[#062e39]">Professional Fit</h3>
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="space-y-3">
                      <Label className="text-sm font-bold uppercase tracking-widest text-slate-500">Category</Label>
                      <select
                        name="category"
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                        className="flex h-14 w-full rounded-2xl border border-slate-200 bg-white px-5 text-base font-bold text-[#062e39] outline-none transition-all focus:border-[#fd5523] focus:ring-2 focus:ring-[#fd5523]/10"
                      >
                        <option value="">Select category</option>
                        {COURSE_CATEGORIES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-bold uppercase tracking-widest text-slate-500">Target Level</Label>
                      <select
                        name="level"
                        value={level}
                        onChange={(event) => setLevel(event.target.value)}
                        className="flex h-14 w-full rounded-2xl border border-slate-200 bg-white px-5 text-base font-bold text-[#062e39] outline-none transition-all focus:border-[#fd5523] focus:ring-2 focus:ring-[#fd5523]/10"
                      >
                        <option value="">Select level</option>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </div>
                  </div>
                </section>

                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff6ee] text-[#fd5523]">
                      <CircleDollarSign className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold uppercase tracking-[0.15em] text-[#062e39]">Commercial Model</h3>
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="space-y-3">
                      <Label className="text-sm font-bold uppercase tracking-widest text-slate-500">Pricing Model</Label>
                      <select
                        name="price_type"
                        value={priceType}
                        onChange={(event) => setPriceType(event.target.value as Blueprint["price_type"])}
                        className="flex h-14 w-full rounded-2xl border border-slate-200 bg-white px-5 text-base font-bold text-[#062e39] outline-none transition-all focus:border-[#fd5523] focus:ring-2 focus:ring-[#fd5523]/10"
                      >
                        <option value="free">Free</option>
                        <option value="one_time">One-time purchase</option>
                        <option value="subscription_only">Subscription only</option>
                        <option value="both">Both (purchase or subscribe)</option>
                      </select>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="price_amount" className="text-sm font-bold uppercase tracking-widest text-slate-500">
                        Price (ZMW)
                      </Label>
                      <div className="relative">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-400">ZK</span>
                        <Input
                          id="price_amount"
                          name="price_amount"
                          type="number"
                          min="0"
                          step="0.01"
                          value={priceAmount}
                          onChange={(event) => setPriceAmount(event.target.value)}
                          placeholder="e.g. 250"
                          className="h-14 rounded-2xl border-slate-200 bg-white pl-12 text-xl font-bold text-[#062e39]"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <div className="flex items-center justify-between gap-6 rounded-[2.5rem] bg-[#062e39] p-6 shadow-2xl">
                  <Button type="submit" className="rounded-full bg-[#fd5523] px-12 py-7 text-xl font-bold text-white transition-all hover:bg-[#ef4a16] hover:scale-105 active:scale-95 shadow-xl">
                    Deploy Course Studio
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-full border border-white/20 px-8 text-white/75 hover:bg-white/10 hover:text-white"
                    render={<Link href="/creator/courses" />}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-8">
          <Card className="marketing-outline-card rounded-[2.5rem] border-0 bg-[#062e39] p-8 text-white shadow-xl">
            <CardContent className="space-y-6 p-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#fd8d69]">
                  <Rocket className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-[0.2em]">Strategy Guide</h3>
              </div>
              
              <ul className="space-y-5">
                {[
                  "Deliver a visible win in the first 15 minutes.",
                  "Teach a workflow learners can use at work today.",
                  "Include a real-world project, not just theory.",
                  "End with privacy and accuracy checks."
                ].map((text) => (
                  <li key={text} className="flex gap-4 text-sm leading-relaxed text-white/70">
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#fd8d69]" />
                    {text}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="marketing-card rounded-[2.5rem] border-0 p-8 shadow-xl">
            <CardContent className="space-y-6 p-0 text-[#062e39]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff6ee] text-[#fd5523]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-[0.2em]">Launch Status</h3>
              </div>
              
              {blueprint ? (
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-1.5 text-xs font-bold text-green-700">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    BLUEPRINT SYNCED
                  </div>
                  <div className="space-y-4 pt-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Target Audience</p>
                      <p className="mt-1 font-bold leading-snug">{blueprint.audience}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Quick Win</p>
                      <p className="mt-1 font-bold leading-snug">{blueprint.quick_win}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm leading-relaxed text-slate-500 font-medium">
                    Generate a blueprint above to unlock a stronger title, clearer promise, and a professional-first module arc.
                  </p>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-300 w-1/4" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>

  );
}
