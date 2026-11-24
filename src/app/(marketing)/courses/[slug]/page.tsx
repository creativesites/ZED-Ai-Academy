import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { canManageCourse } from "@/lib/courses/course-auth-server";
import { notFound, redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ slug: string }>;
};

type CourseWithCompany = {
  id: string;
  title: string;
  status: string;
  company_id: string | null;
  companies: { slug: string; name: string } | { slug: string; name: string }[] | null;
};

export default async function LegacyCourseDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = createClient();
  const { userId } = await auth();

  const { data } = await supabase
    .from("courses")
    .select("id, title, status, company_id, companies(slug, name)")
    .eq("slug", slug)
    .limit(5);

  const candidates = (data ?? []) as unknown as CourseWithCompany[];
  const visible: CourseWithCompany[] = [];

  for (const c of candidates) {
    if (c.status === "published") {
      visible.push(c);
    } else if (userId) {
      const { allowed } = await canManageCourse(supabase, c.id, userId);
      if (allowed) visible.push(c);
    }
  }

  if (visible.length === 0) {
    notFound();
  }

  const courses = visible;

  if (courses.length === 1) {
    const comp = Array.isArray(courses[0].companies)
      ? courses[0].companies[0]
      : courses[0].companies;
    const tenantSlug = comp?.slug || "zedai";
    redirect(`/academy/${tenantSlug}/courses/${slug}`);
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Choose an academy
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Multiple academies offer a course at this link. Select the academy you want to open:
      </p>
      <ul className="mt-6 space-y-3">
        {courses.map((course) => {
          const comp = Array.isArray(course.companies)
            ? course.companies[0]
            : course.companies;
          const tenantSlug = comp?.slug || "zedai";
          const tenantName = comp?.name || "Zed AI Academy";
          return (
            <li key={course.id}>
              <Link
                href={`/academy/${tenantSlug}/courses/${slug}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 hover:border-slate-300 hover:bg-slate-50"
              >
                <div>
                  <div className="font-semibold">{course.title}</div>
                  <div className="text-xs text-slate-500">{tenantName}</div>
                </div>
                <span className="text-xs font-semibold text-[#fd5523]">Open →</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
