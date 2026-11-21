"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { createCourse } from "@/actions/courses";
import {
  CourseBlueprintAssistant,
  type CourseBlueprintResponse,
  type ReferenceMaterialPayload,
} from "@/components/creator/course-blueprint-assistant";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COURSE_CATEGORIES } from "@/lib/course-experience";
import { COURSE_DOMAIN_PRESETS, type CourseDomainPresetId } from "@/lib/course-domain-presets";
import {
  ArrowLeft,
  BookOpen,
  Briefcase,
  CheckCircle2,
  CircleDollarSign,
  ImageIcon,
  Layers,
  Loader2,
  Rocket,
  Sparkles,
} from "lucide-react";

function DeployStudioButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-12 w-full sm:w-auto rounded-xl bg-[#fd5523] px-7 text-sm font-bold text-white transition-all hover:bg-[#ef4a16] active:scale-[0.99] shadow-md disabled:opacity-70"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Creating Course...
        </>
      ) : (
        "Deploy Course Studio"
      )}
    </Button>
  );
}

interface NewCourseFormProps {
  companyId?: string;
  tenantSlug?: string;
  cancelHref?: string;
}

export function NewCourseForm({
  companyId,
  tenantSlug,
  cancelHref,
}: NewCourseFormProps = {}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState("");
  const [priceType, setPriceType] = useState<CourseBlueprintResponse["price_type"]>("free");
  const [priceAmount, setPriceAmount] = useState("");
  const [blueprint, setBlueprint] = useState<CourseBlueprintResponse | null>(null);
  const [referenceMaterial, setReferenceMaterial] = useState<ReferenceMaterialPayload | null>(null);
  const [assistantMode, setAssistantMode] = useState<"idea" | "materials" | null>(null);
  const [domainPreset, setDomainPreset] = useState<CourseDomainPresetId>("ai-professional");

  function applyBlueprint(next: CourseBlueprintResponse) {
    setBlueprint(next);
    setTitle(next.title);
    setDescription(next.description);
    setCategory(next.category);
    setLevel(next.level);
    setPriceType(next.price_type);
    const matchingPreset = COURSE_DOMAIN_PRESETS.find((preset) => preset.suggestedCategory === next.category);
    if (matchingPreset) setDomainPreset(matchingPreset.id);
    setAssistantMode(null);
  }

  const backLink = cancelHref || (tenantSlug ? `/academy/${tenantSlug}/admin/courses` : "/creator/courses");
  const showsPriceAmount = priceType === "one_time" || priceType === "both";

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Compact Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start sm:items-center gap-3">
          <Link
            href={backLink}
            aria-label="Back to courses"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "h-10 w-10 shrink-0 rounded-xl border border-slate-200 bg-white p-0 text-slate-500 hover:bg-slate-100 hover:text-[#062e39]"
            )}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#062e39]">
              Create New Course
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Set up your course basics and launch the curriculum studio.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            type="button"
            variant={assistantMode === "materials" ? "secondary" : "outline"}
            onClick={() =>
              setAssistantMode((prev) => (prev === "materials" ? null : "materials"))
            }
            className={cn(
              "h-10 flex-1 sm:flex-none rounded-xl px-4 text-xs font-bold uppercase tracking-wider transition-all",
              assistantMode === "materials"
                ? "bg-[#062e39] text-white hover:bg-[#0a4055]"
                : "border-slate-200 bg-white text-[#062e39] hover:bg-slate-50"
            )}
          >
            <BookOpen className="mr-2 h-4 w-4 text-[#fd5523]" />
            From Materials
          </Button>
          <Button
            type="button"
            variant={assistantMode === "idea" ? "secondary" : "outline"}
            onClick={() => setAssistantMode((prev) => (prev === "idea" ? null : "idea"))}
            className={cn(
              "h-10 flex-1 sm:flex-none rounded-xl px-4 text-xs font-bold uppercase tracking-wider transition-all",
              assistantMode === "idea"
                ? "bg-[#062e39] text-white hover:bg-[#0a4055]"
                : "border-[#fd5523]/30 bg-[#fff6ee] text-[#fd5523] hover:bg-[#fd5523] hover:text-white"
            )}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Draft with AI
          </Button>
        </div>
      </div>

      {/* Collapsible AI / Materials Course Starter */}
      {assistantMode && (
        <CourseBlueprintAssistant
          key={assistantMode}
          initialMode={assistantMode}
          onApply={applyBlueprint}
          onAttachReference={(material) => {
            setReferenceMaterial(material);
            setAssistantMode(null);
          }}
        />
      )}

      {referenceMaterial && !assistantMode && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#062e39] flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[#fd5523]" />
              Reference Material: {referenceMaterial.fileName}
            </span>
            <button
              type="button"
              onClick={() => setReferenceMaterial(null)}
              className="text-xs font-semibold text-slate-400 hover:text-red-600"
            >
              Remove
            </button>
          </div>
          <p className="text-xs text-slate-600 whitespace-pre-wrap line-clamp-4 bg-slate-50 rounded-xl p-3 border border-slate-100">
            {referenceMaterial.notes}
          </p>
        </div>
      )}

      {blueprint && !assistantMode && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">
              AI Blueprint applied — review or edit any field below before creating.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAssistantMode("idea")}
            className="text-xs font-bold text-emerald-700 underline underline-offset-2 self-start sm:self-auto"
          >
            Reopen Assistant
          </button>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <Card className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-5 sm:p-8">
            <form action={createCourse} className="space-y-8">
              {companyId && <input type="hidden" name="company_id" value={companyId} />}
              {tenantSlug && <input type="hidden" name="tenant_slug" value={tenantSlug} />}
              {blueprint?.module_outline?.length ? (
                <input type="hidden" name="module_outline" value={JSON.stringify(blueprint.module_outline.slice(0, 12))} />
              ) : null}

              {/* Section 1: Course Basics */}
              <section className="space-y-5 border-b border-slate-100 pb-7">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fff6ee] text-[#fd5523]">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-[#062e39]">
                    Course Basics
                  </h2>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Course Title <span className="text-[#fd5523]">*</span>
                  </Label>
                  <Input
                    id="title"
                    name="title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g. AI Workflows for Client-Facing Teams"
                    required
                    className="h-12 rounded-xl border-slate-200 bg-white text-base font-semibold text-[#062e39] focus:border-[#fd5523] focus:ring-[#fd5523]/10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Transformation Summary
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe the practical outcome, who this is for, and what learners will build or apply."
                    rows={4}
                    className="resize-none rounded-xl border-slate-200 bg-white p-3.5 text-sm leading-relaxed text-[#062e39] focus:border-[#fd5523] focus:ring-[#fd5523]/10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="thumbnail_url" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Cover Image URL (Optional)
                  </Label>
                  <Input
                    id="thumbnail_url"
                    name="thumbnail_url"
                    type="url"
                    value={thumbnailUrl}
                    onChange={(event) => setThumbnailUrl(event.target.value)}
                    placeholder="https://..."
                    className="h-11 rounded-xl border-slate-200 bg-white text-sm text-[#062e39]"
                  />
                </div>
              </section>

              {/* Section 2: Track & Audience */}
              <section className="space-y-5 border-b border-slate-100 pb-7">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fff6ee] text-[#fd5523]">
                    <Layers className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-[#062e39]">
                    Track & Audience
                  </h2>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Course Track
                  </Label>
                  <input type="hidden" name="domain_preset" value={domainPreset} />
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {COURSE_DOMAIN_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setDomainPreset(preset.id);
                          if (!category) setCategory(preset.suggestedCategory);
                        }}
                        className={cn(
                          "rounded-xl border p-3.5 text-left transition-all",
                          domainPreset === preset.id
                            ? "border-[#fd5523] bg-[#fff6ee]/70 shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        )}
                      >
                        <p className="text-sm font-bold text-[#062e39]">{preset.label}</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">{preset.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Category
                    </Label>
                    <select
                      name="category"
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-[#062e39] outline-none transition-all focus:border-[#fd5523] focus:ring-2 focus:ring-[#fd5523]/10"
                    >
                      <option value="">Select category</option>
                      {COURSE_CATEGORIES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Target Level
                    </Label>
                    <select
                      name="level"
                      value={level}
                      onChange={(event) => setLevel(event.target.value)}
                      className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-[#062e39] outline-none transition-all focus:border-[#fd5523] focus:ring-2 focus:ring-[#fd5523]/10"
                    >
                      <option value="">Select level</option>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Section 3: Pricing */}
              <section className="space-y-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fff6ee] text-[#fd5523]">
                    <CircleDollarSign className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-[#062e39]">
                    Pricing
                  </h2>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Pricing Model
                    </Label>
                    <select
                      name="price_type"
                      value={priceType}
                      onChange={(event) =>
                        setPriceType(event.target.value as CourseBlueprintResponse["price_type"])
                      }
                      className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-[#062e39] outline-none transition-all focus:border-[#fd5523] focus:ring-2 focus:ring-[#fd5523]/10"
                    >
                      <option value="free">Free</option>
                      <option value="one_time">One-time purchase</option>
                      <option value="subscription_only">Subscription only</option>
                      <option value="both">Both (purchase or subscribe)</option>
                    </select>
                  </div>

                  {showsPriceAmount && (
                    <div className="space-y-2">
                      <Label htmlFor="price_amount" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Price (ZMW)
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          ZK
                        </span>
                        <Input
                          id="price_amount"
                          name="price_amount"
                          type="number"
                          min="0"
                          step="0.01"
                          value={priceAmount}
                          onChange={(event) => setPriceAmount(event.target.value)}
                          placeholder="e.g. 250"
                          className="h-11 rounded-xl border-slate-200 bg-white pl-10 text-sm font-bold text-[#062e39]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Action Bar */}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-slate-100">
                <Link
                  href={backLink}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "h-12 w-full sm:w-auto rounded-xl border-slate-200 px-6 text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center"
                  )}
                >
                  Cancel
                </Link>
                <DeployStudioButton />
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Right Sidebar: Live Preview & Tips */}
        <aside className="space-y-5 lg:sticky lg:top-24">
          <Card className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="aspect-video w-full bg-slate-100 flex items-center justify-center overflow-hidden">
              {thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnailUrl}
                  alt={title || "Course cover preview"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-slate-400">
                  <ImageIcon className="h-7 w-7" />
                  <span className="text-[11px] font-semibold">Cover preview</span>
                </div>
              )}
            </div>
            <CardContent className="p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wider">
                <span className="text-[#fd5523] truncate">{category || "Category"}</span>
                <span className="text-slate-400 shrink-0">{level || "Level"}</span>
              </div>
              <h3 className="font-bold text-base text-[#062e39] leading-snug line-clamp-2">
                {title || "Your Course Title"}
              </h3>
              <p className="text-xs text-slate-500 line-clamp-2">
                {description || "A brief summary of what learners will achieve in this course."}
              </p>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#062e39]">
                <span className="flex items-center gap-1.5 text-slate-400 font-medium">
                  <BookOpen className="h-3.5 w-3.5" /> Draft Studio
                </span>
                <span>
                  {priceType === "free"
                    ? "Free"
                    : priceType === "subscription_only"
                      ? "Subscription"
                      : priceAmount
                        ? `ZMW ${priceAmount}`
                        : "Paid"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 bg-[#062e39] p-5 text-white shadow-sm">
            <CardContent className="space-y-3 p-0">
              <div className="flex items-center gap-2 text-[#fd8d69]">
                <Rocket className="h-4 w-4" />
                <h3 className="text-xs font-bold uppercase tracking-widest">Course Tips</h3>
              </div>
              <ul className="space-y-2.5 text-xs leading-relaxed text-white/75">
                <li>• Promise a concrete skill or workflow learners can apply right away.</li>
                <li>• Keep modules focused (3–5 lessons per module).</li>
                <li>• You can upload a cover image and build modules inside the studio next.</li>
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
