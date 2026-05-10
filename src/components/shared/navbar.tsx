import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton, SignUpButton, UserButton, OrganizationSwitcher } from "@clerk/nextjs";
import { ArrowRight, BrainCircuit, LayoutDashboard, Mail, MapPin, Menu, Phone, Rocket, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { createServiceClient } from "@/lib/supabase/server";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/courses", label: "Courses" },
  { href: "/pricing", label: "Pricing" },
  { href: "/pricing#teams", label: "Teams" },
];

function BrandLockup() {
  return (
    <Link href="/" className="group flex items-center gap-3">
      <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fd5523] text-white shadow-[0_16px_34px_rgba(253,85,35,0.3)]">
        <span className="absolute inset-0 rounded-2xl border border-white/20" />
        <BrainCircuit className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-sm font-semibold uppercase tracking-[0.24em] text-[#fd5523]">Zed AI</span>
        <span className="text-lg font-semibold tracking-[-0.04em] text-[#062e39]">Academy</span>
      </div>
    </Link>
  );
}

export async function Navbar() {
  const { userId, orgId } = await auth();

  let isAdmin = false;
  let isLearner = false;
  let needsAcademyLaunch = false;
  if (userId) {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("profiles")
      .select("role, onboarding_completed")
      .eq("id", userId)
      .single();
    isAdmin = data?.role === "super_admin" || data?.role === "instructor";
    isLearner = data?.role === "learner";
    if (data?.role === "company_admin" && data.onboarding_completed) {
      const { companyAdminNeedsAcademySetup } = await import("@/lib/company-admin-setup");
      needsAcademyLaunch = await companyAdminNeedsAcademySetup(userId, orgId);
    }
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="hidden border-b border-white/10 bg-[#062e39] text-white md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 text-sm lg:px-8">
          <div className="flex flex-wrap items-center gap-6 text-white/75">
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#fd5523]" />
              Zambia-first AI learning for modern teams
            </span>
            <a href="mailto:hello@zedaiacademy.com" className="inline-flex items-center gap-2 hover:text-white">
              <Mail className="h-4 w-4 text-[#fd5523]" />
              hello@zedaiacademy.com
            </a>
          </div>

          <div className="flex items-center gap-5 text-white/75">
            <a href="tel:+260977000000" className="inline-flex items-center gap-2 hover:text-white">
              <Phone className="h-4 w-4 text-[#fd5523]" />
              Talk to admissions
            </a>
            <Link href="/pricing#teams" className="inline-flex items-center gap-2 font-medium text-white">
              Team cohorts
              <ArrowRight className="h-4 w-4 text-[#fd5523]" />
            </Link>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="marketing-card flex items-center justify-between rounded-[28px] px-4 py-3 sm:px-5">
            <BrandLockup />

            <nav className="hidden items-center gap-1 rounded-full border border-slate-200/70 bg-white/70 px-2 py-2 lg:flex">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition-all hover:bg-[#062e39] hover:text-white"
                >
                  {label}
                </Link>
              ))}
            </nav>

            <div className="hidden items-center gap-3 lg:flex">
              {userId ? (
                <>
                  {needsAcademyLaunch && (
                    <Link
                      href="/launch-your-academy"
                      className="inline-flex items-center gap-2 rounded-full border border-[#fd5523]/40 bg-[#fd5523]/10 px-4 py-2 text-sm font-semibold text-[#fd5523] transition-colors hover:bg-[#fd5523] hover:text-white"
                    >
                      <Rocket className="h-4 w-4" />
                      Open your academy
                    </Link>
                  )}
                  <Link
                    href={isAdmin ? "/creator/courses" : "/dashboard"}
                    className="inline-flex items-center gap-2 rounded-full bg-[#062e39] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0a4055]"
                  >
                    <LayoutDashboard className="h-4 w-4 text-[#fd5523]" />
                    Dashboard
                  </Link>
                  {!isLearner && (
                    <OrganizationSwitcher 
                      appearance={{
                        elements: {
                          organizationSwitcherTrigger: "rounded-full bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#062e39]",
                        }
                      }}
                    />
                  )}
                  <UserButton />
                </>
              ) : (
                <>
                  <SignInButton mode="redirect">
                    <Button
                      variant="ghost"
                      className="rounded-full px-5 text-sm font-medium text-slate-600 hover:bg-[#fff6ee] hover:text-[#062e39]"
                    >
                      Sign in
                    </Button>
                  </SignInButton>
                  <SignUpButton mode="redirect">
                    <Button className="rounded-full bg-[#fd5523] px-5 text-sm font-semibold text-white hover:bg-[#ef4a16]">
                      Start free
                    </Button>
                  </SignUpButton>
                </>
              )}
            </div>

            <div className="lg:hidden">
              <Sheet>
                <SheetTrigger render={<Button variant="ghost" size="icon" className="rounded-full text-[#062e39]" />}>
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open navigation</span>
                </SheetTrigger>
                <SheetContent side="right" className="w-[320px] border-l border-slate-200 bg-[#fffaf6] p-0">
                  <div className="flex h-full flex-col">
                    <SheetHeader className="border-b border-slate-200 px-6 py-5 text-left">
                      <SheetTitle>
                        <BrandLockup />
                      </SheetTitle>
                    </SheetHeader>

                    <div className="flex flex-1 flex-col gap-3 px-6 py-6">
                      {NAV_LINKS.map(({ href, label }) => (
                        <Link
                          key={href}
                          href={href}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-medium text-[#062e39] shadow-sm"
                        >
                          {label}
                        </Link>
                      ))}

                      <div className="rounded-[1.75rem] bg-[#062e39] p-5 text-white">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#fd8d69]">Need a team plan?</p>
                        <p className="mt-3 text-sm leading-6 text-white/75">
                          We help companies roll out practical AI training across operations, marketing, and product teams.
                        </p>
                        <Link href="/pricing#teams" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white">
                          See team pricing
                          <ArrowRight className="h-4 w-4 text-[#fd5523]" />
                        </Link>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 px-6 py-5">
                      {userId ? (
                        <div className="space-y-3">
                          {needsAcademyLaunch && (
                            <Link
                              href="/launch-your-academy"
                              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#fd5523] to-[#ff7a45] px-4 py-3 text-base font-semibold text-white shadow-lg shadow-[#fd5523]/25"
                            >
                              <Rocket className="h-5 w-5" />
                              Open your academy
                            </Link>
                          )}
                          <Link
                            href={isAdmin ? "/creator/courses" : "/dashboard"}
                            className="flex items-center gap-2 rounded-2xl border border-[#062e39] bg-[#062e39] px-4 py-3 text-base font-medium text-white"
                          >
                            <LayoutDashboard className="h-5 w-5 text-[#fd5523]" />
                            Dashboard
                          </Link>
                          {!isLearner && (
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-slate-600">Team</p>
                              <OrganizationSwitcher />
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-slate-600">Account</p>
                            <UserButton />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          <SignInButton mode="redirect">
                            <Button variant="outline" className="h-12 rounded-full border-slate-300 text-base">
                              Sign in
                            </Button>
                          </SignInButton>
                          <SignUpButton mode="redirect">
                            <Button className="h-12 rounded-full bg-[#fd5523] text-base font-semibold text-white hover:bg-[#ef4a16]">
                              Start free
                            </Button>
                          </SignUpButton>
                        </div>
                      )}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
