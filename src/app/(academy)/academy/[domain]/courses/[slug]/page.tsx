import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { enrollFree } from "@/actions/enrollments";
import { formatLevelLabel, formatPrice } from "@/lib/course-experience";
import {
  Award,
  BookOpen,
  CheckCircle,
  Clock,
  Layers,
  Lock,
  Play,
  ArrowLeft,
  GraduationCap,
  Sparkles,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import TenantHomeNavBar from "@/components/tenant/TenantHomeNavBar";
import { getCurrentTenantAccess, isTeachingRole } from "@/lib/tenants/access";

type PageProps = {
  params: Promise<{ domain: string; slug: string }>;
  searchParams: Promise<{ action?: string }>;
};

type LessonRow = {
  id: string;
  title: string;
  position: number;
  is_preview: boolean;
  content_blocks?: { type: string }[];
};
type ModuleRow = { id: string; title: string; position: number; lessons: LessonRow[] };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { domain, slug } = await params;
  const supabase = createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("slug", domain)
    .maybeSingle();
  const { data: course } = company
    ? await supabase
        .from("courses")
        .select("title, description")
        .eq("slug", slug)
        .eq("company_id", company.id)
        .maybeSingle()
    : await supabase.from("courses").select("title, description").eq("slug", slug).maybeSingle();

  if (!course) return { title: "Course Not Found" };
  return { title: `${course.title} — ${domain}` };
}

