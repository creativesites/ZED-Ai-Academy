import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "@/components/creator/settings-form";
import { Building2, Palette } from "lucide-react";

export const metadata = { title: "Site Settings — Creator Studio" };

export default async function SettingsPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  if (!orgId) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <Card className="rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden bg-[#fff6ee]">
          <CardContent className="p-6 sm:p-12 text-center space-y-4">
            <div className="mx-auto h-16 w-16 bg-white rounded-2xl flex items-center justify-center text-[#fd5523] shadow-sm">
              <Building2 className="h-8 w-8" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#062e39]">Organization Required</h1>
            <p className="text-sm sm:text-base text-slate-600 max-w-lg mx-auto leading-relaxed">
              To customize your site settings, you must be actively operating within an Organization. Please select or create your Academy Organization first.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug, logo_url, primary_color, home_template, home_content")
    .eq("id", orgId)
    .single();

  if (!company) {
    return <div>Organization not found in database.</div>;
  }

  return (
    <div className="container max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-[#062e39]">Branding & Design</h1>
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
