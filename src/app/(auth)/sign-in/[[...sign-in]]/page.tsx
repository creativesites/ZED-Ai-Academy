import { SignIn } from "@clerk/nextjs";
import { getSiteAsset } from "@/lib/site-assets";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export const metadata = { title: "Sign In — Zed AI Academy" };

export default async function SignInPage() {
  const bgImage = await getSiteAsset("auth_bg", "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80&auto=format&fit=crop");
  const logoUrl = await getSiteAsset("site_logo", "/images/zed-ai-logo2.png");

  return (
    <div className="flex min-h-screen bg-white overflow-hidden">
      {/* Left: Branding */}
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
              <h1 className="text-5xl font-extrabold tracking-tight leading-[1.1] text-white">
                Master AI workflows that <span className="text-[#fd8d69]">actually ship.</span>
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
                  <CheckCircle2 className="h-5 w-5 text-[#fd5523] shrink-0" />
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
              src='images/logo-dark.png'
              alt="Zed AI Academy"
              className="h-20 w-auto"
            />
            <h2 className="mt-6 text-3xl font-extrabold text-[#062e39] tracking-tight">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-500">
              Pick up where you left off in your AI journey.
            </p>
          </div>

          <div>
            <SignIn
              appearance={{
                elements: {
                  formButtonPrimary:
                    "bg-[#fd5523] hover:bg-[#ef4a16] text-sm font-bold uppercase tracking-widest h-12 rounded-xl transition-all shadow-lg shadow-[#fd5523]/20",
                  // card: "shadow-none border-0 p-0",
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  // socialButtonsBlockButton:
                  //   "h-12 rounded-xl border-slate-200 hover:bg-slate-50 text-slate-600 transition-all font-semibold",
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
          </div>
        </div>
      </div>
    </div>
  );
}
