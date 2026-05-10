"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CourseCard } from "@/components/tenant/CourseCard";

export function CourseCarousel({ courses, variant }: { courses: any[]; variant?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll, { passive: true });
      window.addEventListener("resize", checkScroll);
      return () => {
        el.removeEventListener("scroll", checkScroll);
        window.removeEventListener("resize", checkScroll);
      };
    }
  }, []);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  if (!courses?.length) return null;

  return (
    <div className="relative group">
      <div
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory scroll-smooth pb-4"
      >
        {courses.map((course) => (
          <div key={course.id} className="min-w-[320px] md:min-w-[380px] snap-start shrink-0">
            <CourseCard course={course} variant={variant as any} />
          </div>
        ))}
      </div>
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/90 backdrop-blur shadow-xl flex items-center justify-center text-slate-800 hover:scale-110 transition-all opacity-0 group-hover:opacity-100 z-10"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/90 backdrop-blur shadow-xl flex items-center justify-center text-slate-800 hover:scale-110 transition-all opacity-0 group-hover:opacity-100 z-10"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}