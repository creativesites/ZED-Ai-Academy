"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Building2, 
  Check, 
  ChevronsUpDown, 
  Compass, 
  ExternalLink, 
  GraduationCap, 
  PlusCircle, 
  ShieldCheck, 
  Sparkles, 
  UserCheck 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserAcademies, type UserAcademy } from "@/actions/tenants";

interface TenantAcademySwitcherProps {
  currentSlug?: string;
  variant?: "admin" | "navbar" | "home";
  isDark?: boolean;
}

export function TenantAcademySwitcher({
  currentSlug,
  variant = "navbar",
  isDark = false,
}: TenantAcademySwitcherProps) {
  const router = useRouter();
  const [academies, setAcademies] = useState<UserAcademy[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    getUserAcademies()
      .then((data) => {
        if (mounted) {
          setAcademies(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load user academies:", err);
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // If user is not authenticated or has no academies, render nothing
  if (loading || academies.length === 0) {
    return null;
  }

  const isMemberOfCurrent = !!currentSlug && academies.some((a) => a.slug === currentSlug);
  const currentAcademy = isMemberOfCurrent ? academies.find((a) => a.slug === currentSlug) : null;

  const hasMultiple = academies.length > 1;

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "super_admin":
        return {
          label: "Super Admin",
          className: "bg-purple-50 text-purple-700 border-purple-200/60 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40",
          icon: ShieldCheck,
        };
      case "company_admin":
        return {
          label: "Admin",
          className: "bg-orange-50 text-orange-700 border-orange-200/60 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/40",
          icon: ShieldCheck,
        };
      case "teacher":
      case "instructor":
        return {
          label: "Teacher",
          className: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40",
          icon: GraduationCap,
        };
      default:
        return {
          label: "Learner",
          className: "bg-sky-50 text-sky-700 border-sky-200/60 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/40",
          icon: UserCheck,
        };
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#fd5523]/30",
          isDark
            ? "bg-white/[0.06] border-white/10 text-slate-200 hover:bg-white/[0.1] hover:border-white/20"
            : variant === "admin"
            ? "bg-slate-50 border-slate-200/80 text-slate-700 hover:bg-slate-100/80 hover:border-slate-300 shadow-xs"
            : "bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-xs"
        )}
        title="Switch Academy"
        aria-expanded={isOpen}
      >
        {/* Academy Icon or Logo */}
        {currentAcademy ? (
          <div 
            className="h-5 w-5 rounded-md flex items-center justify-center overflow-hidden shrink-0 text-white font-bold text-[10px] shadow-2xs"
            style={{ backgroundColor: currentAcademy.primary_color || "#fd5523" }}
          >
            {currentAcademy.logo_url ? (
              <img 
                src={currentAcademy.logo_url} 
                alt={currentAcademy.name} 
                className="h-full w-full object-cover" 
              />
            ) : (
              <span>{currentAcademy.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
        ) : (
          <div className="h-5 w-5 rounded-md bg-[#062e39] text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Building2 className="h-3 w-3" />
          </div>
        )}

        {/* Academy Name */}
        <span className="max-w-[110px] sm:max-w-[140px] truncate font-bold text-[12px] tracking-tight">
          {currentAcademy ? currentAcademy.name : "My Academies"}
        </span>

        {/* Multi-academy count pill */}
        {academies.length > 0 && (
          <span className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-[#fd5523]/10 text-[#fd5523] border border-[#fd5523]/20">
            {academies.length}
          </span>
        )}

        <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-0.5" />
      </button>

      {/* Dropdown Menu Popup */}
      {isOpen && (
        <div 
          className={cn(
            "absolute right-0 mt-2 w-72 rounded-2xl p-2 shadow-2xl border z-[9999] animate-in fade-in-0 zoom-in-95 duration-100",
            isDark
              ? "bg-[#161b22] border-white/15 text-slate-200 divide-white/10"
              : "bg-white border-slate-200 text-slate-800 shadow-slate-900/10"
          )}
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-slate-100 dark:border-white/10 mb-1 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-400">
                Switch Academy
              </p>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                You belong to {academies.length} {academies.length === 1 ? "academy" : "academies"}
              </p>
            </div>
            <Sparkles className="h-3.5 w-3.5 text-[#fd5523]" />
          </div>

          {/* Academies List */}
          <div className="max-h-64 overflow-y-auto space-y-1 py-1">
            {academies.map((item) => {
              const isCurrent = item.slug === currentSlug;
              const badge = getRoleBadge(item.role);
              const RoleIcon = badge.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setIsOpen(false);
                    if (!isCurrent) {
                      router.push(item.targetUrl);
                    }
                  }}
                  className={cn(
                    "w-full text-left px-2.5 py-2 rounded-xl transition-all flex items-center justify-between gap-2.5 group",
                    isCurrent
                      ? isDark
                        ? "bg-white/[0.08] ring-1 ring-[#fd5523]/40"
                        : "bg-orange-50/70 border border-orange-200/70"
                      : isDark
                      ? "hover:bg-white/[0.05]"
                      : "hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div 
                      className="h-8 w-8 rounded-lg flex items-center justify-center overflow-hidden shrink-0 text-white font-bold text-xs shadow-xs"
                      style={{ backgroundColor: item.primary_color || "#062e39" }}
                    >
                      {item.logo_url ? (
                        <img 
                          src={item.logo_url} 
                          alt={item.name} 
                          className="h-full w-full object-cover" 
                        />
                      ) : (
                        <span>{item.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="font-bold text-xs truncate leading-tight text-slate-900 dark:text-white group-hover:text-[#fd5523] transition-colors">
                        {item.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border", badge.className)}>
                          <RoleIcon className="h-2.5 w-2.5" />
                          {badge.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isCurrent && (
                    <div className="h-5 w-5 rounded-full bg-[#fd5523] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="pt-2 mt-1 border-t border-slate-100 dark:border-white/10 space-y-1">
            <Link
              href="/dashboard"
              onClick={() => setIsOpen(false)}
              className={cn(
                "w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors",
                isDark
                  ? "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <span className="flex items-center gap-2">
                <Compass className="h-3.5 w-3.5 text-slate-400" />
                All Academies Hub
              </span>
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </Link>

            <Link
              href="/launch-your-academy"
              onClick={() => setIsOpen(false)}
              className={cn(
                "w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors",
                isDark
                  ? "text-[#fd5523] hover:bg-[#fd5523]/10"
                  : "text-[#fd5523] hover:bg-[#fd5523]/5"
              )}
            >
              <span className="flex items-center gap-2">
                <PlusCircle className="h-3.5 w-3.5" />
                Launch New Academy
              </span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
