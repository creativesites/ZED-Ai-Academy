import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { SpeakingHistoryView } from "@/components/tutor/practice/SpeakingHistoryView";
import { loadLearnerSessionHistory } from "@/lib/tutor/server/learner-overview";

export const metadata = { title: "Speaking History — Teacher's Room" };
export const dynamic = "force-dynamic";

export default async function PracticeHistoryPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/practice/history");

  const sessions = await loadLearnerSessionHistory(userId, { kind: "platform" }).catch(() => []);

  return (
    <>
      <Toaster />
      <SpeakingHistoryView
        initialSessions={sessions}
        backHref="/practice"
        backLabel="Back to Teacher's Room"
        sessionHref={(id) => `/practice/${id}`}
      />
    </>
  );
}
