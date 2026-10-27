import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import Layout from "@/components/layout/Layout";
import { AiTutorShowcase } from "@/components/tutor/showcase/AiTutorShowcase";

const TITLE = "AI Tutor — Zed AI Academy";
const DESCRIPTION =
  "Practise Mandarin, Spanish, French and English for healthcare out loud with ZAI Tutor, an AI teacher who listens, corrects gently and gives you a report after every session.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    siteName: "Zed AI Academy",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// Public page. Watching the demo needs no account. Talking to the teacher is gated in the client,
// using the signed-in state the server reads here.
export default async function AiTutorPage() {
  const { userId } = await auth();

  return (
    <Layout headerStyle={2} footerStyle={1} breadcrumbTitle="AI Tutor">
      <AiTutorShowcase signedIn={Boolean(userId)} />
    </Layout>
  );
}
