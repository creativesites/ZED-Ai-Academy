import Link from "next/link";
import { formatPrice } from "@/lib/course-experience";
import { cn } from "@/lib/utils";

interface CourseCardProps {
  course: any;
  variant?: "default" | "minimal" | "classic" | "corporate" | "creative" | "tech" | "elegant" | "dark";
}

export function CourseCard({ course, variant = "default" }: CourseCardProps) {
  const styles = {
    default: {
      card: "bg-white rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-2xl hover:-translate-y-2",
      badge: "bg-white/90 backdrop-blur text-[#062e39]",
      title: "text-[#062e39] group-hover:text-[var(--primary-color)]",
      price: "text-[#062e39]",
      button: "bg-[#062e39] hover:bg-[var(--primary-color)]",
    },
    minimal: {
      card: "bg-white rounded-3xl shadow-none border border-slate-200/50 hover:shadow-md",
      badge: "bg-slate-100 text-slate-600",
      title: "text-slate-900",
      price: "text-slate-900",
      button: "bg-slate-900 hover:bg-slate-700",
    },
    classic: {
      card: "bg-[#fdfbf7] border border-amber-200/50 rounded-2xl shadow-lg",
      badge: "bg-amber-100 text-amber-900 font-serif",
      title: "text-amber-900 font-serif",
      price: "text-amber-900 font-serif",
      button: "bg-amber-800 hover:bg-amber-700",
    },
    corporate: {
      card: "bg-white rounded-md border border-slate-200 shadow-sm hover:shadow-lg",
      badge: "bg-blue-100 text-blue-800",
      title: "text-slate-800",
      price: "text-slate-800",
      button: "bg-blue-600 hover:bg-blue-700",
    },
    creative: {
      card: "bg-white rounded-[3rem] border-2 border-fuchsia-200 shadow-xl hover:shadow-fuchsia-200/30 hover:-translate-y-3",
      badge: "bg-fuchsia-100 text-fuchsia-700",
      title: "text-fuchsia-900",
      price: "text-fuchsia-900",
      button: "bg-fuchsia-600 hover:bg-fuchsia-700",
    },
    tech: {
      card: "bg-slate-900 border border-cyan-500/20 rounded-lg shadow-[0_0_15px_rgba(0,255,255,0.1)] hover:shadow-[0_0_30px_rgba(0,255,255,0.3)]",
      badge: "bg-cyan-500/20 text-cyan-300 backdrop-blur",
      title: "text-white",
      price: "text-white",
      button: "bg-cyan-500 hover:bg-cyan-400 text-black",
    },
    elegant: {
      card: "bg-white border border-stone-200 rounded-3xl shadow-md hover:shadow-2xl",
      badge: "bg-stone-100 text-stone-600 font-serif",
      title: "text-stone-800 font-serif",
      price: "text-stone-800 font-serif",
      button: "bg-stone-800 hover:bg-stone-900 text-white",
    },
    dark: {
      card: "bg-white/5 backdrop-blur border border-white/10 rounded-2xl shadow-2xl",
      badge: "bg-white/10 text-white/80",
      title: "text-white",
      price: "text-white",
      button: "bg-white hover:bg-white/90 text-black",
    },
  };

  const s = styles[variant] || styles.default;

  return (
    <div className={cn("group p-4 transition-all duration-500 relative overflow-hidden flex flex-col h-full", s.card)}>
      <div className="relative h-64 rounded-[1.5rem] overflow-hidden mb-6 shrink-0">
        <img
          src={course.thumbnail_url || ""}
          alt=""
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
        />
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
            href={`/courses/${course.slug}`}
            className={cn("h-12 px-6 rounded-2xl text-white text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg", s.button)}
          >
            Enrol Now
          </Link>
        </div>
      </div>
    </div>
  );
}