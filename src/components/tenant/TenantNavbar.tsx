"use client";

import Link from "next/link";
import { UserButton, OrganizationSwitcher } from "@clerk/nextjs";
import { BookOpen, GraduationCap, Layout, Home, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

export function TenantNavbar({ 
  tenant 
}: { 
  tenant: { 
    name: string; 
    slug: string; 
    logo_url?: string | null; 
    primary_color?: string | null; 
  } 
}) {
  const pathname = usePathname();
  const brandColor = tenant.primary_color || "#fd5523";

  const navLinks = [
    { name: "Dashboard", href: `/academy/${tenant.slug}/dashboard`, icon: Layout },
    { name: "Classroom", href: `/academy/${tenant.slug}/classroom`, icon: GraduationCap },
    { name: "All Courses", href: `/academy/${tenant.slug}/courses`, icon: BookOpen },
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
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-100 px-4 py-2 rounded-full text-slate-400">
            <Search className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Search...</span>
          </div>
          
          <div className="h-10 w-px bg-slate-100 hidden sm:block" />

          <div className="flex items-center gap-4">
            <OrganizationSwitcher 
              hidePersonal={false}
              appearance={{
                  elements: {
                      organizationSwitcherTrigger: "focus:outline-none focus:ring-0 shadow-none border-none bg-slate-50 hover:bg-slate-100 rounded-xl px-3 py-2 transition-all",
                  }
              }}
            />
            <div className="h-10 w-10 rounded-full ring-2 ring-slate-100 overflow-hidden flex items-center justify-center bg-slate-50">
              <UserButton />
            </div>
          </div>
        </div>

      </div>
    </nav>
  );
}
