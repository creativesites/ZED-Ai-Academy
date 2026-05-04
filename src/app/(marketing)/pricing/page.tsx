import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Building2, User, Mail } from "lucide-react";
import type { Metadata } from "next";
import Layout from "@/components/layout/Layout";
import { PlanEnrollModal } from "@/components/pricing/PlanEnrollModal";
import { currentUser } from "@clerk/nextjs/server";

export const metadata: Metadata = {
  title: "Pricing — Zed AI Academy",
  description: "Simple, transparent pricing for individuals and teams.",
};

const INDIVIDUAL_PLANS = [
  {
    name: "Free",
    price: null,
    priceLabel: "Free",
    description: "Start learning with curated free courses — no credit card needed.",
    cta: "Get started free",
    href: "/sign-up",
    highlight: false,
    features: [
      "Access to all free courses",
      "AI Tutor in free lessons",
      "Progress tracking",
      "Completion certificates",
    ],
  },
  {
    name: "Pro",
    price: 299,
    priceLabel: "ZMW 299",
    period: "/month",
    description: "Unlimited access to every course, live and on-demand.",
    cta: "Start Pro — ZMW 299/mo",
    href: "/sign-up?plan=pro",
    highlight: true,
    badge: "Most popular",
    features: [
      "Everything in Free",
      "Unlimited paid course access",
      "Priority AI Tutor responses",
      "Download resources",
      "Early access to new courses",
      "Community forum access",
    ],
  },
  {
    name: "Pro Annual",
    price: 2499,
    priceLabel: "ZMW 2,499",
    period: "/year",
    savings: "Save ZMW 1,089",
    description: "Full Pro access billed once a year — 30% cheaper.",
    cta: "Start Annual — ZMW 2,499/yr",
    href: "/sign-up?plan=pro_annual",
    highlight: false,
    badge: "Best value",
    features: [
      "Everything in Pro",
      "30% annual discount",
      "Offline lesson downloads",
      "Dedicated account support",
    ],
  },
];

const TEAM_TIERS = [
  { seats: "5–9 seats", pricePerSeat: 249, saving: null },
  { seats: "10–24 seats", pricePerSeat: 219, saving: "Save 27%" },
  { seats: "25–49 seats", pricePerSeat: 189, saving: "Save 37%" },
  { seats: "50+ seats", pricePerSeat: null, saving: "Custom pricing" },
];

const TEAM_FEATURES = [
  "All Pro course content",
  "Centralised team dashboard",
  "Seat allocation & transfers",
  "Bulk course assignments",
  "Org-level progress analytics",
  "Team completion leaderboards",
  "Dedicated account manager (50+ seats)",
  "SSO / SAML (50+ seats)",
  "Custom onboarding workshop",
  "Priority support",
];

const FAQS = [
  {
    q: "Can I pay with MTN MoMo or Airtel Money?",
    a: "Yes — we accept MTN Mobile Money, Airtel Money, Visa, and Mastercard. All prices are in Zambian Kwacha (ZMW).",
  },
  {
    q: "Can I access courses after my subscription ends?",
    a: "No — subscription courses require an active plan. Courses you bought individually (one-time purchase) are yours for life.",
  },
  {
    q: "How do team seats work?",
    a: "You purchase a block of seats. Each seat can be assigned to one team member who gets full Pro access. You can reassign seats as your team changes.",
  },
  {
    q: "Is there a free trial for Pro?",
    a: "We don't offer a time-limited trial, but you can start with our Free plan — it gives you full access to every free course and the AI Tutor with no obligation.",
  },
  {
    q: "Can I get an invoice for my company?",
    a: "Yes. Contact us after purchase and we'll email a formal invoice in ZMW for your finance team.",
  },
];

