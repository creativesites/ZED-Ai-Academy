"use client";

import Link from "next/link";
import { useAuth, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Menu as MenuIcon, LayoutDashboard } from "lucide-react";
import Menu from "../Menu";
import MobileMenu from "../MobileMenu";
import { LaunchAcademyCTA } from "@/components/layout/LaunchAcademyCTA";

function AuthControls({ notificationBell }) {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return <div className="h-9 w-24 rounded-xl bg-slate-100 animate-pulse" />;
  }

  if (isSignedIn) {
    return (
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <LaunchAcademyCTA className="hidden xl:inline-flex" />

        <Link
          href="/dashboard"
          className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#fd5523] text-white text-xs font-bold hover:bg-[#ef4a16] transition-colors whitespace-nowrap shadow-xs"
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          <span>Dashboard</span>
        </Link>

        {notificationBell}

        <div className="h-9 w-9 rounded-full ring-2 ring-slate-100 overflow-hidden flex items-center justify-center bg-slate-50 shrink-0">
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <SignInButton mode="redirect">
        <button
          type="button"
          className="h-9 px-3 sm:px-4 rounded-xl text-xs font-bold text-[#062e39] hover:bg-slate-100 transition-colors whitespace-nowrap"
        >
          Sign In
        </button>
      </SignInButton>
      <SignUpButton mode="redirect">
        <button
          type="button"
          className="h-9 px-3.5 sm:px-4 rounded-xl bg-[#fd5523] text-white text-xs font-bold hover:bg-[#ef4a16] transition-colors whitespace-nowrap shadow-xs"
        >
          Start Free
        </button>
      </SignUpButton>
    </div>
  );
}

export default function Header2({
  isMobileMenu = false,
  handleMobileMenu,
  notificationBell,
}) {
  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="container max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-6 min-w-0">
            <Link href="/" className="shrink-0 flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/zed-ai-logo.png"
                alt="Zed AI Academy"
                className="h-8 sm:h-9 w-auto object-contain"
              />
            </Link>

            <nav aria-label="Main navigation">
              <Menu />
            </nav>
          </div>

          {/* Right: Auth, Bell & Mobile Menu Trigger */}
          <div className="flex items-center gap-2 shrink-0">
            <AuthControls notificationBell={notificationBell} />

            <button
              type="button"
              onClick={handleMobileMenu}
              aria-label="Open navigation menu"
              className="lg:hidden h-9 w-9 rounded-xl border border-slate-200 bg-white text-[#062e39] hover:bg-slate-100 flex items-center justify-center transition-colors shrink-0"
            >
              <MenuIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <MobileMenu isOpen={isMobileMenu} handleMobileMenu={handleMobileMenu} />
    </>
  );
}
