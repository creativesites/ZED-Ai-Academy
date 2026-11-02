import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "@/components/creator/settings-form";
import { Building2, Palette } from "lucide-react";

export const metadata = { title: "Academy Branding — Admin Hub" };

export default async function AcademySettingsPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const { userId, orgId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=/academy/${domain}/admin/settings`);

  const supabase = createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug, logo_url, primary_color, home_template, home_content")
    .eq("slug", domain)
    .single();

  if (!company) notFound();

  // Security: Ensure user has access to this company
  const { data: membership } = await supabase
    .from("company_members")
    .select("role")
    .eq("company_id", company.id)
    .eq("profile_id", userId)
    .single();

  if (!membership || (membership.role !== "company_admin" && membership.role !== "teacher")) {
    redirect(`/academy/${company.slug}/classroom`);
  }

  return (
    <div className="container max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-[#062e39] uppercase">Branding & Design</h1>
        <p className="text-slate-500 font-medium mt-1 text-sm sm:text-base">
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
  );
}
