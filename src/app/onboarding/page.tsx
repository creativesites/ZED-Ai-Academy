import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { afterSignInPath, readSignupIntent, safeRelativePath } from "@/lib/auth/signup-flow";
import { loadInviteWithCompany } from "@/lib/tenants/invites-server";
import { inviteStatus } from "@/lib/tenants/invites";
import { finishInviteOnboarding } from "@/lib/auth/finish-invite-onboarding";
import { OnboardingForm } from "./onboarding-form";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function OnboardingPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const intent = readSignupIntent(searchParams);

  // Academy owners have their own one-step flow.
  if (intent.role === "company_admin" && !intent.invite) {
    redirect("/launch-your-academy");
  }

  const { userId } = await auth();
  if (!userId) {
    if (intent.invite) redirect(`/sign-in?invite=${intent.invite}`);
    redirect(`/sign-in?redirect_url=${encodeURIComponent("/onboarding")}`);
  }

  // Academy invite link: the invite decides the academy, role, courses and
  // group. No role chooser and no academy to pick. If the name is already known
  // (Google, or an existing profile), skip the form and go straight in.
  if (intent.invite) {
    const loaded = await loadInviteWithCompany(intent.invite);
    if (!loaded || loaded.company.status === "suspended" || inviteStatus(loaded.invite) !== "active") {
      redirect(`/i/${intent.invite}`);
    }

    const supabaseForInvite = createServiceClient();
    const [{ data: inviteProfile }, clerkUser] = await Promise.all([
      supabaseForInvite.from("profiles").select("full_name, onboarding_completed").eq("id", userId).maybeSingle(),
      currentUser().catch(() => null),
    ]);
    const clerkName = clerkUser
      ? [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() || clerkUser.fullName?.trim() || ""
      : "";
    const knownName = clerkName || (inviteProfile?.onboarding_completed ? inviteProfile.full_name?.trim() ?? "" : "");

    if (knownName) {
      const result = await finishInviteOnboarding(userId, intent.invite, null);
      // On failure the invite page shows the reason and a retry button.
      redirect(result.ok ? result.redirectUrl : `/i/${intent.invite}`);
    }

    return (
      <OnboardingForm
        presetRole="student"
        tenantSlug={null}
        tenantName={loaded.company.name}
        enrollCourse={null}
        initialCode={null}
        next={null}
        inviteCode={intent.invite}
      />
    );
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
