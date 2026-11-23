import Link from "next/link";
import { ArrowRight, BookOpen, Clock, Compass, RotateCcw, Sparkles } from "lucide-react";
import type { DailyPlanItem } from "@/lib/tutor/mastery/sprint";

const ITEM_META: Record<
  DailyPlanItem["kind"],
  { badge: string; Icon: typeof RotateCcw; iconBg: string }
> = {
  revision_sprint: {
    badge: "Revision sprint",
    Icon: RotateCcw,
    iconBg: "bg-amber-500/15 text-amber-700",
  },
  unfinished_lesson: {
    badge: "Next lesson",
    Icon: BookOpen,
    iconBg: "bg-[#fd5523]/15 text-[#fd5523]",
  },
  untried_flow: {
    badge: "Practice flow",
    Icon: Compass,
    iconBg: "bg-emerald-500/15 text-emerald-700",
  },
};

export function DailyPlanCard({
  teacherName,
  items,
}: {
  teacherName: string;
  items: DailyPlanItem[];
}) {
  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="daily-plan-heading"
      className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#fd5523]/10 text-[#fd5523]">
            <Sparkles className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
          <div>
            <h2
              id="daily-plan-heading"
              className="font-heading text-base font-bold text-[#062e39] sm:text-lg"
            >
              Today with {teacherName}
            </h2>
            <p className="text-xs text-slate-500">
              A short plan built from your progress and weak spots.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
          {items.length} {items.length === 1 ? "step" : "steps"}
        </span>
      </div>

      <ul className="grid gap-3 md:grid-cols-3">
        {items.map((item) => {
          const meta = ITEM_META[item.kind];
          const Icon = meta.Icon;
          return (
            <li
              key={item.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition hover:border-[#fd5523]/30 hover:bg-white"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.iconBg}`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {meta.badge}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {item.durationMinutes} min
                  </span>
                </div>
                <h3 className="line-clamp-2 text-sm font-bold text-[#062e39]">
                  {item.title}
                </h3>
                <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">
                  {item.subtitle}
                </p>
              </div>

              <div className="mt-4 pt-2">
                <Link
                  href={item.href}
                  className="inline-flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-[#062e39] transition hover:border-[#fd5523] hover:bg-[#fd5523] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fd5523]"
                >
                  <span>{item.ctaLabel}</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
