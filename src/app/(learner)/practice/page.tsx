import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PracticeLibrary } from "@/components/tutor/practice/PracticeLibrary";
import { groupByLanguage } from "@/lib/tutor/practice-library";
import { loadPracticeLibrary } from "@/lib/tutor/server/practice-library";

export const metadata = { title: "Practice Room — Zed AI Academy" };
export const dynamic = "force-dynamic";

// /practice: the learner's Practice Room. Shows the library of every academy they belong to, plus the
// platform starter packs.
export default async function PracticeRoomPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/practice");

  const result = await loadPracticeLibrary(userId, { kind: "platform" });
  const items = result.ok ? result.items : [];

  return (
    <PracticeLibrary
      groups={groupByLanguage(items)}
      sessionHref={(id) => `/practice/${id}`}
      browseHref="/courses"
      browseLabel="Browse courses"
      heading="Practise speaking with your AI teacher"
      subheading="Pick a scene and talk it through. Your teacher listens, corrects gently and remembers what you practised."
    />
  );
}
