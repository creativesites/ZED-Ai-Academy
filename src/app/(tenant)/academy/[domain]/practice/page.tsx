import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { TenantNavbar } from "@/components/tenant/TenantNavbar";
import { PracticeLibrary } from "@/components/tutor/practice/PracticeLibrary";
import { createClient } from "@/lib/supabase/server";
import { groupByLanguage } from "@/lib/tutor/practice-library";
import { loadPracticeLibrary } from "@/lib/tutor/server/practice-library";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  return { title: `Practice Room — ${domain}` };
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

  const result = await loadPracticeLibrary(userId, { kind: "tenant", companyId: company.id });
  if (!result.ok) redirect(`/academy/${company.slug}`);

  return (
    <>
      <TenantNavbar tenant={company} />
      <PracticeLibrary
        groups={groupByLanguage(result.items)}
        sessionHref={(id) => `/academy/${company.slug}/practice/${id}`}
        browseHref={`/academy/${company.slug}`}
        browseLabel="Back to the academy"
        heading={`Practice with ${company.name}`}
        subheading="Pick a scene and talk it through with your AI teacher. Your teacher listens, corrects gently and remembers what you practised."
      />
    </>
  );
}
