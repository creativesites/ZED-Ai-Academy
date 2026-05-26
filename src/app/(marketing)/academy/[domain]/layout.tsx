import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const supabase = createClient();

  // Fetch tenant info from companies table
  const { data: tenant } = await supabase
    .from("companies")
    .select("*")
    .eq("slug", domain)
    .single();


  if (!tenant) {
    notFound();
  }

  // Inject Custom Styling via CSS variables
  const primaryColor = tenant.primary_color || "#fd5523";

  return (
    <div style={{ "--primary-color": primaryColor } as React.CSSProperties} className="tenant-wrapper min-h-screen bg-slate-50">
      {/* Custom Tenant Header */}
      {/* <header className="p-4 border-b bg-white shadow-sm flex items-center justify-between sticky top-0 z-50">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div className="font-bold text-2xl tracking-tight text-slate-900 flex items-center gap-3">
            {tenant.logo_url && (
              <img src={tenant.logo_url} alt={tenant.name} className="h-8 w-auto rounded" />
            )}
            {tenant.name}
          </div>
        </div>
      </header> */}

      <main>
        {children}
      </main>
    </div>
  );
}