export default async function TenantCourseDetailPage({ params, searchParams }: PageProps) {
  const { domain, slug } = await params;
  const { action } = await searchParams;
  const supabase = createClient();
  const { userId } = await auth();

  // 1. Fetch Tenant
  const { data: tenant } = await supabase
    .from("companies")
    .select("*")
    .eq("slug", domain)
    .single();

  if (!tenant) notFound();

  // 2. Fetch User Access in this tenant
  const access = userId ? await getCurrentTenantAccess(tenant.id) : null;
  const isMember = Boolean(access?.isMember || access?.isSuperAdmin || tenant.admin_id === userId);
  const tenantRole = access?.tenantRole || (tenant.admin_id === userId ? "company_admin" : null);

  // 3. Fetch Course
  const { data: courseRaw } = await supabase
    .from("courses")
    .select("*, profiles(full_name, avatar_url, bio)")
    .eq("slug", slug)
    .eq("company_id", tenant.id)
    .single();

  const course = courseRaw as any;

  if (!course) notFound();
  const canPreviewDraft =
    course.instructor_id === userId ||
    access?.isSuperAdmin ||
    (userId && tenant.admin_id === userId) ||
    isTeachingRole(access?.tenantRole);

  if (course.status !== "published" && !canPreviewDraft) {
    notFound();
  }

  // 4. Fetch Modules & Lessons
  const { data: modulesRaw } = await supabase
    .from("modules")
    .select("id, title, position, lessons(id, title, position, is_preview, content_blocks(type))")
    .eq("course_id", course.id)
    .order("position", { ascending: true });

  const modules: ModuleRow[] = (modulesRaw ?? []).map((m: any) => ({
    ...m,
    lessons: [...(m.lessons ?? [])].sort((a, b) => a.position - b.position),
  }));

  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);
  // Same query as above: shows the "Features the AI tutor" badge when any lesson has a tutor_session block.
  const hasTutorSession = modules.some((m) =>
    m.lessons.some((l) => (l.content_blocks ?? []).some((b) => b.type === "tutor_session")),
  );

  // 5. Check Active Enrollment
  let isEnrolled = false;
  let isPendingPayment = false;
  let completedCount = 0;
  if (userId) {
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("id, status")
      .eq("user_id", userId)
      .eq("course_id", course.id)
      .maybeSingle();

    isEnrolled = enrollment?.status === "active";
    isPendingPayment = enrollment?.status === "pending_payment";

    const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
    if ((isEnrolled || isPendingPayment) && lessonIds.length > 0) {
      const { count } = await supabase
        .from("lesson_progress")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("completed", true)
        .in("lesson_id", lessonIds);
      completedCount = count ?? 0;
    }
  }

  const quizCount = modules.reduce(
    (acc, m) => acc + m.lessons.filter((l) => (l.content_blocks ?? []).some((b) => b.type === "quiz")).length,
    0
  );
  const firstPreviewLesson = modules.flatMap((m) => m.lessons).find((l) => l.is_preview) ?? null;
  const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  const brandColor = tenant.primary_color || "#fd5523";
  const isFree = course.price_type === "free";
  const priceDisplay = formatPrice(course.price_type, course.price_amount);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-24">
      {/* Fixed Tenant Header */}
      <TenantHomeNavBar
        tenant={tenant}
        template={tenant.home_template || "modern"}
        userId={userId || ""}
        role={tenantRole || ""}
        isMember={isMember}
      />

      {/* Main Container */}
      <div className="container max-w-6xl mx-auto px-4 pt-28 sm:pt-32">
        {/* Back navigation */}
        <Link
          href={`/academy/${tenant.slug}`}
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 transition-colors mb-6 group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to {tenant.name}</span>
        </Link>

        {/* Hero Section Card */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200/80 p-6 sm:p-10 shadow-sm mb-10 overflow-hidden relative">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            
            <div className="lg:col-span-2 space-y-4">
              {course.thumbnail_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={course.thumbnail_url}
                  alt=""
                  className="aspect-video w-full rounded-2xl object-cover sm:hidden"
                />
              )}
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider text-white"
                  style={{ backgroundColor: brandColor }}
                >
                  {tenant.name}
                </span>
                {course.category && (
                  <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                    {course.category}
                  </span>
                )}
                {course.level && (
                  <span className="px-3 py-1 rounded-full text-[11px] font-bold capitalize bg-slate-100 text-slate-600">
                    {formatLevelLabel(course.level)}
                  </span>
                )}
              </div>

              {hasTutorSession && (
                <span className="inline-flex items-center rounded-full bg-cyan-50 px-3 py-1 text-[11px] font-bold text-cyan-700">
                  Features the AI tutor
                </span>
              )}

              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                {course.title}
              </h1>

              {course.description && (
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
                  {course.description}
                </p>
              )}

              {/* Course Meta Info */}
              <div className="pt-2 flex flex-wrap items-center gap-6 text-xs text-slate-500 font-medium">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-slate-400" />
                  <span>{modules.length} Modules ({totalLessons} Lessons)</span>
                </div>
                {course.profiles?.full_name && (
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-slate-400" />
                    <span>Taught by {course.profiles.full_name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Pricing & Enrollment Action Box */}
            <div className="bg-slate-50 rounded-3xl p-6 sm:p-8 border border-slate-100 flex flex-col justify-between space-y-6">
              {course.thumbnail_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={course.thumbnail_url}
                  alt=""
                  className="hidden aspect-video w-full rounded-2xl object-cover sm:block"
                />
              )}
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400 block mb-1">
                  Tuition
                </span>
                <div className="text-3xl font-black text-slate-900">
                  {priceDisplay}
                </div>
              </div>

              <div>
                {isEnrolled ? (
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1.5 flex justify-between text-xs font-semibold text-slate-500">
                        <span>Your progress</span>
                        <span>{progressPct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full" style={{ width: `${progressPct}%`, backgroundColor: brandColor }} />
                      </div>
                    </div>
                    <Link
                      href={`/courses/${course.slug}/learn`}
                      className="w-full flex items-center justify-center gap-2 text-white font-bold text-sm py-4 rounded-2xl shadow-lg transition-all hover:opacity-90 active:scale-95"
                      style={{ backgroundColor: brandColor }}
                    >
                      <Play className="h-4 w-4 fill-white" />
                      <span>{completedCount === 0 ? "Start learning" : progressPct === 100 ? "Review course" : "Continue learning"}</span>
                    </Link>
                  </div>
                ) : isPendingPayment ? (
                  <div className="space-y-3">
                    <p className="rounded-2xl bg-amber-50 p-3 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
                      Payment pending — Module 1 is open while we confirm your payment.
                    </p>
                    <Link
                      href={`/courses/${course.slug}/learn`}
                      className="w-full flex items-center justify-center gap-2 text-white font-bold text-sm py-4 rounded-2xl shadow-lg transition-all hover:opacity-90 active:scale-95"
                      style={{ backgroundColor: brandColor }}
                    >
                      <Play className="h-4 w-4 fill-white" />
                      <span>Start Module 1</span>
                    </Link>
                  </div>
                ) : !userId ? (
                  <Link
                    href={`/sign-in?redirect_url=/academy/${tenant.slug}/courses/${course.slug}`}
                    className="w-full flex items-center justify-center gap-2 text-white font-bold text-xs uppercase tracking-wider py-4 rounded-2xl shadow-lg transition-all hover:scale-105 active:scale-95"
                    style={{ backgroundColor: brandColor }}
                  >
                    <span>Sign In to Enrol</span>
                  </Link>
                ) : isFree ? (
                  <form action={enrollFree.bind(null, course.id, course.slug)}>
                    <button
                      type="submit"
                      className="w-full flex items-center justify-center gap-2 text-white font-bold text-xs uppercase tracking-wider py-4 rounded-2xl shadow-lg transition-all hover:scale-105 active:scale-95"
                      style={{ backgroundColor: brandColor }}
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>Enrol Free Now</span>
                    </button>
                  </form>
                ) : (
                  <Link
                    href={`/courses/${course.slug}/checkout`}
                    className="w-full flex items-center justify-center gap-2 text-white font-bold text-xs uppercase tracking-wider py-4 rounded-2xl shadow-lg transition-all hover:scale-105 active:scale-95"
                    style={{ backgroundColor: brandColor }}
                  >
                    <span>Enrol — {priceDisplay}</span>
                  </Link>
                )}
              </div>

              {firstPreviewLesson && !isEnrolled && (
                <Link
                  href={`/courses/${course.slug}/learn?lesson=${firstPreviewLesson.id}`}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <Play className="h-4 w-4" />
                  Watch a free lesson
                </Link>
              )}

              <ul className="space-y-2 border-t border-slate-200 pt-5 text-sm text-slate-600">
                <li className="flex items-center gap-2.5">
                  <BookOpen className="h-4 w-4 text-slate-400" />
                  {totalLessons} lesson{totalLessons === 1 ? "" : "s"} in {modules.length} module{modules.length === 1 ? "" : "s"}
                </li>
                {quizCount > 0 && (
                  <li className="flex items-center gap-2.5">
                    <CheckCircle className="h-4 w-4 text-slate-400" />
                    {quizCount} knowledge check{quizCount === 1 ? "" : "s"}
                  </li>
                )}
                <li className="flex items-center gap-2.5">
                  <Sparkles className="h-4 w-4 text-slate-400" />
                  AI tutor on every lesson
                </li>
                <li className="flex items-center gap-2.5">
                  <Award className="h-4 w-4 text-slate-400" />
                  Verified certificate of completion
                </li>
              </ul>
            </div>

          </div>
        </div>

        {/* Curriculum Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="h-5 w-5 text-slate-400" />
              <span>Curriculum Breakdown</span>
            </h2>
            <span className="text-xs text-slate-500 font-semibold">
              {modules.length} Modules • {totalLessons} Lessons
            </span>
          </div>

          <div className="space-y-4">
            {modules.map((mod, modIdx) => (
              <div
                key={mod.id}
                className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm overflow-hidden"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="h-7 w-7 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center">
                      {modIdx + 1}
                    </span>
                    <h3 className="font-bold text-base text-slate-900">
                      {mod.title}
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    {mod.lessons.length} lessons
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {mod.lessons.map((les, lesIdx) => (
                    <div
                      key={les.id}
                      className="py-3 flex items-center justify-between text-xs text-slate-600 hover:text-slate-900 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 font-mono text-[11px]">
                          {modIdx + 1}.{lesIdx + 1}
                        </span>
                        <span>{les.title}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isEnrolled ? (
                          <Link
                            href={`/courses/${course.slug}/learn?lesson=${les.id}`}
                            className="rounded-lg px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100"
                          >
                            Open
                          </Link>
                        ) : les.is_preview ? (
                          <Link
                            href={`/courses/${course.slug}/learn?lesson=${les.id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                          >
                            <Play className="h-3 w-3" /> Preview
                          </Link>
                        ) : (
                          <Lock className="h-3.5 w-3.5 text-slate-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
