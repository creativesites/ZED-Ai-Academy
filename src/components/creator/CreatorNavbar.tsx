"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { UserButton } from "@clerk/nextjs";
import {
  BookOpen,
  PlusCircle,
  Video,
  ClipboardCheck,
  Settings,
  LayoutDashboard,
  Menu,
  X,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/shared/brand-logo";

const NAV_ITEMS = [
  { label: "Courses", href: "/creator/courses", icon: BookOpen },
  { label: "New Course", href: "/creator/courses/new", icon: PlusCircle },
  { label: "AI Teachers", href: "/creator/ai-teachers", icon: Sparkles },
  { label: "Live Sessions", href: "/creator/live-sessions", icon: Video },
  { label: "Submissions", href: "/creator/practice-submissions", icon: ClipboardCheck },
  { label: "Settings", href: "/creator/settings", icon: Settings },
];

export function CreatorNavbar({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/creator/courses") {
      return pathname === "/creator/courses" || (pathname.startsWith("/creator/courses/") && !pathname.startsWith("/creator/courses/new"));
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="container max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <Link href="/creator/courses" className="flex items-center gap-2.5 shrink-0 group">
            <BrandLogo variant="emblem" decorative className="h-9 w-auto transition-transform group-hover:scale-105" />
            <div className="flex flex-col leading-none">
              <span className="font-black text-sm text-ink tracking-tight">
                CS Learn
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-text">
                Creator Studio
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap",
                    active
                      ? "bg-brand-soft text-brand-text font-extrabold"
                      : "text-slate-600 hover:text-ink hover:bg-slate-100/70"
                  )}
                >
                  <item.icon className={cn("h-3.5 w-3.5", active ? "text-brand-text" : "text-slate-400")} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              href="/dashboard"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-ink hover:bg-slate-100 transition-colors whitespace-nowrap"
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-slate-500" />
              <span>Dashboard</span>
            </Link>

            {children}

            <div className="h-9 w-9 rounded-full ring-2 ring-slate-100 flex items-center justify-center bg-slate-50 overflow-hidden">
              <UserButton />
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
              className="md:hidden rounded-xl text-slate-600 hover:bg-slate-100"
              onClick={() => setMobileOpen((prev) => !prev)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Slide-Down Menu */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-xs md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="absolute top-16 left-0 right-0 bg-white border-b border-slate-200 p-4 space-y-1.5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold transition-colors",
                    active
                      ? "bg-brand-soft text-brand-text"
                      : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <Link
              href="/dashboard"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold text-ink bg-slate-50 border border-slate-200 mt-2"
            >
              <LayoutDashboard className="h-4 w-4 text-slate-500" />
              <span>Student Dashboard</span>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
