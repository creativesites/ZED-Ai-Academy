"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Search,
  ExternalLink,
  Users,
  Building2,
  DollarSign,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { ZEDAI_TENANT_ID } from "@/lib/tenants/constants";

type CourseItem = {
  id: string;
  title: string;
  slug: string;
  status: string;
  price_type: string;
  price_amount: number | null;
  category: string | null;
  created_at: string;
  company_id: string;
  company_name: string;
  company_slug: string;
  is_platform: boolean;
  instructor_name: string;
  instructor_email: string;
  enrollments_count: number;
};

type TenantOption = {
  id: string;
  name: string;
  slug: string;
};

export function CoursesManagementClient({
  initialCourses,
  tenants,
}: {
  initialCourses: CourseItem[];
  tenants: TenantOption[];
}) {
  const [courses] = useState<CourseItem[]>(initialCourses);
  const [search, setSearch] = useState("");
  const [tenantFilter, setTenantFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = courses.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.slug.toLowerCase().includes(search.toLowerCase()) ||
      c.instructor_name.toLowerCase().includes(search.toLowerCase()) ||
      c.company_name.toLowerCase().includes(search.toLowerCase());

    const matchesTenant =
      tenantFilter === "all" ? true : c.company_id === tenantFilter;

    const matchesStatus =
      statusFilter === "all" ? true : c.status === statusFilter;

    return matchesSearch && matchesTenant && matchesStatus;
  });

  return (
    <div>
      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search courses by title, slug, or instructor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-slate-700 focus:ring-1 focus:ring-slate-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tenant Filter */}
          <select
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 focus:outline-none focus:border-slate-700"
          >
            <option value="all">All Academies</option>
            <option value={ZEDAI_TENANT_ID}>Zed AI Academy (Platform Core)</option>
            {tenants
              .filter((t) => t.id !== ZEDAI_TENANT_ID)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 focus:outline-none focus:border-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {/* Courses Table */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/60 border-b border-slate-800/80 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Course</th>
                <th className="py-3.5 px-4">Academy</th>
                <th className="py-3.5 px-4">Instructor</th>
                <th className="py-3.5 px-4">Pricing</th>
                <th className="py-3.5 px-4">Enrolled</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 text-sm">
                    No courses found matching your criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                    
                    {/* Course Title & Slug */}
                    <td className="py-4 px-4 sm:px-6">
                      <div>
                        <div className="font-bold text-white text-sm">
                          {c.title}
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          /{c.slug}
                        </div>
                        {c.category && (
                          <span className="inline-block mt-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                            {c.category}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Academy */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-200 text-xs">
                          {c.company_name}
                        </span>
                        {c.is_platform && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Platform
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Instructor */}
                    <td className="py-4 px-4">
                      <div className="text-xs text-slate-300">
                        {c.instructor_name}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {c.instructor_email}
                      </div>
                    </td>

                    {/* Pricing */}
                    <td className="py-4 px-4">
                      <span className="text-xs font-semibold capitalize text-slate-300">
                        {c.price_type === "free"
                          ? "Free"
                          : `ZMW ${c.price_amount?.toLocaleString() ?? 0}`}
                      </span>
                    </td>

                    {/* Enrollments Count */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-300">
                        <GraduationCap className="h-3.5 w-3.5 text-slate-500" />
                        <span>{c.enrollments_count}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4">
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                          c.status === "published"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/courses/${c.slug}`}
                          target="_blank"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                          title="View Course Page"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
