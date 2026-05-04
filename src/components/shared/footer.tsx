import Link from "next/link";
import { ArrowRight, BrainCircuit, Mail, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

const FOOTER_LINKS = {
  Explore: [
    { href: "/", label: "Home" },
    { href: "/courses", label: "Courses" },
    { href: "/pricing", label: "Pricing" },
  ],
  Programs: [
    { href: "/courses?category=prompt-engineering", label: "Prompt Engineering" },
    { href: "/courses?category=ai-tools", label: "Workflow Automation" },
    { href: "/courses?category=machine-learning", label: "Machine Learning" },
  ],
  Company: [
    { href: "/pricing#teams", label: "Team Training" },
    { href: "/sign-in", label: "Sign In" },
    { href: "/sign-up", label: "Create Account" },
  ],
};

export function Footer() {
  return (
    <footer className="relative mt-16 overflow-hidden bg-[#062e39] text-white">
      <div
        className="absolute inset-0 opacity-20"
        style={{ backgroundImage: "url('/logistiq-images/pattern/footer-v1-pattern.png')" }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_1.6fr]">
          <div className="marketing-pattern-grid noise rounded-[2rem] border border-white/10 bg-white/6 p-7 md:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fd5523] text-white shadow-[0_16px_32px_rgba(253,85,35,0.25)]">
                <BrainCircuit className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#fd8d69]">Zed AI</p>
                <p className="text-2xl font-semibold tracking-[-0.04em] text-white">Academy</p>
              </div>
            </div>

            <p className="mt-6 max-w-md text-base leading-7 text-white/72">
              Practical AI education for learners and teams who need usable capability, not vague inspiration.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/8 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#fd8d69]">Contact</p>
                <a href="mailto:hello@zedaiacademy.com" className="mt-3 inline-flex items-center gap-2 text-sm text-white/78 hover:text-white">
                  <Mail className="h-4 w-4 text-[#fd5523]" />
                  hello@zedaiacademy.com
                </a>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/8 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#fd8d69]">Location</p>
                <p className="mt-3 inline-flex items-center gap-2 text-sm text-white/78">
                  <MapPin className="h-4 w-4 text-[#fd5523]" />
                  Lusaka, Zambia
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button className="rounded-full bg-[#fd5523] px-6 text-white hover:bg-[#ef4a16]" render={<Link href="/sign-up" />}>
                Start Learning
              </Button>
              <Button
                variant="outline"
                className="rounded-full border-white/18 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white"
                render={<Link href="/pricing#teams" />}
              >
                Team Plans
              </Button>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(FOOTER_LINKS).map(([section, links]) => (
              <div key={section} className="rounded-[1.75rem] border border-white/10 bg-white/6 p-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-[#fd8d69]">{section}</h3>
                <ul className="mt-5 space-y-3">
                  {links.map(({ href, label }) => (
                    <li key={href}>
                      <Link href={href} className="inline-flex items-center gap-2 text-sm text-white/72 hover:text-white">
                        <ArrowRight className="h-4 w-4 text-[#fd5523]" />
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="rounded-[1.75rem] border border-white/10 bg-white/6 p-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-[#fd8d69]">Support</h3>
              <p className="mt-5 text-sm leading-6 text-white/72">
                Need onboarding help, billing support, or a private cohort for your team?
              </p>
              <a href="tel:+260977000000" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-white">
                <Phone className="h-4 w-4 text-[#fd5523]" />
                Talk to admissions
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Zed AI Academy. All rights reserved.</p>
          <p>Built for ambitious teams learning AI in public and in practice.</p>
        </div>
      </div>
    </footer>
  );
}
