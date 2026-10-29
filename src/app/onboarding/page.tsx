import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { afterSignInPath, readSignupIntent, safeRelativePath } from "@/lib/auth/signup-flow";
import { OnboardingForm } from "./onboarding-form";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function OnboardingPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const intent = readSignupIntent(searchParams);

  // Academy owners have their own one-step flow.
  if (intent.role === "company_admin") {
    redirect("/launch-your-academy");
  }

  const { userId } = await auth();
  if (!userId) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent("/onboarding")}`);
  }

  const supabase = createServiceClient();
  const [{ data: profile }, { data: tenant }] = await Promise.all([
    supabase.from("profiles").select("onboarding_completed").eq("id", userId).maybeSingle(),
    intent.tenant
      ? supabase.from("companies").select("name, slug, status").eq("slug", intent.tenant).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Already onboarded (e.g. an existing account that used an invite link): the
  // join page adds the membership without asking for details again.
  if (profile?.onboarding_completed && intent.tenant) {
    redirect(afterSignInPath(intent));
  }

  const rawNext = Array.isArray(searchParams.next) ? searchParams.next[0] : searchParams.next;
  const validTenant = tenant && tenant.status !== "suspended" ? tenant : null;

  return (
    <OnboardingForm
      presetRole={intent.role === "teacher" || intent.role === "student" ? intent.role : null}
      tenantSlug={validTenant?.slug ?? null}
      tenantName={validTenant?.name ?? null}
      enrollCourse={intent.enrollCourse}
      initialCode={intent.role === "teacher" ? intent.code : null}
      next={safeRelativePath(rawNext)}
    />
  );
}
