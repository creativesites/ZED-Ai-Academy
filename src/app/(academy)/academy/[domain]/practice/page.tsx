import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { TenantNavbar } from "@/components/tenant/TenantNavbar";
import { PracticeLibrary } from "@/components/tutor/practice/PracticeLibrary";
import { createClient } from "@/lib/supabase/server";
import { groupByLanguage } from "@/lib/tutor/practice-library";
import { loadPracticeLibrary } from "@/lib/tutor/server/practice-library";
import { loadLearnerTutorOverview } from "@/lib/tutor/server/learner-overview";
import { getCurrentTenantAccess } from "@/lib/tenants/access";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  return { title: `Teacher — ${domain}` };
}

// /academy/[domain]/practice: the Practice Room for one academy. Its tenant library plus the platform packs.
export default async function TenantPracticePage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=/academy/${domain}/practice`);

  const supabase = createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug, logo_url, primary_color")
    .eq("slug", domain)
    .single();
  if (!company) notFound();

  const [result, overview, access] = await Promise.all([
    loadPracticeLibrary(userId, { kind: "tenant", companyId: company.id }),
    loadLearnerTutorOverview(userId, { kind: "tenant", companyId: company.id }).catch(() => undefined),
    getCurrentTenantAccess(company.id),
  ]);
  if (!result.ok) redirect(`/academy/${company.slug}`);

  const staffRole = access?.isSuperAdmin
    ? "super_admin"
    : access?.isOwner
    ? "company_admin"
    : access?.tenantRole ?? null;

  return (
    <>
      <TenantNavbar tenant={company} staffRole={staffRole} />
      <PracticeLibrary
        groups={groupByLanguage(result.items)}
        sessionBasePath={`/academy/${company.slug}/practice`}
        deckHref={`/academy/${company.slug}/practice/deck`}
        historyHref={`/academy/${company.slug}/practice/history`}
        aboutMeHref={`/academy/${company.slug}/practice/about-me`}
        overview={overview}
        browseHref={`/academy/${company.slug}`}
        browseLabel="Back to the academy"
        heading={`Practice with ${company.name}`}
        subheading="Pick a scene and talk it through with your AI teacher. Your teacher listens, corrects gently and remembers what you practised."
      />
    </>
  );
}
