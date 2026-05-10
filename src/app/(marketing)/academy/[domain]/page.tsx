// app/[domain]/page.tsx (simplified)
import { createClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cookies } from "next/headers";
import { GraduationCap, Layout, ArrowUpRight } from "lucide-react";
import { joinTenantBySlug } from "@/actions/tenants";
import { cn } from "@/lib/utils";
import { TemplateRenderer } from "@/lib/templates/home-templates";
import { TenantTracker } from "@/components/tenant/TenantTracker";
import type { CSSProperties } from "react";

type TenantHomeContent = {
  hero_image?: string;
  hero_title?: string;
  hero_subtitle?: string;
  about_title?: string;
  about_text?: string;
  about_image?: string;
  cta_title?: string;
  cta_button?: string;
};

export default async function TenantHomePage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const supabase = createClient();

  const { data: tenant } = await supabase.from("companies").select("*").eq("slug", domain).single();
  if (!tenant) notFound();

  // Fetch Admin Profile for Tutor Details
  const { data: adminProfile } = tenant.admin_id
    ? await supabase
        .from("profiles")
        .select("full_name, avatar_url, bio, role")
        .eq("id", tenant.admin_id)
        .maybeSingle()
    : { data: null };

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, description, slug, thumbnail_url, price_type, price_amount")
    .eq("company_id", tenant.id)
    .eq("status", "published");

  const { userId } = await auth();
  const { data: membership } = userId
    ? await supabase
        .from("company_members")
        .select("role, status")
        .eq("company_id", tenant.id)
        .eq("profile_id", userId)
        .eq("status", "active")
        .maybeSingle()
    : { data: null };

  const brandColor = tenant.primary_color || "#fd5523";
  const content = (tenant.home_content || {}) as TenantHomeContent;
  const template = tenant.home_template || "modern";

  // Fetch Real Stats
  const { count: studentCount } = await supabase
    .from("company_members")
    .select("*", { count: "exact", head: true })
    .eq("company_id", tenant.id)
    .eq("role", "learner");

  // Fetch Success Rate (e.g. course completions)
  const { count: completionCount } = await supabase
    .from("enrollments")
    .select("*", { count: "exact", head: true })
    .eq("company_id", tenant.id)
    .not("completed_at", "is", null);

  // Calculate dynamic stats
  const stats = {
    students: (studentCount || 0) > 100 ? `${(studentCount || 0).toLocaleString()}+` : (studentCount || 0).toString(),
    rating: "4.9/5", // Hardcoded for now unless we have reviews
    success: studentCount ? `${Math.round(((completionCount || 0) / (studentCount || 1)) * 100)}%` : "95%"
  };

  return (
    <div
      className={cn(
        "min-h-screen transition-colors duration-1000",
        template === "dark_mode" ? "bg-[#0a0a0c] text-white" : "bg-white text-slate-900"
      )}
      style={{ "--primary-color": brandColor } as CSSProperties}
    >
      {/* Fixed Header */}
      <nav
        className={cn(
          "fixed top-0 left-0  w-full z-[100] px-6 py-1 flex items-center justify-between border transition-all duration-500",
          template === "dark_mode"
            ? "bg-black backdrop-blur-xl border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]"
            : "bg-white backdrop-blur-xl border-slate-200/50 shadow-[0_8px_32px_0_rgba(0,0,0,0.06)]"
        )}
      >
        <Link
          href={`/academy/${tenant.slug}`}
          className="flex items-center gap-3 group"
        >
          {/* Logo */}
          <div className="h-10 flex items-center justify-center">
            {tenant.logo_url ? (
              <img
                src={tenant.logo_url}
                className="h-8 w-auto object-contain transition-all duration-300 group-hover:scale-105"
                alt={tenant.name}
              />
            ) : (
              <div
                className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-105",
                  template === "dark_mode"
                    ? "bg-white/10 text-white"
                    : "bg-[#062e39] text-white"
                )}
              >
                <GraduationCap className="h-5 w-5" />
              </div>
            )}
          </div>

          {/* Brand Name */}
          <span
            className={cn(
              "text-lg font-black tracking-tight transition-colors",
              template === "dark_mode" ? "text-white" : "text-[#062e39]"
            )}
          >
            {tenant.name}
          </span>
        </Link>

        {/* Navigation Links - Optional middle section */}
        <div className="hidden lg:flex items-center gap-1">
          
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {userId ? (
            <>
            {tenant.slug &&(
              <Link
              href={`/academy/${tenant.slug}/classroom`}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105",
                template === "dark_mode"
                  ? "text-white/70 hover:text-white hover:bg-white/10"
                  : "text-ink hover:text-[#062e39] hover:bg-slate-100"
              )}
            >
              Classroom
            </Link>
            )
            }
            
            <Link
              href={`/academy/${tenant.slug}/dashboard`}
              className="h-8 px-5 rounded-full bg-gradient-to-r from-[#fd5523] to-[#ff6b3d] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:shadow-lg hover:shadow-[#fd5523]/25 hover:scale-105 transition-all duration-300"
            >
              <span className="hidden sm:inline">Dashboard</span>
              <Layout className="h-4 w-4" />
            </Link>
            </>
          ) : (
            <>
              <Link
                href={`/sign-in?redirect_url=/academy/${tenant.slug}/classroom`}
                className={cn(
                  "h-11 px-5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 hidden sm:flex items-center",
                  template === "dark_mode"
                    ? "text-white/80 hover:text-white hover:bg-white/10"
                    : "text-slate-700 hover:text-[#062e39] hover:bg-slate-100"
                )}
              >
                Login
              </Link>
              <Link
                href={`/sign-up?role=student&tenant=${tenant.slug}`}
                className="h-8 px-5 rounded-full bg-gradient-to-r from-[#fd5523] to-[#ff6b3d] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:shadow-lg hover:shadow-[#fd5523]/25 hover:scale-105 transition-all duration-300"
              >
                <span className="hidden sm:inline">Get Started</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>
      </nav>


      <main>
        <TenantTracker domain={domain} />
        <TemplateRenderer
          tenant={tenant}
          courses={courses || []}
          membership={membership}
          content={content}
          brandColor={brandColor}
          template={template}
          adminProfile={adminProfile}
          stats={stats}
        />
      </main>

      <footer className="py-20 border-t border-slate-100 text-center">
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.5em]">
          &copy; {new Date().getFullYear()} {tenant.name} &bull; Powered by ZED AI Academy
        </p>
      </footer>
    </div>
  );
}