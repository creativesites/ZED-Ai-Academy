import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { TutorSession } from "@/components/tutor/practice/TutorSession";
import { startableModes } from "@/lib/tutor/practice-library";
import { findPracticeScenario } from "@/lib/tutor/server/practice-library";

export const dynamic = "force-dynamic";

// /practice/[scenarioId]: full-page AI Teacher practice session.
export default async function PracticeSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ scenarioId: string }>;
  searchParams: Promise<{ lessonId?: string; back?: string }>;
}) {
  const [{ scenarioId }, sp] = await Promise.all([params, searchParams]);
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=/practice/${scenarioId}`);

  const item = await findPracticeScenario(userId, scenarioId, { kind: "platform" }, { allowLessonOrStaff: true });
  if (!item) notFound();

  const lessonId = typeof sp.lessonId === "string" && sp.lessonId.length > 0 ? sp.lessonId : undefined;
  const safeBack =
    typeof sp.back === "string" && sp.back.startsWith("/") && !sp.back.startsWith("//")
      ? sp.back
      : "/practice";

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
