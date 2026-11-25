import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { VocabDeckReview } from "@/components/tutor/practice/VocabDeckReview";
import { loadLearnerDeck } from "@/lib/tutor/server/learner-overview";

export const metadata = { title: "Cards — Teacher" };
export const dynamic = "force-dynamic";

export default async function PracticeDeckPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/practice/deck");

  const cards = await loadLearnerDeck(userId).catch(() => []);

  return (
    <>
      <Toaster />
      <VocabDeckReview
        initialCards={cards}
        backHref="/practice"
        backLabel="Back to Teacher"
      />
    </>
  );
}