export default async function PricingPage() {
  const user = await currentUser();

  return (
    <Layout headerStyle={2} footerStyle={1} breadcrumbTitle="Pricing Plans">
      <div className="min-h-screen py-20">
        {/* Hero */}
        <section className="px-4 sm:px-6 lg:px-8 mb-16">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[3rem] border border-slate-200 bg-[#062e39] px-6 py-20 text-center text-white shadow-[0_24px_80px_rgba(6,46,57,0.2)] sm:px-8 sm:py-24 relative">
             <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
            <div className="mx-auto max-w-3xl relative z-10">
              <Badge className="mb-6 border-white/20 bg-white/10 text-[#fd8d69] hover:bg-white/10 px-4 py-1 rounded-full uppercase tracking-widest text-[10px] font-bold">
              <Zap className="mr-2 h-3.5 w-3.5" /> Zambia-first pricing
              </Badge>
              <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-6xl mb-6">
              Simple, transparent <span className="text-[#fd5523]">pricing.</span>
              </h1>
              <p className="text-xl leading-relaxed text-white/70 max-w-2xl mx-auto">
                All prices in Zambian Kwacha. Pay securely with MTN MoMo, Airtel Money, or card.
              </p>
            </div>
          </div>
        </section>

        {/* Individual plans */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-12 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-[#fff2e9] shadow-lg shadow-[#fd5523]/5">
              <User className="h-6 w-6 text-[#fd5523]" />
            </div>
            <div>
              <h2 className="text-3xl font-extrabold text-[#062e39] tracking-tight">Individual Plans</h2>
              <p className="text-slate-500 font-medium">For learners growing their AI skills.</p>
            </div>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {INDIVIDUAL_PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-[2.5rem] border p-10 transition-all duration-300 hover:scale-[1.02] ${
                  plan.highlight
                    ? "border-[#fd5523]/60 bg-gradient-to-br from-[#062e39] to-[#0a4055] text-white shadow-2xl shadow-[#062e39]/20"
                    : "border-slate-100 bg-white shadow-[0_24px_60px_rgba(6,46,57,0.06)]"
                }`}
              >
                {plan.badge && (
                  <span
                    className={`absolute -top-4 left-1/2 -translate-x-1/2 rounded-full px-6 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl ${
                      plan.highlight
                        ? "bg-[#fd5523] text-white"
                        : "bg-[#062e39] text-white"
                    }`}
                  >
                    {plan.badge}
                  </span>
                )}

                <div className="mb-8">
                  <p
                    className={`mb-2 text-xs font-black uppercase tracking-[0.2em] ${
                      plan.highlight ? "text-[#fd8d69]" : "text-slate-400"
                    }`}
                  >
                    {plan.name}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-5xl font-black tracking-tighter ${plan.highlight ? "text-white" : "text-[#062e39]"}`}
                    >
                      {plan.priceLabel}
                    </span>
                    {plan.period && (
                      <span className={plan.highlight ? "text-white/50 font-bold" : "text-slate-400 font-bold"}>
                        {plan.period}
                      </span>
                    )}
                  </div>
                  {plan.savings && (
                    <p
                      className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold ${
                        plan.highlight ? "bg-white/10 text-[#fd8d69]" : "bg-green-50 text-green-600"
                      }`}
                    >
                      {plan.savings}
                    </p>
                  )}
                  <p
                    className={`mt-6 text-base leading-relaxed ${plan.highlight ? "text-white/70" : "text-slate-500"}`}
                  >
                    {plan.description}
                  </p>
                </div>

                <ul className="mb-10 flex-1 space-y-4">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm font-medium">
                      <div className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                        plan.highlight ? "bg-[#fd5523]/20" : "bg-slate-50"
                      }`}>
                        <Check
                          className={`h-3 w-3 ${
                            plan.highlight ? "text-[#fd5523]" : "text-[#fd5523]"
                          }`}
                        />
                      </div>
                      <span className={plan.highlight ? "text-white/90" : "text-slate-600"}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <PlanEnrollModal 
                  planName={plan.name}
                  priceLabel={plan.priceLabel}
                  userName={user?.fullName || ""}
                  userEmail={user?.primaryEmailAddress?.emailAddress || ""}
                />
              </div>
            ))}
          </div>

          <p className="mt-12 text-center text-sm font-medium text-slate-400">
            Individual course purchases also available — buy once, own forever.{" "}
            <Link href="/courses" className="text-[#fd5523] font-bold hover:underline">
              Browse courses →
            </Link>
          </p>
        </section>

        <hr className="mx-auto max-w-6xl border-slate-100 px-4" />

        {/* Teams / B2B */}
        <section
          id="teams"
          className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8"
        >
          <div className="mb-16 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-[#fff2e9] shadow-lg shadow-[#fd5523]/5">
              <Building2 className="h-6 w-6 text-[#062e39]" />
            </div>
            <div>
              <h2 className="text-3xl font-extrabold text-[#062e39] tracking-tight">Team & Company Plans</h2>
              <p className="text-slate-500 font-medium">
                Train your whole team. Volume discounts start at 5 seats.
              </p>
            </div>
          </div>

          <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
            {/* Seat tiers */}
            <div className="space-y-4">
              <h3 className="mb-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 px-2">
                Tiered Seat Pricing
              </h3>
              {TEAM_TIERS.map((tier) => (
                <div
                  key={tier.seats}
                  className="flex items-center justify-between rounded-[2rem] border-2 border-slate-50 bg-white p-6 shadow-sm hover:border-[#fd5523]/10 transition-all"
                >
                  <div>
                    <p className="text-lg font-bold text-[#062e39]">{tier.seats}</p>
                    {tier.saving && (
                      <p className="text-xs font-black uppercase text-green-600 mt-1">{tier.saving}</p>
                    )}
                  </div>
                  <div className="text-right">
                    {tier.pricePerSeat ? (
                      <>
                        <p className="text-2xl font-black text-[#062e39]">
                          ZMW {tier.pricePerSeat}
                        </p>
                        <p className="text-[10px] font-bold uppercase text-slate-400">per seat / month</p>
                      </>
                    ) : (
                      <p className="text-sm font-black uppercase text-[#fd5523]">
                        Custom Quote
                      </p>
                    )}
                  </div>
                </div>
              ))}

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <PlanEnrollModal 
                  planName="Team Starter (5 seats)"
                  priceLabel="ZMW 1,245/mo"
                  userName={user?.fullName || ""}
                  userEmail={user?.primaryEmailAddress?.emailAddress || ""}
                />
                <Button
                  variant="outline"
                  className="flex-1 rounded-full h-12 border-slate-200 text-[#062e39] font-bold hover:bg-slate-50"
                  render={<Link href="mailto:creativesites263@gmail.com" />}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Talk to Sales
                </Button>
              </div>
            </div>

            {/* Features */}
            <div className="rounded-[3rem] border-2 border-[#fd5523]/5 bg-[#fffbf8] p-12 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                 <Building2 className="h-32 w-32 text-[#fd5523]" />
              </div>
              <h3 className="mb-8 text-2xl font-bold text-[#062e39] tracking-tight">
                Everything your team needs to <span className="text-[#fd5523]">succeed.</span>
              </h3>
              <ul className="grid gap-6 sm:grid-cols-2 relative z-10">
                {TEAM_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm font-medium">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#fd5523]" />
                    <span className="text-slate-600">{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-10 rounded-[2rem] bg-white p-8 shadow-xl shadow-[#fd5523]/5 border border-[#fd5523]/10 relative z-10">
                <p className="font-bold text-[#062e39] flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-[#fd5523]" />
                  Need an invoice in ZMW?
                </p>
                <p className="text-sm text-slate-500 leading-relaxed">
                  After purchase we&apos;ll email a formal tax invoice for your finance
                  team, with support for MTN MoMo and Airtel Money receipts.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-4xl px-4 py-24 sm:px-6 lg:px-8 bg-white rounded-[4rem] shadow-2xl shadow-slate-200/50">
          <h2 className="mb-12 text-center text-4xl font-extrabold text-[#062e39] tracking-tight">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {FAQS.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-[2rem] border-2 border-slate-50 bg-slate-50/30 transition-all hover:bg-white hover:border-[#fd5523]/10"
              >
                <summary className="flex cursor-pointer select-none items-center justify-between px-8 py-6 text-base font-bold text-[#062e39] list-none">
                  {faq.q}
                  <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center shadow-sm text-slate-300 group-open:rotate-45 transition-transform">
                    <Zap className="h-4 w-4 group-open:text-[#fd5523]" />
                  </div>
                </summary>
                <div className="px-8 pb-8 text-base text-slate-500 leading-relaxed border-t border-slate-50 pt-4">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="px-4 py-24 text-center sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl rounded-[3rem] bg-[#062e39] px-8 py-24 text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
            <div className="mx-auto max-w-2xl relative z-10">
              <h2 className="text-4xl font-extrabold tracking-tight mb-4">Ready to upskill your team?</h2>
              <p className="text-xl text-white/60 mb-10 leading-relaxed">
                Join Zambian companies using Zed AI Academy to build practical AI
                capabilities.
              </p>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Button
                  size="lg"
                  className="w-full sm:w-auto px-10 py-8 rounded-full bg-[#fd5523] text-white hover:bg-[#ef4a16] font-bold text-lg shadow-2xl shadow-[#fd5523]/20"
                  render={<Link href="/sign-up" />}
                >
                  Get started free
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto px-10 py-8 rounded-full border-white/20 text-white hover:bg-white/10 hover:text-white font-bold text-lg"
                  render={<Link href="/courses" />}
                >
                  Browse courses
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
