import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { WhatTeacherKnowsView } from "@/components/tutor/practice/WhatTeacherKnowsView";
import { createServiceClient } from "@/lib/supabase/server";
import { ZEDAI_TENANT_ID } from "@/lib/tenants/constants";
import { loadWhatTeacherKnows } from "@/lib/tutor/learner/teacher-knows-server";

// /practice/about-me — "What <Teacher> knows about you" for the platform academy (P1-08).

export const metadata = { title: "What your teacher knows" };
export const dynamic = "force-dynamic";

export default async function PracticeAboutMePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/practice/about-me");

  const [data, { data: company }] = await Promise.all([
    loadWhatTeacherKnows(userId, ZEDAI_TENANT_ID),
    createServiceClient().from("companies").select("slug").eq("id", ZEDAI_TENANT_ID).maybeSingle(),
  ]);

  return (
    <>
      <Toaster />
      <WhatTeacherKnowsView
        data={data}
        domain={company?.slug ?? "zedai"}
        backHref="/practice"
        backLabel="Back to Teacher"
      />
    </>
  );
}
