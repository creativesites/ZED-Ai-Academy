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
      <div className="min-h-screen bg-gradient-to-b from-[#fff6ee] to-white">
        <div className="px-4 py-8 sm:px-6 lg:px-8 max-w-6xl mx-auto">
          <Card className="rounded-2xl sm:rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-white">
            <CardContent className="p-6 sm:p-12 text-center space-y-4 sm:space-y-6">
              <div className="mx-auto h-16 w-16 sm:h-20 sm:w-20 bg-[#fff6ee] rounded-2xl sm:rounded-3xl flex items-center justify-center text-[#fd5523] shadow-sm">
                <Building2 className="h-8 w-8 sm:h-10 sm:w-10" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#062e39]">Organization Required</h1>
              <p className="text-base sm:text-lg text-slate-600 max-w-lg mx-auto leading-relaxed px-4">
                To customize your site settings, you must be actively operating within an Organization. Please use the switcher in the header to select or create your Academy Organization.
              </p>
            </CardContent>
          </Card>
        </div>
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
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#fff6ee] to-white">
        <div className="px-4 py-8 sm:px-6 lg:px-8 max-w-6xl mx-auto">
          <Card className="rounded-2xl sm:rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-white">
            <CardContent className="p-6 sm:p-12 text-center">
              <p className="text-slate-600">Organization not found in database.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fff6ee] to-white">
      {/* Mobile-first container with responsive padding */}
      <div className="px-2 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        
        {/* Header Section - Responsive text sizing and spacing */}
        <div className="mb-6 sm:mb-8 lg:mb-10">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#062e39]">
            Academy Identity
          </h1>
          <p className="text-sm sm:text-base lg:text-lg text-slate-500 font-medium mt-2">
            Customize the look and feel of your personalized academy landing page.
          </p>
        </div>

        {/* Grid Layout - Stack on mobile, side-by-side on desktop */}
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 lg:gap-8 xl:gap-10">
          
          {/* Main Content - Takes full width on mobile, 2/3 on desktop */}
          <div className="lg:col-span-2 space-y-6 lg:space-y-8">
            <Card className="rounded-2xl sm:rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-white">
              <CardHeader className="bg-slate-50 border-b border-slate-100 p-5 sm:p-6 lg:p-8">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-[#fd5523]">
                    <Palette className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <CardTitle className="text-xl sm:text-2xl text-[#062e39]">
                    Branding Settings
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
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

          {/* Sidebar - Full width on mobile, 1/3 on desktop */}
          <div className="lg:col-span-1">
            <Card className="rounded-2xl sm:rounded-[2.5rem] border-0 shadow-xl bg-[#062e39] text-white overflow-hidden">
              <CardContent className="p-6 sm:p-8 space-y-4 sm:space-y-6">
                <h3 className="font-bold text-lg sm:text-xl">Your Academy Link</h3>
                <p className="text-sm sm:text-base text-white/70 leading-relaxed">
                  Your academy is securely hosted and isolated on its own custom page. You can share this link directly with your students.
                </p>
                
                {/* URL Display - Responsive font and padding */}
                <div className="bg-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 font-mono text-xs sm:text-sm break-all border border-white/20">
                  https://zedai.academy/academy/{company.slug}
                </div>
                
                {/* Preview Button - Full width on all screens */}
                <a 
                  href={`/academy/${company.slug}`} 
                  target="_blank" 
                  className="block text-center bg-[#fd5523] text-white font-bold py-3 sm:py-3.5 rounded-xl sm:rounded-full hover:bg-[#ef4a16] transition-all duration-300 hover:shadow-lg hover:shadow-[#fd5523]/20 text-sm sm:text-base"
                >
                  Preview Live Site
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}