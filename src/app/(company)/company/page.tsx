import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Users, ShieldCheck, BarChart3 } from "lucide-react";

export const metadata = { title: "Company Dashboard" };

const features = [
  {
    title: "Seat Management",
    detail: "Allocate, transfer, and reclaim learner seats across your team.",
    icon: Users,
  },
  {
    title: "Compliance & Governance",
    detail: "Track mandatory training completion with auditable records.",
    icon: ShieldCheck,
  },
  {
    title: "Executive Analytics",
    detail: "Monitor team progress, completion rates, and learning outcomes.",
    icon: BarChart3,
  },
];

export default function CompanyPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50 p-8">
        <Badge className="border-blue-200 bg-blue-50 text-blue-700">Enterprise Workspace</Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Company Learning Command Center
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Your enterprise dashboard is being rolled out with advanced controls for team training, governance,
          and measurable outcomes.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button className="bg-blue-600 text-white hover:bg-blue-500">Request early access</Button>
          <Button variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-100">
            View rollout timeline
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {features.map((feature) => (
          <article key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <feature.icon className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">{feature.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{feature.detail}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 text-slate-800">
          <Building2 className="h-4 w-4" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">Current Status</h3>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Phase 1 is live for enterprise design previews. Team seats, assignments, and analytics launch in the
          next milestone.
        </p>
      </section>
    </div>
  );
}
