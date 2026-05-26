"use client";
import { useState, useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  BookOpen, Home, LayoutDashboard, Rocket,
  LogIn, Globe, GraduationCap, MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfileNav } from "@/hooks/use-profile-nav";

// ─── Types ────────────────────────────────────────────────────────────────────
type TabItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
};

// ─── Keyframes (injected once) ────────────────────────────────────────────────
const KEYFRAMES = `
  @keyframes _tab-pop {
    0%   { transform: scale(0.65) translateY(4px); opacity: 0; }
    55%  { transform: scale(1.18) translateY(-2px); opacity: 1; }
    100% { transform: scale(1)    translateY(0);    opacity: 1; }
  }
  @keyframes _tab-label {
    0%   { opacity: 0; transform: translateY(4px); }
    100% { opacity: 1; transform: translateY(0);   }
  }
  @keyframes _dot-pop {
    0%   { transform: translateX(-50%) scale(0); }
    60%  { transform: translateX(-50%) scale(1.4); }
    100% { transform: translateX(-50%) scale(1); }
  }
  ._tab-active-icon  { animation: _tab-pop   0.32s cubic-bezier(0.34,1.56,0.64,1) both; }
  ._tab-active-label { animation: _tab-label 0.22s ease 0.05s both; }
  ._dot-show         { animation: _dot-pop   0.32s cubic-bezier(0.34,1.56,0.64,1) both; }
`;

function StyleInjector() {
  useEffect(() => {
    if (document.getElementById("_mbn-kf")) return;
    const s = document.createElement("style");
    s.id = "_mbn-kf";
    s.textContent = KEYFRAMES;
    document.head.appendChild(s);
  }, []);
  return null;
}

// ─── MAX visible tabs before overflow ────────────────────────────────────────
const MAX_TABS = 3; // 4 real tabs + 1 "More" = 5 slots max

// ─── Single Tab button ────────────────────────────────────────────────────────
function Tab({
  href, label, icon: Icon, active, onClick,
}: TabItem & { onClick?: (e?: React.MouseEvent) => void }) {
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    if (active) {
      setBurst(true);
      const t = setTimeout(() => setBurst(false), 400);
      return () => clearTimeout(t);
    }
  }, [active]);

  const inner = (
    <>
      <div
        className={cn(
          "relative flex h-7 w-11 items-center justify-center rounded-[14px] transition-colors duration-200",
          active ? "bg-[#fd5523]/10" : "bg-transparent"
        )}
      >
        <Icon
          key={active ? "on" : "off"}
          className={cn(
            "h-5 w-5 shrink-0 transition-colors duration-200",
            active ? "text-[#fd5523]" : "text-slate-400",
            burst && "_tab-active-icon"
          )}
        />
        <span
          className={cn(
            "absolute -bottom-[7px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#fd5523] transition-transform duration-200",
            active ? "scale-100" : "scale-0",
            burst && active && "_dot-show"
          )}
        />
      </div>
      <span
        className={cn(
          "max-w-[52px] truncate text-[10px] font-bold tracking-wide transition-colors duration-200",
          active ? "text-[#fd5523]" : "text-slate-400",
          burst && "_tab-active-label"
        )}
      >
        {label}
      </span>
    </>
  );

  const cls = "flex min-w-0 flex-1 flex-col items-center gap-1 pt-2 select-none";
  const style = { WebkitTapHighlightColor: "transparent" } as React.CSSProperties;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls} style={style} aria-label={label}>
        {inner}
      </button>
    );
  }

  return (
    <Link href={href} className={cls} style={style}>
      {inner}
    </Link>
  );
}

