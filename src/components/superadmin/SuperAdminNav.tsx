"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  ShieldAlert,
  Building2,
  Users,
  BookOpen,
  Settings,
  LayoutDashboard,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { name: "Overview", href: "/superadmin", icon: LayoutDashboard },
  { name: "Academies", href: "/superadmin/tenants", icon: Building2 },
  { name: "Users & Roles", href: "/superadmin/users", icon: Users },
  { name: "Courses", href: "/superadmin/courses", icon: BookOpen },
  { name: "Settings", href: "/superadmin/settings", icon: Settings },
];

export function SuperAdminNav({ adminName }: { adminName: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-[#090d16]/95 backdrop-blur-md text-slate-100">
      <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        {/* Brand & Badge */}
        <div className="flex items-center gap-6">
          <Link href="/superadmin" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[#fd5523] to-amber-500 flex items-center justify-center text-white shadow-md shadow-[#fd5523]/20">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white group-hover:text-amber-400 transition-colors">
                  Zed AI Control
                </span>
                <span className="text-[10px] uppercase tracking-widest font-black px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                  Super Admin
                </span>
              </div>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800/80">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/superadmin"
                  ? pathname === "/superadmin"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all",
                    isActive
                      ? "bg-slate-800 text-white shadow-sm border border-slate-700/50"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-4">
          <Link
            href="/academy/zedai"
            target="_blank"
            className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2.5 py-1 rounded-lg hover:bg-slate-800"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>Platform Academy</span>
            <ExternalLink className="h-3 w-3 opacity-60" />
          </Link>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-300 hidden sm:inline-block">
              {adminName}
            </span>
            <div className="ring-2 ring-slate-800 rounded-full">
              <UserButton />
            </div>
          </div>
        </div>

      </div>

      {/* Mobile nav bar */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-800/60 bg-slate-950/80 px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/superadmin"
              ? pathname === "/superadmin"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 p-1 text-[10px] font-medium transition-all",
                isActive ? "text-[#fd5523]" : "text-slate-400"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
