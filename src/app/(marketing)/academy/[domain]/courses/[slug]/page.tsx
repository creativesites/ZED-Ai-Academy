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
import { getCurrentTenantAccess } from "@/lib/tenants/access";
import { toPublicTenant } from "@/lib/tenants/public";

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
  const { data: course } = await supabase
    .from("courses")
    .select("title, description")
    .eq("slug", slug)
    .single();

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
  if (course.status !== "published" && course.instructor_id !== userId && !access?.isSuperAdmin) {
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
  if (userId) {
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("id, status")
      .eq("user_id", userId)
      .eq("course_id", course.id)
      .eq("status", "active")
      .maybeSingle();

    isEnrolled = Boolean(enrollment);
  }

  const brandColor = tenant.primary_color || "#fd5523";
  const isFree = course.price_type === "free";
  const priceDisplay = formatPrice(course.price_type, course.price_amount);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-24">
      {/* Fixed Tenant Header */}
      <TenantHomeNavBar
        tenant={toPublicTenant(tenant)}
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
                  <Link
                    href={`/courses/${course.slug}/learn`}
                    className="w-full flex items-center justify-center gap-2 text-white font-bold text-xs uppercase tracking-wider py-4 rounded-2xl shadow-lg transition-all hover:scale-105 active:scale-95"
                    style={{ backgroundColor: brandColor }}
                  >
                    <Play className="h-4 w-4 fill-white" />
                    <span>Resume Learning</span>
                  </Link>
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
                        {les.is_preview ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-200">
                            Preview
                          </span>
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