// ─── More Drawer ──────────────────────────────────────────────────────────────
function MoreDrawer({
  items, open, onClose,
}: {
  items: TabItem[];
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = () => onClose();
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-[4998] bg-black/25 transition-opacity duration-200 md:hidden",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={ref}
        className={cn(
          "fixed inset-x-0 bottom-[68px] z-[4999] md:hidden",
          "bg-white rounded-t-[20px]",
          "border-t border-slate-200/80",
          "shadow-[0_-4px_32px_-4px_rgba(6,46,57,0.12)]",
          "pb-[env(safe-area-inset-bottom)]",
          "transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
          open ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Handle */}
        <div className="flex justify-center pt-2.5 pb-3">
          <div className="h-1 w-9 rounded-full bg-slate-200" />
        </div>

        <p className="px-4 pb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
          More
        </p>

        <ul role="list" className="flex flex-col pb-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 transition-colors active:bg-slate-50",
                    item.active ? "text-[#fd5523]" : "text-slate-700"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition-colors",
                      item.active ? "bg-[#fd5523]/10" : "bg-slate-100"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px]",
                        item.active ? "text-[#fd5523]" : "text-slate-500"
                      )}
                    />
                  </span>
                  <span className="text-[14px] font-semibold leading-none">
                    {item.label}
                  </span>
                  {item.active && (
                    <span className="ml-auto h-2 w-2 rounded-full bg-[#fd5523]" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────
function NavShell({ tabs, label }: { tabs: TabItem[]; label: string }) {
  const [moreOpen, setMoreOpen] = useState(false);

  const visibleTabs = tabs.slice(0, MAX_TABS);
  const overflowTabs = tabs.slice(MAX_TABS);
  const hasOverflow = overflowTabs.length > 0;
  const overflowActive = overflowTabs.some((t) => t.active);
  const activeOverflow = overflowTabs.find((t) => t.active);

  // Close drawer on route change
  const pathname = usePathname();
  useEffect(() => { setMoreOpen(false); }, [pathname]);

  return (
    <>
      <StyleInjector />

      {hasOverflow && (
        <MoreDrawer
          items={overflowTabs}
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
        />
      )}

      <nav
        aria-label={label}
        className={cn(
          "fixed inset-x-0 bottom-0 z-[5000] md:hidden",
          "bg-white border-t border-slate-200/80",
          "shadow-[0_-1px_0_0_rgba(0,0,0,0.04),0_-8px_24px_-4px_rgba(6,46,57,0.07)]",
          "pb-[env(safe-area-inset-bottom)]"
        )}
      >
        {/* overflow-hidden + w-full ensures it never exceeds the viewport */}
        <div className="flex w-full overflow-hidden items-stretch justify-around px-1">
          {visibleTabs.map((tab) => (
            <Tab key={tab.href} {...tab} />
          ))}

          {hasOverflow && (
            <Tab
              href="#"
              label={activeOverflow ? activeOverflow.label : "More"}
              icon={MoreHorizontal}
              active={overflowActive}
              onClick={(e) => {
                e?.preventDefault?.();
                setMoreOpen((v) => !v);
              }}
            />
          )}
        </div>
      </nav>
    </>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function MobileBottomNav() {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();
  const { loaded: navLoaded, needsAcademyLaunch, tenantSlug, role } = useProfileNav();

  if (isSignedIn && !navLoaded) return null;

  const pathActive = (prefix: string) =>
    prefix === "/" ? pathname === "/" : pathname?.startsWith(prefix) ?? false;

  const isAcademyPath = pathname?.startsWith("/academy/");
  const academySlug = isAcademyPath ? pathname.split("/")[2] : null;
  const isAdmin = role === "admin" || role === "super_admin" || role === "company_admin";
  const isThisAcademyAdmin = isAdmin && tenantSlug === academySlug;

  const hide =
    !pathname ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/creator/") ||
    pathname.startsWith("/company") ||
    pathname.startsWith("/live-sessions/") ||
    pathname.startsWith("/courses/");

  if (hide) return null;

  // ── Guest ──────────────────────────────────────────────────────────────────
  if (!isSignedIn) {
    const showGuest =
      pathname === "/" ||
      pathname.startsWith("/about") ||
      pathname.startsWith("/courses") ||
      pathname.startsWith("/pricing") ||
      pathname.startsWith("/contact") ||
      pathname.startsWith("/faq");

    if (!showGuest) return null;

    return (
      <NavShell
        label="Mobile navigation"
        tabs={[
          { href: "/",        label: "Home",    icon: Home,    active: pathActive("/") },
          { href: "/courses", label: "Courses", icon: BookOpen, active: pathActive("/courses") },
          { href: "/sign-in", label: "Sign in", icon: LogIn,   active: pathActive("/sign-in") },
        ]}
      />
    );
  }

  // ── Academy context ────────────────────────────────────────────────────────
  if (isAcademyPath && academySlug) {
    const tabs: TabItem[] = [
      {
        href: `/academy/${academySlug}`,
        label: "Home",
        icon: Home,
        active: pathname === `/academy/${academySlug}`,
      },
      {
        href: `/academy/${academySlug}/courses`,
        label: "Courses",
        icon: BookOpen,
        active: pathname.startsWith(`/academy/${academySlug}/courses`),
      },
      {
        href: `/academy/${academySlug}/classroom`,
        label: "Class",
        icon: GraduationCap,
        active: pathname.startsWith(`/academy/${academySlug}/classroom`),
      },
      {
        href: `/academy/${academySlug}/dashboard`,
        label: "Dash",
        icon: LayoutDashboard,
        active: pathname.startsWith(`/academy/${academySlug}/dashboard`),
      },
    ];

    if (isThisAcademyAdmin) {
      tabs.push({
        href: `/academy/${academySlug}/admin`,
        label: "Admin",
        icon: Rocket,
        active: pathname.startsWith(`/academy/${academySlug}/admin`),
      });
    }

    return <NavShell label="Academy navigation" tabs={tabs} />;
  }

  // ── Authenticated global nav ───────────────────────────────────────────────
  const tabs: TabItem[] = [
    { href: "/",          label: "Home",      icon: Home,            active: pathActive("/") },
    { href: "/courses",   label: "Courses",   icon: BookOpen,        active: pathActive("/courses") },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, active: pathActive("/dashboard") },
  ];

  if (needsAcademyLaunch) {
    tabs.push({
      href: "/launch-your-academy",
      label: "Launch",
      icon: Rocket,
      active: pathname.startsWith("/launch-your-academy"),
    });
  }

  if (tenantSlug) {
    tabs.push({
      href: `/academy/${tenantSlug}`,
      label: "Visit",
      icon: Globe,
      active: pathname.startsWith(`/academy/${tenantSlug}`),
    });
  }

  return <NavShell label="Mobile navigation" tabs={tabs} />;
}