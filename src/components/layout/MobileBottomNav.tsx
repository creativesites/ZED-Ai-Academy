"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { BookOpen, Home, LayoutDashboard, Rocket, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfileNav } from "@/hooks/use-profile-nav";

function Tab({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors",
        active ? "text-[#fd5523]" : "text-ink hover:text-[#062e39]"
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0", active && "text-[#fd5523]")} />
      <span className="truncate px-0.5">{label}</span>
    </Link>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useAuth();
  const { loaded: navLoaded, needsAcademyLaunch } = useProfileNav();
  console.log('logging from mobile bottom tab- isLoaded: ' + isLoaded + '  navLoaded: ' + navLoaded)
  const hide =
    !pathname ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/academy/") ||
    pathname.startsWith("/creator/") ||
    pathname.startsWith("/company") ||
    pathname.startsWith("/live-sessions/") ||
    pathname.startsWith("/courses/");

  // if (!isLoaded || hide) return null;

  if (isSignedIn && !navLoaded) {
    return null;
  }

  const pathActive = (prefix: string) =>
    prefix === "/" ? pathname === "/" : pathname.startsWith(prefix);

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
      <>
        <nav
          className="fixed inset-x-0 bottom-0 z-5000 border-t border-slate-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(6,46,57,0.08)] backdrop-blur-lg md:hidden"
          aria-label="Mobile navigation"
        >
          <div className="mx-auto flex max-w-lg items-stretch justify-around">
            <Tab href="/" label="Home" icon={Home} active={pathActive("/")} />
            <Tab href="/courses" label="Courses" icon={BookOpen} active={pathActive("/courses")} />
            <Tab href="/sign-in" label="Sign in" icon={LogIn} active={pathActive("/sign-in")} />
          </div>
        </nav>
      </>
    );
  }

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(6,46,57,0.08)] backdrop-blur-lg md:hidden"
        aria-label="Mobile navigation"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around">
          <Tab href="/" label="Home" icon={Home} active={pathActive("/")} />
          <Tab href="/courses" label="Courses" icon={BookOpen} active={pathActive("/courses")} />
          <Tab
            href="/dashboard"
            label="Dashboard"
            icon={LayoutDashboard}
            active={pathActive("/dashboard")}
          />
          {needsAcademyLaunch ? (
            <Tab
              href="/launch-your-academy"
              label="Launch Pad"
              icon={Rocket}
              active={pathname.startsWith("/launch-your-academy")}
            />
          ) : null}
        </div>
      </nav>
    </>
  );
}
