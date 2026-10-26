import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { getCurrentTenantAccess } from "@/lib/tenants/access";
import { SettingsForm } from "@/components/creator/settings-form";

export const metadata = { title: "Branding & Site Settings — Academy Admin" };

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const { userId } = await auth();
  if (!userId) {
    redirect(`/sign-in?redirect_url=/academy/${domain}/admin/settings/site`);
  }

  const supabase = createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug, logo_url, primary_color, home_template, home_content")
    .eq("slug", domain)
    .single();

  if (!company) notFound();

  const access = await getCurrentTenantAccess(company.id);
  const isAuthorized = access?.isSuperAdmin || access?.tenantRole === "company_admin";

  if (!isAuthorized) {
    redirect(`/academy/${company.slug}/admin`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fff6ee] to-white">
      <div className="px-4 py-8 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-[#062e39]">
            Branding & Design
          </h1>
          <p className="text-sm sm:text-base text-slate-500 font-medium mt-1">
            Customize your visual identity, landing page templates, and student experience.
          </p>
        </div>

        <SettingsForm 
          initialData={{
            logo_url: company.logo_url || "",
            primary_color: company.primary_color || "#fd5523",
            home_template: company.home_template,
            home_content: company.home_content || {},
          }}
          tenantSlug={company.slug}
          academyName={company.name}
        />
      </div>
    </div>
  );
}
