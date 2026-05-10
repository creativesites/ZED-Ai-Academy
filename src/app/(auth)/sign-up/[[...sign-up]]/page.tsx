import { SignUp } from "@clerk/nextjs";
import { getSiteAsset } from "@/lib/site-assets";
import Link from "next/link";
import { ArrowLeft, Rocket, CheckCircle2, Building2, GraduationCap, Users } from "lucide-react";

export const metadata = { title: "Join — Zed AI Academy" };

export default async function SignUpPage(props: { searchParams: Promise<{ enroll_course?: string; role?: string; tenant?: string }> }) {
  const { enroll_course, role, tenant } = await props.searchParams;
  const bgImage = await getSiteAsset("auth_bg", "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80&auto=format&fit=crop");

  const normalizedRole = role === "company_admin" || role === "teacher" || role === "student" ? role : null;
  const redirectParams = new URLSearchParams();
  if (normalizedRole) redirectParams.set("role", normalizedRole);
  if (enroll_course) redirectParams.set("enroll_course", enroll_course);
  if (tenant) redirectParams.set("tenant", tenant);
  const forceRedirectUrl = `/onboarding${redirectParams.toString() ? `?${redirectParams.toString()}` : ""}`;

  const roleChoices = [
    {
      href: "/sign-up?role=student",
      title: "Student",
      description: "Join courses, classrooms, and academies as a learner.",
      icon: GraduationCap,
    },
    {
      href: "/sign-up?role=teacher",
      title: "Teacher",
      description: "Join a tenant academy as a teacher from its academy page.",
      icon: Users,
    },
    {
      href: "/sign-up?role=company_admin",
      title: "Tutor / School Owner",
      description: "Create your own academy tenant and manage students.",
      icon: Building2,
    },
  ];

  const roleLabel =
    normalizedRole === "company_admin" ? "Create your academy owner account" :
    normalizedRole === "teacher" ? "Create your teacher account" :
    normalizedRole === "student" ? "Create your student account" :
    "Choose how you want to join";

  return (
    <div className="flex min-h-screen bg-white overflow-hidden">
      {/* Left: Branding & Value Proposition */}
      <div className="relative hidden w-0 flex-1 lg:block bg-[#062e39]">
        <div className="absolute inset-0 z-0">
          <img
            src={bgImage}
            alt="Background"
            className="h-full w-full object-cover opacity-30 grayscale"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#062e39] via-[#062e39]/80 to-transparent" />
        </div>

        <div className="relative z-10 flex h-full flex-col justify-between p-16 text-white">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors group">
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              Back to home
            </Link>
            <div className="mt-20 max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#fd5523]/20 px-4 py-1 text-xs font-bold uppercase tracking-widest text-[#fd5523] ring-1 ring-[#fd5523]/30">
                <Rocket className="h-3 w-3" />
                Join the Academy
              </div>
              <h1 className="mt-8 text-5xl font-extrabold tracking-tight leading-[1.1] text-white">
                Your transformation <br />
                <span className="text-[#fd8d69]">starts here.</span>
              </h1>
              <p className="mt-6 text-xl text-white/60 leading-relaxed">
                Get access to the AI Coach, Practice Studio, and verified certificates — built for Africa.
              </p>
            </div>
          </div>

          <div className="space-y-8">
            <div className="space-y-4">
              {[
                "Step-by-step AI workflow training",
                "AI Coach: lesson-aware assistance",
                "Practice Studio: hands-on prompt engineering",
                "Verified certificates for your career",
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-3 text-white/80 font-medium">
                  <CheckCircle2 className="h-5 w-5 text-[#fd5523] shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 pt-8">
              <p className="text-sm text-white/40 leading-relaxed">
                Zed AI Academy is built for professionals in Zambia and across Africa — mobile-first, practical, and career-focused.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Auth Form */}
      <div className="flex flex-1 flex-col justify-center px-6 py-4 sm:px-8 lg:flex-none lg:px-20 xl:px-24 bg-white">
        <div className="mx-auto w-full max-w-sm lg:w-96 flex items-center justify-center flex-col">
          {/* Logo — visible on all screen sizes */}
          <div className="mb-4 lg:mb-6 flex items-center justify-center flex-col">
            <img
              src='images/logo-dark.png'
              alt="Zed AI Academy"
              className="h-20 w-auto"
            />
            <h2 className="mt-6 text-3xl font-extrabold text-[#062e39] tracking-tight">{roleLabel}</h2>
            <p className="mt-2 text-sm text-slate-500">
              {normalizedRole ? "You can change account details after signing in." : "This keeps learner and tenant-owner permissions separate."}
            </p>
          </div>

          {!normalizedRole ? (
            <div className="w-full space-y-3">
              {roleChoices.map((choice) => {
                const Icon = choice.icon;
                const choiceParams = new URLSearchParams(choice.href.split("?")[1]);
                if (tenant) choiceParams.set("tenant", tenant);
                if (enroll_course) choiceParams.set("enroll_course", enroll_course);
                const href = `/sign-up?${choiceParams.toString()}`;
                return (
                  <Link
                    key={choice.href}
                    href={href}
                    className="group flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-[#fd5523]/40 hover:bg-[#fff6ee]"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-[#fd5523] transition-all group-hover:bg-[#fd5523] group-hover:text-white">
                      <Icon className="h-6 w-6" />
                    </span>
                    <span>
                      <span className="block font-bold text-[#062e39]">{choice.title}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-500">{choice.description}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div>
              <SignUp
                forceRedirectUrl={forceRedirectUrl}
                appearance={{
                  elements: {
                    formButtonPrimary:
                      "bg-[#fd5523] hover:bg-[#ef4a16] text-sm font-bold uppercase tracking-widest h-12 rounded-xl transition-all shadow-lg shadow-[#fd5523]/20",
                    card: "shadow-none border-0",
                    headerTitle: "hidden",
                    headerSubtitle: "hidden",
                    socialButtonsBlockButton:
                      "h-12 rounded-xl border-slate-200 hover:bg-slate-50 text-slate-600 transition-all font-semibold",
                    formFieldInput:
                      "h-12 rounded-xl border-slate-200 focus:border-[#fd5523]/30 focus:ring-[#fd5523]/20 transition-all",
                    footerActionLink: "text-[#fd5523] hover:text-[#ef4a16] font-bold",
                    identityPreviewTextPrimary: "text-[#062e39] font-bold",
                    rootBox: "w-full",
                  },
                  layout: {
                    socialButtonsPlacement: "bottom",
                    showOptionalFields: false,
                  },
                }}
              />
              <Link href="/sign-up" className="mt-4 block text-center text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-[#fd5523]">
                Choose a different account type
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
