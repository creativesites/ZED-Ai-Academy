import { getCoursesOverview, getTenantsList } from "@/actions/super-admin";
import { CoursesManagementClient } from "@/components/superadmin/CoursesManagementClient";
import { BookOpen, Plus } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Courses — Super Admin Control Plane" };

export default async function SuperAdminCoursesPage() {
  const [courses, tenants] = await Promise.all([
    getCoursesOverview(),
    getTenantsList(),
  ]);

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-4 w-4 text-purple-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
              Curriculum & Catalog
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Platform & Tenant Courses
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Oversee all courses published across every tenant, including Zed AI Academy platform offerings.
          </p>
        </div>

        <Link
          href="/creator/courses/new"
          target="_blank"
          className="flex items-center gap-2 bg-[#fd5523] hover:bg-[#ea4817] text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-lg shadow-[#fd5523]/20 transition-all hover:scale-105 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span>New Course</span>
        </Link>
      </div>

      <CoursesManagementClient
        initialCourses={courses}
        tenants={tenants.map((t) => ({ id: t.id, name: t.name, slug: t.slug }))}
      />
    </div>
  );
}
