"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
    GraduationCap,
    LayoutDashboard,
    ArrowUpRight,
    Menu,
    X,
    Settings,
    BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function TenantHomeNavBar({
    tenant,
    template,
    userId,
    role,
}: {
    tenant: any;
    template: string;
    userId: string;
    role: string;
}) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) setIsMobileMenuOpen(false);
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Lock body scroll when mobile menu is open
    useEffect(() => {
        document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [isMobileMenuOpen]);

    const isDark = template === "dark_mode";
    const isAdmin =
        role === "admin" || role === "super_admin" || role === "company_admin";

    // Build absolute sign-in / sign-up URLs to point to the root domain so that authentication cookies are always set centrally
    const rootDomain = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000") : "localhost:3000";
    const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
    const signInUrl = `${protocol}//${rootDomain}/sign-in?redirect_url=/academy/${tenant.slug}/classroom`;
    const signUpUrl = `${protocol}//${rootDomain}/sign-up?role=student&tenant=${tenant.slug}`;

    return (
        <>
            <nav
                className={cn(
                    "fixed top-0 left-0 w-full z-[100]",
                    isDark
                        ? "bg-[#0d1117] border-b border-white/[0.06] shadow-[0_1px_0_0_rgba(255,255,255,0.04),0_4px_24px_-4px_rgba(0,0,0,0.5)]"
                        : "bg-white border-b border-[#e8eaed] shadow-[0_1px_0_0_rgba(0,0,0,0.04),0_4px_16px_-4px_rgba(0,0,0,0.06)]"
                )}
            >
                <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between gap-4">

                    {/* === BRAND === */}
                    <Link
                        href={`/academy/${tenant.slug}`}
                        className="flex items-center gap-2.5 flex-shrink-0 group"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <div
                            className={cn(
                                " h-12 min-w-[28px] flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105",
                                isDark
                                    ? "text-sky-300 border border-sky-300/15"
                                    : " text-white"
                            )}
                        >
                            {tenant.logo_url ? (
                                <img
                                    src={tenant.logo_url}
                                    className="h-5 w-auto object-contain"
                                    alt={tenant.name}
                                />
                            ) : (
                                <GraduationCap className="h-[18px] w-[18px]" />
                            )}
                        </div>
                        <span
                            className={cn(
                                "text-[15px] font-extrabold tracking-tight leading-none",
                                isDark ? "text-[#f0f6fc]" : "text-[#062e39]"
                            )}
                        >
                            {tenant.name}
                        </span>
                    </Link>

                    {/* === DESKTOP LINKS === */}
                    <div className="hidden md:flex items-center gap-1">
                        {userId ? (
                            <>
                                {tenant.slug && (
                                    <Link
                                        href={`/academy/${tenant.slug}/classroom`}
                                        className={cn(
                                            "px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-colors duration-150",
                                            isDark
                                                ? "text-slate-400 hover:text-slate-100 hover:bg-white/[0.06]"
                                                : "text-slate-500 hover:text-[#062e39] hover:bg-slate-100"
                                        )}
                                    >
                                        Classroom
                                    </Link>
                                )}

                                {/* Divider */}
                                <div
                                    className={cn(
                                        "w-px h-5 mx-1 flex-shrink-0",
                                        isDark ? "bg-white/10" : "bg-slate-200"
                                    )}
                                />

                                {isAdmin && (
                                    <Link
                                        href={`/academy/${tenant.slug}/admin`}
                                        className={cn(
                                            "h-8 px-3.5 rounded-lg text-[12px] font-bold flex items-center gap-1.5 transition-all duration-150 border",
                                            isDark
                                                ? "border-white/[0.12] text-slate-300 hover:bg-white/[0.05] hover:border-white/25"
                                                : "border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400"
                                        )}
                                    >
                                        <Settings className="h-3.5 w-3.5" />
                                        Admin
                                    </Link>
                                )}

                                <Link
                                    href={`/academy/${tenant.slug}/dashboard`}
                                    className="h-8 px-4 rounded-lg bg-[#fd5523] hover:bg-[#e84b1c] text-white text-[12px] font-bold flex items-center gap-1.5 transition-all duration-150 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(253,85,35,0.35)]"
                                >
                                    <LayoutDashboard className="h-3.5 w-3.5" />
                                    Dashboard
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link
                                    href={signInUrl}
                                    className={cn(
                                        "px-4 py-1.5 rounded-lg text-[12px] font-bold transition-colors duration-150",
                                        isDark
                                            ? "text-slate-400 hover:text-slate-100 hover:bg-white/[0.06]"
                                            : "text-slate-600 hover:text-[#062e39] hover:bg-slate-100"
                                    )}
                                >
                                    Login
                                </Link>
                                <Link
                                    href={signUpUrl}
                                    className="h-8 px-4 rounded-lg bg-[#fd5523] hover:bg-[#e84b1c] text-white text-[12px] font-bold flex items-center gap-1.5 transition-all duration-150 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(253,85,35,0.35)]"
                                >
                                    Get Started
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                </Link>
                            </>
                        )}
                    </div>

                    {/* === MOBILE TOGGLE === */}
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className={cn(
                            "md:hidden w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors z-[101]",
                            isDark
                                ? "bg-white/[0.07] text-slate-300 hover:bg-white/[0.12]"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        )}
                        aria-label="Toggle Menu"
                        aria-expanded={isMobileMenuOpen}
                    >
                        {isMobileMenuOpen ? (
                            <X className="h-4.5 w-4.5" />
                        ) : (
                            <Menu className="h-4.5 w-4.5" />
                        )}
                    </button>
                </div>
            </nav>

            {/* === MOBILE DRAWER OVERLAY === */}
            {/* Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 z-[99] md:hidden transition-opacity duration-300",
                    isDark ? "bg-black/60" : "bg-black/20",
                    isMobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
                onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Drawer panel */}
            <div
                className={cn(
                    "fixed top-16 left-0 right-0 z-[100] md:hidden transition-all duration-300 ease-out",
                    isMobileMenuOpen
                        ? "translate-y-0 opacity-100"
                        : "-translate-y-3 opacity-0 pointer-events-none",
                    isDark
                        ? "bg-[#0d1117] border-b border-white/[0.06]"
                        : "bg-white border-b border-slate-200"
                )}
            >
                <div className="px-4 py-3 flex flex-col gap-1">
                    {userId ? (
                        <>
                            {tenant.slug && (
                                <Link
                                    href={`/academy/${tenant.slug}/classroom`}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-3 rounded-xl text-[14px] font-semibold transition-colors",
                                        isDark
                                            ? "text-slate-400 hover:text-slate-100 hover:bg-white/[0.05]"
                                            : "text-slate-600 hover:text-[#062e39] hover:bg-slate-50"
                                    )}
                                >
                                    <BookOpen className="h-[18px] w-[18px] flex-shrink-0" />
                                    Classroom
                                </Link>
                            )}

                            {isAdmin && (
                                <Link
                                    href={`/academy/${tenant.slug}/admin`}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-3 rounded-xl text-[14px] font-semibold transition-colors",
                                        isDark
                                            ? "text-slate-400 hover:text-slate-100 hover:bg-white/[0.05]"
                                            : "text-slate-600 hover:text-[#062e39] hover:bg-slate-50"
                                    )}
                                >
                                    <Settings className="h-[18px] w-[18px] flex-shrink-0" />
                                    Admin
                                </Link>
                            )}

                            <div
                                className={cn(
                                    "h-px my-1.5",
                                    isDark ? "bg-white/[0.06]" : "bg-slate-100"
                                )}
                            />

                            <Link
                                href={`/academy/${tenant.slug}/dashboard`}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="h-12 rounded-xl bg-[#fd5523] hover:bg-[#e84b1c] text-white text-[13px] font-bold flex items-center justify-center gap-2 transition-colors"
                            >
                                <LayoutDashboard className="h-4 w-4" />
                                Student Dashboard
                            </Link>
                        </>
                    ) : (
                        <>
                            <Link
                                    href={signInUrl}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={cn(
                                        "h-12 rounded-xl flex items-center justify-center text-[13px] font-bold transition-colors border",
                                        isDark
                                            ? "border-white/[0.12] text-slate-300 hover:bg-white/[0.05]"
                                            : "border-slate-200 text-slate-700 hover:bg-slate-50"
                                    )}
                                >
                                    Login
                                </Link>
                                <Link
                                    href={signUpUrl}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="h-12 rounded-xl bg-[#fd5523] hover:bg-[#e84b1c] text-white text-[13px] font-bold flex items-center justify-center gap-2 transition-colors"
                                >
                                    Get Started
                                    <ArrowUpRight className="h-4 w-4" />
                                </Link>
                        </>
                    )}
                    {/* Bottom safe-area breathing room */}
                    <div className="h-2" />
                </div>
            </div>
        </>
    );
}

