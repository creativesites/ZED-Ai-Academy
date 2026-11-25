import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { TenantNavbar } from "@/components/tenant/TenantNavbar";
import { WhatTeacherKnowsView } from "@/components/tutor/practice/WhatTeacherKnowsView";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantAccess } from "@/lib/tenants/access";
import { loadWhatTeacherKnows } from "@/lib/tutor/learner/teacher-knows-server";

// /academy/[domain]/practice/about-me — "What <Teacher> knows about you" (P1-08). Only the signed-in
// learner's own rows in this academy are read.

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  return { title: `What your teacher knows — ${domain}` };
}

export default async function TenantAboutMePage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=/academy/${domain}/practice/about-me`);

  const supabase = createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug, logo_url, primary_color")
    .eq("slug", domain)
    .single();
  if (!company) notFound();

  const [data, access] = await Promise.all([
    loadWhatTeacherKnows(userId, company.id),
    getCurrentTenantAccess(company.id),
  ]);

  const staffRole = access?.isSuperAdmin
    ? "super_admin"
    : access?.isOwner
      ? "company_admin"
      : (access?.tenantRole ?? null);

  return (
    <>
      <Toaster />
      <TenantNavbar tenant={company} staffRole={staffRole} />
      <WhatTeacherKnowsView
        data={data}
        domain={company.slug}
        backHref={`/academy/${company.slug}/practice`}
        backLabel={`Back to ${company.name} Teacher`}
      />
    </>
  );
}
