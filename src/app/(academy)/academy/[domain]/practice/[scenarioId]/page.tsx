import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { TutorSession } from "@/components/tutor/practice/TutorSession";
import { createClient } from "@/lib/supabase/server";
import { startableModes } from "@/lib/tutor/practice-library";
import { findPracticeScenario } from "@/lib/tutor/server/practice-library";

export const dynamic = "force-dynamic";

// /academy/[domain]/practice/[scenarioId]: full-page AI Teacher practice session inside an academy.
export default async function TenantPracticeSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string; scenarioId: string }>;
  searchParams: Promise<{ lessonId?: string; back?: string }>;
}) {
  const [{ domain, scenarioId }, sp] = await Promise.all([params, searchParams]);
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=/academy/${domain}/practice/${scenarioId}`);

  const supabase = createClient();
  const { data: company } = await supabase.from("companies").select("id, slug").eq("slug", domain).single();
  if (!company) notFound();

  const item = await findPracticeScenario(
    userId,
    scenarioId,
    { kind: "tenant", companyId: company.id },
    { allowLessonOrStaff: true },
  );
  if (!item) notFound();

  const lessonId = typeof sp.lessonId === "string" && sp.lessonId.length > 0 ? sp.lessonId : undefined;
  const safeBack =
    typeof sp.back === "string" && sp.back.startsWith("/") && !sp.back.startsWith("//")
      ? sp.back
      : `/academy/${domain}/practice`;

  return (
    <TutorSession
      origin={lessonId ? "lesson" : "practice"}
      lessonId={lessonId}
      scenarioId={item.id}
      scene={item.scene}
      look={item.personaLook}
      doneHref={safeBack}
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
