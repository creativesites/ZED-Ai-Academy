"use client";

import Link from "next/link";
import { BookOpen, ChevronRight, Star, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface CourseCardProps {
  title: string;
  slug: string;
  description?: string;
  category?: string;
  level?: "beginner" | "intermediate" | "advanced";
  thumbnail_url?: string;
  instructor_name?: string;
  enrollment_count?: number;
}

export function CourseCard({
  title,
  slug,
  description,
  category,
  level,
  thumbnail_url,
  instructor_name,
  enrollment_count,
}: CourseCardProps) {
  return (
    <div className="group my-4 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition-all hover:shadow-xl hover:translate-y-[-2px]">
      {thumbnail_url && (
        <div className="relative aspect-video w-full overflow-hidden">
          <img 
            src={thumbnail_url} 
            alt={title} 
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-4 left-4">
            <span className="rounded-full bg-white/20 backdrop-blur-md px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              {category || "AI Course"}
            </span>
          </div>
        </div>
      )}
      
      <div className="p-5">
        <div className="mb-2 flex items-center justify-between">
          <div className={cn(
            "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight",
            level === "beginner" ? "bg-emerald-50 text-emerald-600" :
            level === "intermediate" ? "bg-blue-50 text-blue-600" :
            "bg-purple-50 text-purple-600"
          )}>
            <div className={cn(
              "h-1.5 w-1.5 rounded-full",
              level === "beginner" ? "bg-emerald-500" :
              level === "intermediate" ? "bg-blue-500" :
              "bg-purple-500"
            )} />
            {level || "Beginner"}
          </div>
          {enrollment_count && (
            <div className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
              <Users className="h-3 w-3" />
              {enrollment_count} learners
            </div>
          )}
        </div>

        <h4 className="line-clamp-1 text-base font-bold text-slate-900 group-hover:text-[#fd5523] transition-colors">{title}</h4>
        {description && (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">
            {description}
          </p>
        )}

        <div className="mt-5 flex items-center justify-between border-t border-slate-50 pt-4">
          {instructor_name && (
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                {instructor_name.charAt(0)}
              </div>
              <span className="text-[10px] font-medium text-slate-600">{instructor_name}</span>
            </div>
          )}
          
          <Link 
            href={`/courses/${slug}`}
            className="flex items-center gap-1 text-xs font-bold text-[#fd5523] hover:underline"
          >
            Explore Course
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
