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
  ChevronRight
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href: string;
  icon: any;
}

export function TenantAdminNavbar({ slug, name }: { slug: string; name: string }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const navItems: NavItem[] = [
    { label: "Dashboard", href: `/academy/${slug}/admin`, icon: LayoutDashboard },
    { label: "Classroom", href: `/academy/${slug}/admin/classroom`, icon: BookOpen },
    { label: "Live Sessions", href: `/academy/${slug}/admin/settings/live-sessions`, icon: Video },
    // { label: "Enrollments", href: `/academy/${slug}/admin/enrollments`, icon: GraduationCap },
    { label: "Timetable", href: `/academy/${slug}/admin/classroom?tab=timetable`, icon: Calendar },
    { label: "Branding", href: `/academy/${slug}/admin/settings/site`, icon: Settings },
  ];

  return (
    <>
      {/* Top Navbar */}
      <nav className="sticky top-0 z-[100] w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/academy/${slug}/admin`} className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-[#062e39] flex items-center justify-center text-white">
                <LayoutDashboard className="h-4 w-4" />
              </div>
              <span className="font-black text-slate-900 tracking-tight hidden md:block">{name} Admin</span>
            </Link>
            
            <div className="h-4 w-px bg-slate-200 mx-2 hidden md:block" />
            
            <Link 
              href={`/academy/${slug}`} 
              target="_blank"
              className="hidden md:flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#fd5523] transition-colors"
            >
              <Globe className="h-3 w-3" /> View Site
            </Link>
          </div>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.label === "Timetable" && pathname.includes("tab=timetable"));
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
                    isActive 
                      ? "bg-[#fff6ee] text-[#fd5523]" 
                      : "text-slate-500 hover:text-[#062e39] hover:bg-slate-50"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden rounded-xl"
              onClick={() => setIsOpen(!isOpen)}
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
            className="absolute top-16 left-0 right-0 bg-white border-b border-slate-200 p-6 space-y-2 animate-in slide-in-from-top duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "w-full p-4 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center justify-between transition-all",
                  pathname === item.href 
                    ? "bg-[#fff6ee] text-[#fd5523]" 
                    : "text-slate-500 hover:bg-slate-50"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </div>
                <ChevronRight className="h-4 w-4 opacity-50" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
