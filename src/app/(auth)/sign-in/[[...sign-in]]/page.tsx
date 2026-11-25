import { SignIn } from "@clerk/nextjs";
import { getSiteAsset } from "@/lib/site-assets";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { BRAND, BRAND_LOGOS } from "@/lib/brand";

export const metadata = { title: "Sign In" };

function extractAcademySlugFromRedirect(redirectUrl?: string): string | null {
  if (!redirectUrl) return null;
  let path = redirectUrl;
  if (redirectUrl.startsWith("http://") || redirectUrl.startsWith("https://")) {
    try {
      path = new URL(redirectUrl).pathname;
    } catch {
      return null;
    }
  }
  const match = path.match(/^\/academy\/([^/?#]+)/);
  return match?.[1] ?? null;
}

export default async function SignInPage(props: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url } = await props.searchParams;
  const bgImage = await getSiteAsset("auth_bg", "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80&auto=format&fit=crop");

  const academySlug = extractAcademySlugFromRedirect(redirect_url);
  let tenant: { name: string; logo_url: string | null } | null = null;
  if (academySlug) {
    const supabase = createClient();
    const { data } = await supabase
      .from("companies")
      .select("name, logo_url")
      .eq("slug", academySlug)
      .maybeSingle();
    tenant = data;
  }

  // Platform sign-in always shows the CS Learn logo; tenant sign-ins show the academy logo.
  const displayLogo = tenant?.logo_url || BRAND_LOGOS.onLight.src;
  const displayAlt = tenant?.name || BRAND.fullName;

  return (
    <div className="flex min-h-screen bg-white overflow-hidden">
      {/* Left: Branding */}
      <div className="relative hidden w-0 flex-1 lg:block bg-ink">
        <div className="absolute inset-0 z-0">
          <img
            src={bgImage}
            alt="Background"
            className="h-full w-full object-cover opacity-30 grayscale"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-ink via-ink/80 to-transparent" />
        </div>

        <div className="relative z-10 flex h-full flex-col justify-between p-16 text-white">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors group">
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              Back to home
            </Link>
            <div className="mt-20 max-w-xl">
              <h1 className="text-5xl font-extrabold tracking-tight leading-[1.1] text-white">
                Master AI workflows that <span className="text-brand-electric">actually ship.</span>
              </h1>
              <p className="mt-6 text-xl text-white/60 leading-relaxed">
                Hands-on AI courses built for professionals. Learn tools, build workflows, and get verified.
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
                  <CheckCircle2 className="h-5 w-5 text-brand-text shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Auth Form */}
      <div className="flex flex-1 flex-col justify-center px-6 py-4 sm:px-8 lg:flex-none lg:px-20 xl:px-24 bg-white">
        <div className="mx-auto w-full max-w-sm lg:w-96 flex items-center justify-center flex-col">
          {/* Logo — visible on mobile (left panel is hidden on small screens) */}
          <div className="mb-4 lg:mb-6 flex items-center justify-center flex-col">
            <img
              src={displayLogo}
              alt={displayAlt}
              className="h-20 w-auto object-contain"
            />
            <h2 className="mt-6 text-3xl font-extrabold text-ink tracking-tight">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-500">
              Pick up where you left off in your AI journey.
            </p>
          </div>

          <div>
            <SignIn
              appearance={{
                elements: {
                  formButtonPrimary:
                    "bg-brand hover:bg-brand-hover text-sm font-bold uppercase tracking-widest h-12 rounded-xl transition-all shadow-lg shadow-brand/20",
                  // card: "shadow-none border-0 p-0",
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  // socialButtonsBlockButton:
                  //   "h-12 rounded-xl border-slate-200 hover:bg-slate-50 text-slate-600 transition-all font-semibold",
                  formFieldInput:
                    "h-12 rounded-xl border-slate-200 focus:border-brand/30 focus:ring-brand/20 transition-all",
                  footerActionLink: "text-brand-text hover:text-brand-hover font-bold",
                  identityPreviewTextPrimary: "text-ink font-bold",
                  rootBox: "w-full",
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
