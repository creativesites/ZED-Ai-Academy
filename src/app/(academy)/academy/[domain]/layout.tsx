import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const supabase = createClient();
  const { userId } = await auth();

  // Fetch tenant info from companies table
  const { data: tenant } = await supabase
    .from("companies")
    .select("*")
    .eq("slug", domain)
    .single();

  if (!tenant) {
    notFound();
  }

  // Handle Suspended Tenant Guard
  if (tenant.status === "suspended") {
    let isSuperAdmin = false;
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      isSuperAdmin = profile?.role === "super_admin";
    }

    if (!isSuperAdmin) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl">
            <div className="h-14 w-14 rounded-2xl bg-rose-500/10 text-rose-500 mx-auto flex items-center justify-center mb-5 border border-rose-500/20">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">
              Academy Suspended
            </h1>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              <strong className="text-white">{tenant.name}</strong> is currently unavailable.
              {tenant.suspended_reason ? ` Reason: ${tenant.suspended_reason}` : " Please reach out to your instructor or platform support for assistance."}
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-xl transition-all"
            >
              Back to Home
            </Link>
          </div>
        </div>
      );
    }
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
