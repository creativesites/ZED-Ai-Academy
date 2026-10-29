import { createClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GraduationCap, Layout, ArrowUpRight } from "lucide-react";
import { joinTenantBySlug } from "@/actions/tenants";
import { cn } from "@/lib/utils";
import { TemplateRenderer } from "@/lib/templates/home-templates";
import { TenantTracker } from "@/components/tenant/TenantTracker";
import type { CSSProperties } from "react";
import { getCurrentTenantAccess } from "@/lib/tenants/access";
import TenantHomeNavBar from "@/components/tenant/TenantHomeNavBar";  


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
  const { userId } = await auth();

  const { data: tenant } = await supabase.from("companies").select("*").eq("slug", domain).single();
  if (!tenant) notFound();

  // Check tenant-scoped membership & access
  const access = userId ? await getCurrentTenantAccess(tenant.id) : null;
  const isMember = Boolean(access?.isMember || access?.isSuperAdmin || tenant.admin_id === userId);
  const tenantRole = access?.tenantRole || (tenant.admin_id === userId ? "company_admin" : null);

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
      <TenantHomeNavBar 
        tenant={tenant} 
        template={template} 
        userId={userId || ""} 
        role={tenantRole || ""} 
        isMember={isMember} 
      />

      <main>
        <TenantTracker domain={domain} />
        <TemplateRenderer
          tenant={tenant}
          courses={courses || []}
          membership={isMember ? { role: tenantRole } : null}
          content={content}
          brandColor={brandColor}
          template={template}
          adminProfile={adminProfile}
          stats={stats}
        />
      </main>

      <footer className="py-12 sm:py-20 px-4 border-t border-slate-100 text-center">
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.25em] sm:tracking-[0.5em] leading-loose break-words">
          &copy; {new Date().getFullYear()} {tenant.name} &bull; Powered by ZED AI Academy
        </p>
      </footer>
    </div>
  );
}