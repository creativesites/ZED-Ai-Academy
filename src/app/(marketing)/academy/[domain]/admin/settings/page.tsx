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
    <div className="container max-w-7xl py-12">
      <div className="mb-10">
        <h1 className="text-4xl font-black tracking-tight text-[#062e39] uppercase">Academy Identity</h1>
        <p className="text-slate-500 font-medium mt-2 text-lg">
          Customize the look and feel of your academy landing page.
        </p>
      </div>

      <div className="grid gap-10">
        <div className="space-y-8">
          <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-[#fd5523]">
                  <Palette className="h-5 w-5" />
                </div>
                <CardTitle className="text-2xl font-black text-[#062e39] uppercase">Branding & Layout</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-10">
              <SettingsForm 
                initialData={{
                  logo_url: company.logo_url || "",
                  primary_color: company.primary_color || "#fd5523",
                  home_template: company.home_template,
                  home_content: company.home_content || {},
                }}
                tenantSlug={company.slug}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
