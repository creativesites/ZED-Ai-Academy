import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { LaunchAcademyClient } from "./launch-academy-client";

export const metadata = { title: "Launch your academy — Zed AI Academy" };

/**
 * One form: "Name your academy". Any signed-in user may create an academy;
 * someone who already owns one goes straight to it.
 */
export default async function LaunchYourAcademyPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-up?role=company_admin");
  }

  const supabase = createServiceClient();
  const { data: owned } = await supabase
    .from("companies")
    .select("slug, status")
    .eq("admin_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (owned?.slug && owned.status !== "suspended") {
    redirect(`/academy/${owned.slug}/admin`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-28 pt-8 md:pb-16 md:pt-12">
      <LaunchAcademyClient />
    </div>
  );
}
