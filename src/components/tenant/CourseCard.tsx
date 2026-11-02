import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { formatPrice } from "@/lib/course-experience";
import { cn } from "@/lib/utils";

interface CourseCardProps {
  course: any;
  variant?: "default" | "minimal" | "classic" | "corporate" | "creative" | "tech" | "elegant" | "dark";
  tenantSlug?: string;
}

export function CourseCard({ course, variant = "default", tenantSlug }: CourseCardProps) {
  const styles = {
    default: {
      card: "bg-white rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-2xl hover:-translate-y-2",
      badge: "bg-white/90 backdrop-blur text-[#062e39]",
      title: "text-[#062e39] group-hover:text-brand-ink",
      price: "text-[#062e39]",
      button: "bg-[#062e39] text-white hover:bg-brand hover:text-brand-on",
    },
    minimal: {
      card: "bg-white rounded-3xl shadow-none border border-slate-200/50 hover:shadow-md",
      badge: "bg-slate-100 text-slate-600",
      title: "text-slate-900",
      price: "text-slate-900",
      button: "bg-brand text-brand-on hover:bg-brand-hover",
    },
    classic: {
      card: "bg-[#fdfbf7] border border-amber-200/50 rounded-2xl shadow-lg",
      badge: "bg-amber-100 text-amber-900 font-serif",
      title: "text-amber-900 font-serif",
      price: "text-amber-900 font-serif",
      button: "bg-brand text-brand-on hover:bg-brand-hover",
    },
    corporate: {
      card: "bg-white rounded-md border border-slate-200 shadow-sm hover:shadow-lg",
      badge: "bg-brand-soft text-brand-deep",
      title: "text-slate-800",
      price: "text-slate-800",
      button: "bg-brand text-brand-on hover:bg-brand-hover",
    },
    creative: {
      card: "bg-white rounded-[3rem] border-2 border-brand/30 shadow-xl hover:shadow-brand/20 hover:-translate-y-3",
      badge: "bg-brand-soft text-brand-deep",
      title: "text-brand-deep",
      price: "text-brand-deep",
      button: "bg-brand text-brand-on hover:bg-brand-hover",
    },
    tech: {
      card: "bg-slate-900 border border-brand/20 rounded-lg shadow-[0_0_15px_color-mix(in_srgb,var(--brand)_10%,transparent)] hover:shadow-[0_0_30px_color-mix(in_srgb,var(--brand)_30%,transparent)]",
      badge: "bg-brand/20 text-brand-ink-dark backdrop-blur",
      title: "text-white",
      price: "text-white",
      button: "bg-brand text-brand-on hover:bg-brand-hover",
    },
    elegant: {
      card: "bg-white border border-stone-200 rounded-3xl shadow-md hover:shadow-2xl",
      badge: "bg-stone-100 text-stone-600 font-serif",
      title: "text-stone-800 font-serif",
      price: "text-stone-800 font-serif",
      button: "bg-brand text-brand-on hover:bg-brand-hover",
    },
    dark: {
      card: "bg-white/5 backdrop-blur border border-white/10 rounded-2xl shadow-2xl",
      badge: "bg-white/10 text-white/80",
      title: "text-white",
      price: "text-white",
      button: "bg-white text-black hover:bg-white/90",
    },
  };

  const s = styles[variant] || styles.default;

  return (
    <div className={cn("group p-4 transition-all duration-500 relative overflow-hidden flex flex-col h-full", s.card)}>
      <div className="relative h-64 rounded-[1.5rem] overflow-hidden mb-6 shrink-0">
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-brand-soft to-white flex items-center justify-center">
            <GraduationCap className="h-14 w-14 text-brand/40" />
          </div>
        )}
        <div className={cn("absolute top-4 left-4 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest", s.badge)}>
          {course.price_type === 'free' ? 'Free' : 'Premium'}
        </div>
      </div>
      <div className="px-4 pb-4 flex-1 flex flex-col">
        <h3 className={cn("text-2xl font-black mb-3 transition-colors", s.title)}>{course.title}</h3>
        <p className="text-slate-500 text-sm font-medium line-clamp-2 mb-8">{course.description}</p>
        <div className="mt-auto flex items-center justify-between pt-6 border-t border-slate-100">
          <span className={cn("font-black text-xl", s.price)}>
            {formatPrice(course.price_type, course.price_amount)}
          </span>
          <Link
            href={
              tenantSlug
                ? `/academy/${tenantSlug}/courses/${course.slug}`
                : course.company_slug
                ? `/academy/${course.company_slug}/courses/${course.slug}`
                : `/courses/${course.slug}`
            }
            className={cn("h-12 px-6 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg", s.button)}
          >
            Enrol Now
          </Link>
        </div>
      </div>
    </div>
  );
}