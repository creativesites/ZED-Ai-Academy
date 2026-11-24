import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { TenantNavbar } from "@/components/tenant/TenantNavbar";
import { SpeakingHistoryView } from "@/components/tutor/practice/SpeakingHistoryView";
import { createClient } from "@/lib/supabase/server";
import { loadLearnerSessionHistory } from "@/lib/tutor/server/learner-overview";
import { getCurrentTenantAccess } from "@/lib/tenants/access";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  return { title: `Speaking History — ${domain}` };
}

export default async function TenantPracticeHistoryPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=/academy/${domain}/practice/history`);

  const supabase = createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug, logo_url, primary_color")
    .eq("slug", domain)
    .single();
  if (!company) notFound();

  const [sessions, access] = await Promise.all([
    loadLearnerSessionHistory(userId, {
      kind: "tenant",
      companyId: company.id,
    }).catch(() => []),
    getCurrentTenantAccess(company.id),
  ]);

  const staffRole = access?.isSuperAdmin
    ? "super_admin"
    : access?.isOwner
    ? "company_admin"
    : access?.tenantRole ?? null;

  return (
    <>
      <Toaster />
      <TenantNavbar tenant={company} staffRole={staffRole} />
      <SpeakingHistoryView
        initialSessions={sessions}
        backHref={`/academy/${company.slug}/practice`}
        backLabel={`Back to ${company.name} Teacher's Room`}
        sessionBasePath={`/academy/${company.slug}/practice`}
      />
    </>
  );
}
