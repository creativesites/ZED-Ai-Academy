"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Video,
  Settings,
  BookOpen,
  Menu,
  X,
  Globe,
  ChevronRight,
  Layers,
  UserCheck,
  MoreHorizontal,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TenantUserButton } from "@/components/tenant/TenantUserButton";
import { TenantAcademySwitcher } from "@/components/tenant/TenantAcademySwitcher";
import { NotificationBell } from "@/components/shared/notification-bell";

interface NavItem {
  label: string;
  shortLabel?: string;
  href: string;
  icon: any;
  exact?: boolean;
}

export function TenantAdminNavbar({ slug, name }: { slug: string; name: string }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const base = `/academy/${slug}/admin`;

  const navItems: NavItem[] = [
    { label: "Dashboard", shortLabel: "Hub", href: base, icon: LayoutDashboard, exact: true },
    { label: "Courses", href: `${base}/courses`, icon: BookOpen },
    { label: "AI Teachers", shortLabel: "AI Tutor", href: `${base}/ai-teachers`, icon: Sparkles },
    { label: "Enrollments", shortLabel: "Students", href: `${base}/enrollments`, icon: UserCheck },
    { label: "Classroom", href: `${base}/classroom`, icon: Layers },
    { label: "Staff", href: `${base}/staff`, icon: Users },
    { label: "Live Sessions", href: `${base}/live-sessions`, icon: Video },
    { label: "Settings", href: `${base}/settings/site`, icon: Settings },
  ];

  const isItemActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    if (item.label === "Settings") {
      return pathname.startsWith(`${base}/settings`);
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  const mobileBottomItems = navItems.slice(0, 4);

  return (
    <>
      {/* Top Navbar */}
      <nav className="sticky top-0 z-[100] w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="container max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          {/* Left Brand */}
          <div className="flex items-center gap-2.5 shrink-0 min-w-0">
            <Link href={base} className="flex items-center gap-2 group min-w-0">
              <div className="h-8 w-8 rounded-xl bg-[#062e39] group-hover:bg-[#fd5523] flex items-center justify-center text-white transition-colors shadow-sm shrink-0">
                <LayoutDashboard className="h-4 w-4" />
              </div>
              <div className="flex flex-col leading-none min-w-0">
                <span className="font-black text-sm text-[#062e39] tracking-tight truncate">
                  Admin Hub
                </span>
                <span className="text-[10px] font-bold text-slate-400 truncate max-w-[110px] sm:hidden">
                  {name}
                </span>
              </div>
            </Link>

            <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

            <Link
              href={`/academy/${slug}`}
              target="_blank"
              className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-[#fd5523] hover:bg-slate-100 transition-all px-2.5 py-1 rounded-lg border border-slate-200/60"
              title="View Public Academy"
            >
              <Globe className="h-3 w-3" />
              <span>Public Site</span>
            </Link>

            <Link
              href={`/academy/${slug}/dashboard`}
              className="hidden xl:inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-[#062e39] hover:bg-slate-100 transition-all px-2.5 py-1 rounded-lg border border-slate-200/60"
              title="Preview Student Dashboard"
            >
              <UserCheck className="h-3 w-3 text-[#fd5523]" />
              <span>Student View</span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = isItemActive(item);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap",
                    isActive
                      ? "bg-[#fff6ee] text-[#fd5523] shadow-sm font-extrabold"
                      : "text-slate-500 hover:text-[#062e39] hover:bg-slate-50"
                  )}
                >
                  <item.icon className={cn("h-3.5 w-3.5", isActive ? "text-[#fd5523]" : "text-slate-400")} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />
            <TenantAcademySwitcher currentSlug={slug} variant="admin" />

            <div className="h-9 w-9 rounded-full ring-2 ring-slate-100 flex items-center justify-center bg-slate-50 overflow-hidden shadow-sm">
              <TenantUserButton tenantSlug={slug} />
            </div>

            <Button
              variant="ghost"
              size="icon"
              aria-label={isOpen ? "Close menu" : "Open menu"}
              className="lg:hidden rounded-xl text-slate-600 hover:bg-slate-100"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </nav>

      {/* Mobile / Tablet Slide-Down Drawer */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[95] bg-black/25 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="absolute top-16 left-0 right-0 bg-white border-b border-slate-200 p-4 sm:p-6 space-y-2 shadow-xl max-h-[calc(100vh-5rem)] overflow-y-auto animate-in slide-in-from-top duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 mb-2 rounded-xl bg-slate-50 border border-slate-100">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Academy Admin
                </p>
                <p className="text-xs font-black text-[#062e39] truncate">{name}</p>
              </div>
              <Link
                href={`/academy/${slug}`}
                target="_blank"
                onClick={() => setIsOpen(false)}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#fd5523] bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm shrink-0"
              >
                <Globe className="h-3.5 w-3.5" />
                Public Site
              </Link>
            </div>

            {navItems.map((item) => {
              const isActive = isItemActive(item);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "w-full p-3.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all",
                    isActive
                      ? "bg-[#fff6ee] text-[#fd5523] font-extrabold"
                      : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </div>
                  <ChevronRight className="h-4 w-4 opacity-40" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile Bottom Quick-Nav Bar */}
      <nav
        aria-label="Mobile admin quick navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-[90] bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-2 py-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.04)]"
      >
        <div className="grid grid-cols-5 gap-1">
          {mobileBottomItems.map((item) => {
            const isActive = isItemActive(item);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-xl text-[10px] font-bold transition-colors min-h-[44px]",
                  isActive
                    ? "text-[#fd5523] bg-[#fff6ee]"
                    : "text-slate-500 hover:text-[#062e39]"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate max-w-full">{item.shortLabel || item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-xl text-[10px] font-bold transition-colors min-h-[44px]",
              isOpen ? "text-[#fd5523] bg-[#fff6ee]" : "text-slate-500 hover:text-[#062e39]"
            )}
          >
            <MoreHorizontal className="h-4 w-4 shrink-0" />
            <span>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
