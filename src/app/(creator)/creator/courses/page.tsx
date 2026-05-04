import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Image as ImageIcon,
  Layers,
  Pencil,
  Plus,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import type { Course } from "@/types/database";

export const metadata = { title: "My Courses — Creator" };

const STATUS_COLORS: Record<Course["status"], string> = {
  published: "border-green-200 bg-green-50 text-green-700",
  draft: "border-amber-200 bg-amber-50 text-amber-700",
  archived: "border-slate-200 bg-slate-100 text-slate-600",
};

export default async function CreatorCoursesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createClient();
  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .eq("instructor_id", userId)
    .order("created_at", { ascending: false });

  const publishedCount = courses?.filter((course) => course.status === "published").length ?? 0;
  const draftCount = courses?.filter((course) => course.status === "draft").length ?? 0;

  return (
    <div className="container" style={{ paddingTop: "60px", paddingBottom: "80px" }}>
    <div className="space-y-10 pb-12">
      <section className="marketing-shell mesh-orange noise overflow-hidden rounded-[2.5rem] border border-white/10 p-8 shadow-2xl sm:p-12">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-8">
          <div className="max-w-3xl">
            <div className="marketing-kicker bg-white/10 text-white">
              <Sparkles className="mr-2 h-3 w-3" />
              Creator Studio
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Design courses that <br className="hidden sm:block" />
              <span className="text-[#fd8d69]">actually transform.</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-white/80 sm:text-xl">
              Focus on practical AI workflows. Build learning that starts with a quick win and guides professionals into real-world capability.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <Link
              href="/creator/courses/new"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20 flex items-center justify-center px-4 h-10"
              )}
            >
              <WandSparkles className="mr-2 h-4 w-4 text-[#fd8d69]" />
              AI Assistant
            </Link>
            <Link
              href="/admin/images"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20 flex items-center justify-center px-4 h-10"
              )}
            >
              <ImageIcon className="mr-2 h-4 w-4 text-[#fd8d69]" />
              Manage Images
            </Link>
            <Link 
              href="/creator/courses/new"
              className={cn(
                buttonVariants({ variant: "default" }),
                "rounded-full bg-[#fd5523] px-8 py-6 text-lg font-semibold text-white hover:bg-[#ef4a16] flex items-center justify-center"
              )}
            >
              <Plus className="mr-2 h-5 w-5" />
              New Course
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total courses", value: courses?.length ?? 0, icon: Layers, color: "text-[#fd5523]" },
          { label: "Published", value: publishedCount, icon: Eye, color: "text-[#fd5523]" },
          { label: "Drafts", value: draftCount, icon: EyeOff, color: "text-[#fd5523]" },
          { label: "Model", value: "Quick-win", icon: GraduationCap, color: "text-[#fd5523]" },
        ].map((item) => (
          <Card key={item.label} className="marketing-outline-card rounded-[2rem] border-0">
            <CardContent className="p-6">
              <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff6ee] ${item.color}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <p className="text-4xl font-bold text-[#062e39]">{item.value}</p>
              <p className="mt-2 text-sm font-medium uppercase tracking-wider text-slate-500">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {courses && courses.length > 0 ? (
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-bold text-[#062e39]">Your Curriculum</h2>
            <div className="h-px flex-1 bg-slate-200 mx-6 hidden sm:block" />
          </div>
          
          <div className="grid gap-6">
            {courses.map((course) => (
              <Card key={course.id} className="marketing-card group overflow-hidden rounded-[2.5rem] border-0 transition-all hover:shadow-xl hover:shadow-[#062e39]/5">
                <CardContent className="grid gap-6 p-6 lg:grid-cols-[160px_1fr_auto] lg:items-center">
                  <div className="relative overflow-hidden rounded-[1.8rem] bg-[#fff6ee]">
                    {course.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={course.thumbnail_url} alt={course.title} className="aspect-square h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    ) : (
                      <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-[#fff6ee] to-[#fd5523]/5">
                        <BookOpen className="h-10 w-10 text-[#fd5523]/40" />
                      </div>
                    )}
                    <Badge className={`absolute bottom-3 left-3 border-0 px-3 py-1 ${STATUS_COLORS[course.status]}`}>
                      {course.status}
                    </Badge>
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-2xl font-bold text-[#062e39]">{course.title}</h2>
                    <p className="mt-2 line-clamp-2 text-base leading-relaxed text-slate-600">
                      {course.description ?? "No learner-facing summary yet. Add a clearer transformation promise before publishing."}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Layers className="h-4 w-4" />
                        {course.category ?? "Uncategorized"}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <GraduationCap className="h-4 w-4" />
                        {course.level ? course.level[0].toUpperCase() + course.level.slice(1) : "Level not set"}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[#fd5523]">
                        <Sparkles className="h-4 w-4" />
                        {formatPrice(course.price_type, course.price_amount)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 lg:flex-col lg:justify-center">
                    {course.status === "published" ? (
                      <Link
                        href={`/courses/${course.slug}`}
                        target="_blank"
                        className={cn(
                          buttonVariants({ variant: "ghost" }),
                          "rounded-full text-[#062e39] hover:bg-[#fff6ee] flex items-center justify-center px-4 h-10"
                        )}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Live Site
                      </Link>
                    ) : null}
                    <Link
                      href={`/creator/courses/${course.id}`}
                      className={cn(
                        buttonVariants({ variant: "default" }),
                        "rounded-full bg-[#062e39] px-6 text-white hover:bg-[#0a4055] flex items-center justify-center h-10"
                      )}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit Studio
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : (
        <Card className="marketing-outline-card rounded-[3rem] border-2 border-dashed border-slate-200 bg-white/50">
          <CardContent className="py-20 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#fff6ee] text-[#fd5523]">
              <BookOpen className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-bold text-[#062e39]">Create your first practical course</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-slate-600">
              Start with the AI blueprint flow to generate a quick-win lesson angle, professional audience fit, and launch-ready course positioning.
            </p>
            <Link 
              href="/creator/courses/new"
              className={cn(
                buttonVariants({ variant: "default" }),
                "mt-8 rounded-full bg-[#fd5523] px-8 py-6 text-lg font-semibold text-white hover:bg-[#ef4a16] flex items-center justify-center"
              )}
            >
              Generate a course blueprint
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
    </div>
  );
}
