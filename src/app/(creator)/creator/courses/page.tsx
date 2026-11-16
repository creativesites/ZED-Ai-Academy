import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/course-experience";
import {
  ArrowRight,
  BookOpen,
  Eye,
  EyeOff,
  GraduationCap,
  Layers,
  Pencil,
  Plus,
  Sparkles,
  Palette,
} from "lucide-react";
import type { Course } from "@/types/database";

export const metadata = { title: "My Courses — Creator" };

const STATUS_COLORS: Record<Course["status"], string> = {
  published: "border-green-200 bg-green-50 text-green-700",
  draft: "border-amber-200 bg-amber-50 text-amber-700",
  archived: "border-slate-200 bg-slate-100 text-slate-600",
};

export default async function CreatorCoursesPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createClient();
  let query = supabase.from("courses").select("*").order("created_at", { ascending: false });

  if (orgId) {
    query = query.eq("company_id", orgId);
  } else {
    query = query.eq("instructor_id", userId);
  }

  const { data: courses } = await query;

  const publishedCount = courses?.filter((course) => course.status === "published").length ?? 0;
  const draftCount = courses?.filter((course) => course.status === "draft").length ?? 0;

  return (
    <div className="container max-w-7xl mx-auto px-4 py-6 sm:py-10 space-y-6 sm:space-y-8">
      {/* Clean Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#fff6ee] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#fd5523] mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            Creator Studio
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#062e39]">
            Your Courses
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Create, structure, and publish practical learning experiences.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/creator/settings"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-10 rounded-xl border-slate-200 bg-white px-4 text-xs sm:text-sm font-bold text-[#062e39] hover:bg-slate-50 inline-flex items-center gap-2"
            )}
          >
            <Palette className="h-4 w-4 text-slate-500" />
            <span>Settings</span>
          </Link>
          <Link
            href="/creator/courses/new"
            className={cn(
              buttonVariants({ variant: "default" }),
              "h-10 rounded-xl bg-[#fd5523] px-5 text-xs sm:text-sm font-bold text-white hover:bg-[#ef4a16] inline-flex items-center gap-2 shadow-sm"
            )}
          >
            <Plus className="h-4 w-4" />
            <span>New Course</span>
          </Link>
        </div>
      </div>

      {/* KPI Strip */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          { label: "Total Courses", value: courses?.length ?? 0, icon: Layers },
          { label: "Published", value: publishedCount, icon: Eye },
          { label: "Drafts", value: draftCount, icon: EyeOff },
          { label: "Track Focus", value: "Practical", icon: GraduationCap },
        ].map((item) => (
          <Card key={item.label} className="rounded-2xl border border-slate-200/80 bg-white shadow-xs">
            <CardContent className="p-4 sm:p-5 flex items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff6ee] text-[#fd5523]">
                <item.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-black text-[#062e39] leading-none">{item.value}</p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">
                  {item.label}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {courses && courses.length > 0 ? (
        <section className="space-y-4">
          <div className="grid gap-4">
            {courses.map((course) => (
              <Card
                key={course.id}
                className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs transition-all hover:shadow-md hover:border-slate-300"
              >
                <CardContent className="grid gap-4 p-4 sm:p-5 md:grid-cols-[200px_1fr_auto] md:items-center">
                  <div className="relative aspect-video overflow-hidden rounded-xl bg-[#fff6ee]">
                    {course.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={course.thumbnail_url}
                        alt={course.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#fff6ee] to-[#fd5523]/10">
                        <BookOpen className="h-8 w-8 text-[#fd5523]/40" />
                      </div>
                    )}
                    <Badge className={`absolute top-2.5 left-2.5 border-0 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[course.status]}`}>
                      {course.status}
                    </Badge>
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl font-bold text-[#062e39] truncate">{course.title}</h2>
                    <p className="mt-1 line-clamp-2 text-xs sm:text-sm leading-relaxed text-slate-500">
                      {course.description ?? "No learner-facing summary yet. Add a clearer transformation promise before publishing."}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-slate-400" />
                        {course.category ?? "Uncategorized"}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                        {course.level ? course.level[0].toUpperCase() + course.level.slice(1) : "Level not set"}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[#fd5523]">
                        <Sparkles className="h-3.5 w-3.5" />
                        {formatPrice(course.price_type, course.price_amount)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 md:flex-col md:items-stretch">
                    {course.status === "published" && (
                      <Link
                        href={`/courses/${course.slug}`}
                        target="_blank"
                        className={cn(
                          buttonVariants({ variant: "outline" }),
                          "h-9 flex-1 md:flex-none rounded-xl border-slate-200 px-4 text-xs font-bold text-[#062e39] hover:bg-slate-50 inline-flex items-center justify-center gap-1.5"
                        )}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Live Site</span>
                      </Link>
                    )}
                    <Link
                      href={`/creator/courses/${course.id}`}
                      className={cn(
                        buttonVariants({ variant: "default" }),
                        "h-9 flex-1 md:flex-none rounded-xl bg-[#062e39] px-5 text-xs font-bold text-white hover:bg-[#0a4055] inline-flex items-center justify-center gap-1.5"
                      )}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Open Studio</span>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : (
        <Card className="rounded-2xl border-2 border-dashed border-slate-200 bg-white">
          <CardContent className="py-14 sm:py-20 text-center px-4">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#fff6ee] text-[#fd5523]">
              <BookOpen className="h-8 w-8" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#062e39]">Create your first course</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 leading-relaxed">
              Start from scratch or use the AI Course Architect to draft a structured curriculum in minutes.
            </p>
            <Link
              href="/creator/courses/new"
              className={cn(
                buttonVariants({ variant: "default" }),
                "mt-6 h-11 rounded-xl bg-[#fd5523] px-6 text-sm font-bold text-white hover:bg-[#ef4a16] inline-flex items-center gap-2"
              )}
            >
              <span>Create Course</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
