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
  GraduationCap,
  Calendar,
  Menu,
  X,
  Globe,
  ChevronRight,
  Layers
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { TenantUserButton } from "@/components/tenant/TenantUserButton";
import { TenantAcademySwitcher } from "@/components/tenant/TenantAcademySwitcher";

interface NavItem {
  label: string;
  href: string;
  icon: any;
}

export function TenantAdminNavbar({ slug, name }: { slug: string; name: string }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const isItemActive = (item: NavItem) =>
    pathname === item.href ||
    (item.label === "Settings" && pathname.includes("/settings") && !pathname.includes("/settings/live-sessions")) ||
    (item.label === "Live Sessions" && pathname.includes("/live-sessions"));

  // Close the drawer when the route changes or Escape is pressed; lock page scroll while open.
  useEffect(() => { setIsOpen(false); }, [pathname]);
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [isOpen]);

  const navItems: NavItem[] = [
    { label: "Dashboard", href: `/academy/${slug}/admin`, icon: LayoutDashboard },
    { label: "Courses", href: `/academy/${slug}/admin/courses`, icon: BookOpen },
    { label: "Classroom", href: `/academy/${slug}/admin/classroom`, icon: Layers },
    { label: "Staff", href: `/academy/${slug}/admin/staff`, icon: Users },
    { label: "Live Sessions", href: `/academy/${slug}/admin/settings/live-sessions`, icon: Video },
    { label: "Settings", href: `/academy/${slug}/admin/settings/site`, icon: Settings },
  ];

  return (
    <>
      {/* Top Navbar */}
      <nav className="sticky top-0 z-[100] w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="container max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          
          {/* Left Brand: Clean & Compact (no giant academy name crowding the menu) */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Link href={`/academy/${slug}/admin`} className="flex items-center gap-2 group">
              <div className="h-8 w-8 rounded-xl bg-[#062e39] group-hover:bg-brand group-hover:text-brand-on flex items-center justify-center text-white transition-colors shadow-sm shrink-0 hover:text-brand-on">
                <LayoutDashboard className="h-4 w-4" />
              </div>
              <span className="font-black text-sm text-[#062e39] tracking-tight">Admin Hub</span>
            </Link>

            <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

            <Link 
              href={`/academy/${slug}`} 
              target="_blank"
              className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-brand-ink hover:bg-slate-100 transition-all px-2.5 py-1 rounded-lg border border-slate-200/60"
              title="View Public Academy"
            >
              <Globe className="h-3 w-3" />
              <span>Public Site</span>
            </Link>
          </div>

          {/* Desktop Nav: Spacious, Unsqueezed, and Elegantly Aligned */}
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
                      ? "bg-brand-soft text-brand-ink shadow-sm font-extrabold" 
                      : "text-slate-500 hover:text-[#062e39] hover:bg-slate-50"
                  )}
                >
                  <item.icon className={cn("h-3.5 w-3.5", isActive ? "text-brand-ink" : "text-slate-400")} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2.5 shrink-0">
            <TenantAcademySwitcher currentSlug={slug} variant="admin" />

            <div className="h-9 w-9 rounded-full ring-2 ring-slate-100 flex items-center justify-center bg-slate-50 overflow-hidden shadow-sm">
              <TenantUserButton tenantSlug={slug} />
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden rounded-xl text-slate-600 hover:bg-slate-100"
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? "Close menu" : "Open menu"}
              aria-expanded={isOpen}
              aria-controls="admin-mobile-menu"
            >
              {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>

        </div>
      </nav>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-[90] bg-black/20 backdrop-blur-sm lg:hidden" onClick={() => setIsOpen(false)}>
          <div 
            id="admin-mobile-menu"
            className="absolute top-16 left-0 right-0 max-h-[calc(100dvh-4rem)] overflow-y-auto bg-white border-b border-slate-200 p-4 sm:p-6 space-y-1.5 animate-in slide-in-from-top duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "w-full p-3.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all",
                  isItemActive(item)
                    ? "bg-brand-soft text-brand-ink font-extrabold" 
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </div>
                <ChevronRight className="h-4 w-4 opacity-40" />
              </Link>
            ))}
            <Link
              href={`/academy/${slug}`}
              target="_blank"
              onClick={() => setIsOpen(false)}
              className="w-full p-3.5 rounded-xl text-xs font-bold flex items-center gap-3 text-slate-600 hover:bg-slate-50 border-t border-slate-100 mt-2 pt-4"
            >
              <Globe className="h-4 w-4" />
              View public academy
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
