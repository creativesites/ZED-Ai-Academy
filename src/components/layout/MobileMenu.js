"use client";

import Link from "next/link";
import { useAuth, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { X as XClose, LayoutDashboard, Sparkles, ChevronRight } from "lucide-react";
import { LaunchAcademyCTA } from "@/components/layout/LaunchAcademyCTA";

const MOBILE_LINKS = [
  { label: "Home", href: "/" },
  { label: "Academies", href: "/#academies" },
  { label: "Pricing", href: "/pricing" },
  { label: "AI Tutor", href: "/ai-tutor" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export default function MobileMenu({
  isOpen = false,
  handleMobileMenu,
}) {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] lg:hidden flex">
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={handleMobileMenu}
      />
      <div className="relative z-10 w-[85vw] max-w-sm bg-white text-[#062e39] p-6 h-full flex flex-col justify-between overflow-y-auto shadow-2xl animate-in slide-in-from-left duration-200">
        <div>
          <div className="flex items-center justify-between pb-5 border-b border-slate-100 mb-6">
            <Link href="/" onClick={handleMobileMenu}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/zed-ai-logo.png" alt="Zed AI Academy" className="h-8 w-auto object-contain" />
            </Link>
            <button
              type="button"
              onClick={handleMobileMenu}
              aria-label="Close navigation menu"
              className="h-9 w-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#062e39] flex items-center justify-center transition-colors"
            >
              <XClose className="h-4 w-4" />
            </button>
          </div>

          <ul className="space-y-1.5">
            {MOBILE_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  onClick={handleMobileMenu}
                  className="flex items-center justify-between px-3.5 py-3 rounded-xl text-base font-bold text-[#062e39] hover:bg-[#fff6ee] hover:text-[#fd5523] transition-colors"
                >
                  <span>{link.label}</span>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {isLoaded && (
          <div className="pt-6 border-t border-slate-100 space-y-3 mt-6">
            {isSignedIn ? (
              <>
                <LaunchAcademyCTA variant="mobileMenu" />
                <Link
                  href="/dashboard"
                  onClick={handleMobileMenu}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#fd5523] text-white text-sm font-bold hover:bg-[#ef4a16] transition-colors"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Dashboard &amp; Academies</span>
                </Link>
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-xs font-bold text-slate-500">Account</span>
                  <UserButton afterSignOutUrl="/" />
                </div>
              </>
            ) : (
              <>
                <SignUpButton mode="redirect">
                  <button
                    type="button"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#fd5523] text-white font-bold text-sm hover:bg-[#ef4a16]"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Start Learning Free</span>
                  </button>
                </SignUpButton>
                <SignInButton mode="redirect">
                  <button
                    type="button"
                    className="w-full py-3 rounded-xl border border-slate-200 text-[#062e39] font-bold text-sm hover:bg-slate-50"
                  >
                    Sign In
                  </button>
                </SignInButton>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
