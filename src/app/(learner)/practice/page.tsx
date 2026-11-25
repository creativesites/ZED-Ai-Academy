import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PracticeLibrary } from "@/components/tutor/practice/PracticeLibrary";
import { groupByLanguage } from "@/lib/tutor/practice-library";
import { loadPracticeLibrary } from "@/lib/tutor/server/practice-library";
import { loadLearnerTutorOverview } from "@/lib/tutor/server/learner-overview";

export const metadata = { title: "Teacher" };
export const dynamic = "force-dynamic";

// /practice: the learner's Practice Room. Shows the library of every academy they belong to, plus the
// platform starter packs.
export default async function PracticeRoomPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/practice");

  const [result, overview] = await Promise.all([
    loadPracticeLibrary(userId, { kind: "platform" }),
    loadLearnerTutorOverview(userId, { kind: "platform" }).catch(() => undefined),
  ]);
  const items = result.ok ? result.items : [];

  return (
    <PracticeLibrary
      groups={groupByLanguage(items)}
      sessionBasePath="/practice"
      deckHref="/practice/deck"
      historyHref="/practice/history"
      aboutMeHref="/practice/about-me"
      overview={overview}
      browseHref="/courses"
      browseLabel="Browse courses"
      heading="Practise speaking with your AI teacher"
      subheading="Pick a scene and talk it through. Your teacher listens, corrects gently and remembers what you practised."
    />
  );
}
