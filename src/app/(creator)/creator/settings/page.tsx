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
      <div className="container" style={{ paddingTop: "60px", paddingBottom: "80px" }}>
        <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-[#fff6ee]">
          <CardContent className="p-12 text-center space-y-6">
            <div className="mx-auto h-20 w-20 bg-white rounded-3xl flex items-center justify-center text-[#fd5523] shadow-sm">
              <Building2 className="h-10 w-10" />
            </div>
            <h1 className="text-3xl font-bold text-[#062e39]">Organization Required</h1>
            <p className="text-lg text-slate-600 max-w-lg mx-auto leading-relaxed">
              To customize your site settings, you must be actively operating within an Organization. Please use the switcher in the header to select or create your Academy Organization.
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
    <div className="container" style={{ paddingTop: "60px", paddingBottom: "80px" }}>
      <div className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-[#062e39]">Academy Identity</h1>
        <p className="text-slate-500 font-medium mt-2 text-lg">
          Customize the look and feel of your personalized academy landing page.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 p-8">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-[#fd5523]">
                  <Palette className="h-5 w-5" />
                </div>
                <CardTitle className="text-2xl text-[#062e39]">Branding Settings</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-8">
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

        <div>
          <Card className="rounded-[2.5rem] border-0 shadow-xl bg-[#062e39] text-white">
            <CardContent className="p-8 space-y-6">
              <h3 className="font-bold text-xl">Your Academy Link</h3>
              <p className="text-white/70">
                Your academy is securely hosted and isolated on its own custom page. You can share this link directly with your students.
              </p>
              <div className="bg-white/10 rounded-2xl p-4 font-mono text-sm break-all border border-white/20">
                https://zedai.academy/academy/{company.slug}
              </div>
              <a 
                href={`/academy/${company.slug}`} 
                target="_blank" 
                className="block text-center bg-[#fd5523] text-white font-bold py-3 rounded-full hover:bg-[#ef4a16] transition"
              >
                Preview Live Site
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
