"use client";

import Link from "next/link";
import { TenantUserButton } from "./TenantUserButton";
import { TenantAcademySwitcher } from "./TenantAcademySwitcher";
import { NotificationBell } from "@/components/shared/notification-bell";
import { BookOpen, GraduationCap, Layout, Home, Mic, Search, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

export function TenantNavbar({ 
  tenant,
  staffRole,
}: { 
  tenant: { 
    name: string; 
    slug: string; 
    logo_url?: string | null; 
    primary_color?: string | null; 
  };
  staffRole?: string | null;
}) {
  const pathname = usePathname();
  const brandColor = tenant.primary_color || "#fd5523";
  const isStaff =
    staffRole === "super_admin" ||
    staffRole === "company_admin" ||
    staffRole === "admin" ||
    staffRole === "teacher" ||
    staffRole === "instructor";
  const isAdmin =
    staffRole === "super_admin" ||
    staffRole === "company_admin" ||
    staffRole === "admin";

  const navLinks = [
    { name: "Dashboard", href: `/academy/${tenant.slug}/dashboard`, icon: Layout },
    { name: "Classroom", href: `/academy/${tenant.slug}/classroom`, icon: GraduationCap },
    { name: "All Courses", href: `/academy/${tenant.slug}/courses`, icon: BookOpen },
    { name: "Practice", href: `/academy/${tenant.slug}/practice`, icon: Mic },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-xl border-b border-slate-100 shadow-sm">
      <div className="container max-w-7xl h-20 flex items-center justify-between px-4 sm:px-6 md:px-8">
        
        {/* Logo Section */}
        <div className="flex items-center gap-8">
          <Link 
            href={`/academy/${tenant.slug}`}
            className="flex items-center gap-3 group"
          >
            <div 
              className="h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110"
              style={{ backgroundColor: brandColor }}
            >
              <Home className="h-5 w-5" />
            </div>
            <span className="font-black text-xl tracking-tight text-[#062e39] hidden sm:block">
              {tenant.name}
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1 bg-slate-50 p-1 rounded-2xl border border-slate-100">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    isActive 
                      ? "bg-white shadow-sm text-[#062e39]" 
                      : "text-slate-400 hover:text-slate-600 hover:bg-white/50"
                  )}
                >
                  <link.icon className={cn("h-4 w-4", isActive ? "text-[#fd5523]" : "")} style={{ color: isActive ? brandColor : undefined }} />
                  {link.name}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {isStaff && (
            <Link
              href={`/academy/${tenant.slug}/admin`}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#062e39] hover:bg-[#0a4352] text-white text-xs font-bold shadow-xs transition-all shrink-0"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-[#fd5523]" />
              <span>{isAdmin ? "Admin Hub" : "Teacher Hub"}</span>
            </Link>
          )}
          
          <div className="h-8 w-px bg-slate-100 hidden sm:block" />

          <div className="flex items-center gap-2.5">
            <NotificationBell />
            <TenantAcademySwitcher currentSlug={tenant.slug} variant="navbar" />

            <div className="h-10 w-10 rounded-full ring-2 ring-slate-100 overflow-hidden flex items-center justify-center bg-slate-50 shadow-sm">
              <TenantUserButton tenantSlug={tenant.slug} />
            </div>
          </div>
        </div>

      </div>
    </nav>
  );
}
