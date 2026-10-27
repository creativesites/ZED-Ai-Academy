import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { TutorSession } from "@/components/tutor/practice/TutorSession";
import { startableModes } from "@/lib/tutor/practice-library";
import { findPracticeScenario } from "@/lib/tutor/server/practice-library";

export const dynamic = "force-dynamic";

// /practice/[scenarioId]: one practice session. Only scenarios in the learner's library can be opened.
export default async function PracticeSessionPage({ params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = await params;
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=/practice/${scenarioId}`);

  const item = await findPracticeScenario(userId, scenarioId, { kind: "platform" });
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
