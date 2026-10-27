import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { TutorSession } from "@/components/tutor/practice/TutorSession";
import { createClient } from "@/lib/supabase/server";
import { startableModes } from "@/lib/tutor/practice-library";
import { findPracticeScenario } from "@/lib/tutor/server/practice-library";

export const dynamic = "force-dynamic";

// /academy/[domain]/practice/[scenarioId]: one practice session inside an academy.
export default async function TenantPracticeSessionPage({
  params,
}: {
  params: Promise<{ domain: string; scenarioId: string }>;
}) {
  const { domain, scenarioId } = await params;
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=/academy/${domain}/practice/${scenarioId}`);

  const supabase = createClient();
  const { data: company } = await supabase.from("companies").select("id, slug").eq("slug", domain).single();
  if (!company) notFound();

  const item = await findPracticeScenario(userId, scenarioId, { kind: "tenant", companyId: company.id });
  if (!item) notFound();

  return (
    <TutorSession
      origin="practice"
      scenarioId={item.id}
      preview={{
        teacherName: item.personaName ?? undefined,
        title: item.title,
        goal: item.goal,
        maxMinutes: item.maxMinutes,
        modes: startableModes(item.allowedModes),
      }}
    />
  );
}
