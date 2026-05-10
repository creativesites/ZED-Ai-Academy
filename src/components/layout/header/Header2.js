'use client'
import { useState, useEffect } from "react";
import Link from "next/link"
import { useAuth } from "@clerk/nextjs"
import { SignInButton, SignUpButton, UserButton, OrganizationSwitcher } from "@clerk/nextjs"
import { getSiteAsset } from "@/lib/site-assets";
import Menu from "../Menu"
import MobileMenu from "../MobileMenu"
import { LaunchAcademyCTA } from "@/components/layout/LaunchAcademyCTA"
import { Search, Menu as MenuIcon, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function AuthButtons() {
    const { isSignedIn, isLoaded, userId } = useAuth()
    const [tenantSlug, setTenantSlug] = useState(null)
    const [role, setRole] = useState(null)

    useEffect(() => {
        if (isSignedIn && userId) {
            const supabase = createClient();
            
            async function fetchUserContext() {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("role, company_id")
                    .eq("id", userId)
                    .single();
                
                if (profile) {
                    setRole(profile.role);
                    
                    // Fetch latest active company slug
                    const { data: membership } = await supabase
                        .from("company_members")
                        .select("company_id, companies(slug)")
                        .eq("profile_id", userId)
                        .eq("status", "active")
                        .order("joined_at", { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    
                    if (membership?.companies?.slug) {
                        setTenantSlug(membership.companies.slug);
                    } else if (profile.company_id) {
                        const { data: company } = await supabase
                            .from("companies")
                            .select("slug")
                            .eq("id", profile.company_id)
                            .maybeSingle();
                        if (company) setTenantSlug(company.slug);
                    }
                }
            }
            
            fetchUserContext();
        }
    }, [isSignedIn, userId]);

    if (!isLoaded) return null

    if (isSignedIn) {
        const canVisitSite = role === "super_admin" || role === "company_admin";

        return (
            <div className="flex items-center gap-4 mx-6">
                <LaunchAcademyCTA className="hidden md:flex" />
                {canVisitSite && tenantSlug && (
                    <Link 
                        href={`/academy/${tenantSlug}`}
                        target="_blank"
                        className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#fd5523]/10 text-[#fd5523] hover:bg-[#fd5523] hover:text-white transition-all text-[10px] font-black uppercase tracking-widest border border-[#fd5523]/20"
                    >
                        <Sparkles className="h-3 w-3" />
                        Visit Site
                    </Link>
                )}
                <OrganizationSwitcher 
                    hidePersonal={false}
                    appearance={{
                        elements: {
                            organizationSwitcherTrigger: "focus:outline-none focus:ring-0 shadow-none border-none",
                        }
                    }}
                />
                <div className="h-10 w-10 rounded-full ring-2 ring-slate-100 overflow-hidden flex items-center justify-center">
                   <UserButton afterSignOutUrl="/" />
                </div>
            </div>
        )
    }

    return (
        <div className="flex items-center gap-1.5 md:gap-3 ml-2 md:ml-6">
            <SignInButton mode="redirect">
                <button className="sign-in-btn text-[10px] md:text-xs px-3 md:px-6 py-1.5 md:py-1">
                Sign In
                </button>
            </SignInButton>
            <SignUpButton mode="redirect">
                <button className="sign-up-btn text-[10px] md:text-xs px-3 md:px-6 py-1.5 md:py-1 whitespace-nowrap">
                <span className="hidden xs:inline">Start Free</span>
                <span className="xs:hidden">Join</span>
                </button>
            </SignUpButton>
        </div>
    )
}

export default function Header2({ scroll, handlePopup, handleSidebar, handleMobileMenu }) {
    const [logoImg, setLogoImg] = useState("/images/zed-ai-logo2.png");
    const [logoImg1, setLogoImg1] = useState("/images/zed-ai-logo.png");

    useEffect(() => {
        getSiteAsset("home_hero", logoImg).then(setLogoImg);
    }, []);

    const TopBar = () => (
        <div className="main-header-two__top py-3">
            <div className="main-header-two__top-inner">
                <div className="main-header-two__top-left">
                    <div className="header-contact-style2">
                        <ul className="flex items-center gap-8">
                            <li className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center">
                                    <span className="icon-email text-[#fd5523]"></span>
                                </div>
                                <div className="text-box">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Email Us</p>
                                    <Link href="mailto:creativesites263@gmail.com" className="text-xs font-bold text-[#062e39] hover:text-[#fd5523]">creativesites263@gmail.com</Link>
                                </div>
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center">
                                    <span className="icon-phone2 text-[#fd5523]"></span>
                                </div>
                                <div className="text-box">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Admissions</p>
                                    <Link href="tel:+260979046745" className="text-xs font-bold text-[#062e39] hover:text-[#fd5523]">0979 046 745</Link>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
                <div className="main-header-two__top-right">
                    <div className="flex items-center gap-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Zambia&apos;s AI Academy</p>
                        <div className="h-1 w-1 rounded-full bg-[#fd5523]" />
                        <ul className="flex gap-4">
                            <li><Link href="https://x.com/zed_ai_academy" className="text-slate-400 hover:text-[#fd5523] transition-colors"><span className="icon-twitter1"></span></Link></li>
                            <li><Link href="https://www.linkedin.com/in/winston-tinashe-5939b91b6/" className="text-slate-400 hover:text-[#fd5523] transition-colors"><span className="icon-linkedin"></span></Link></li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );

    const BottomBar = () => (
        <div className="main-header-two__bottom pr-3">
            <div className="shape1"></div>
            <div className="main-header-two__bottom-inner flex items-center justify-between">
                <div className="main-header-two__bottom-left">
                    <div className="main-header-two__menu">
                        <div className="main-menu__main-menu-box flex items-center gap-6">
                            <button className="lg:hidden text-[#062e39] hover:text-[#fd5523] transition-colors" onClick={handleMobileMenu}>
                                <MenuIcon className="h-5 w-5 md:h-6 md:w-6" />
                            </button>
                            <Menu />
                        </div>
                    </div>
                </div>
                <div className="main-header-two__bottom-right flex items-center">
                    <button 
                        onClick={handlePopup} 
                        className="h-7 w-7 md:h-8 md:w-8 flex items-center justify-center rounded-xl md:rounded-2xl bg-slate-50 text-[#062e39] hover:bg-[#fd5523] hover:text-white transition-all shadow-sm"
                    >
                        <Search className="h-4 w-4 md:h-5 md:w-5" />
                    </button>
                    
                    <button 
                        onClick={handleSidebar}
                        className="h-7 w-7 md:h-8 md:w-8 flex items-center justify-center rounded-xl md:rounded-2xl bg-[#062e39] text-white hover:bg-[#fd5523] transition-all ml-2 md:ml-3 shadow-xl shadow-[#062e39]/10"
                    >
                        <MenuIcon className="h-4 w-4 md:h-5 md:w-5" />
                    </button>
                    
                    <AuthButtons />
                </div>
            </div>
        </div>
    );

    return (
        <>
            <header className="main-header main-header-two">
                <nav className="main-menu">
                    <div className="main-menu__wrapper">
                        <div className="container">
                            <div className="main-menu__wrapper-inner">
                                <div className="main-header-two__inner">
                                    <div className="logo-box-two lg:py-6">
                                        <Link href="/">
                                            <img 
                                                src="/images/zed-ai-logo2.png" 
                                                className="w-[140px] xs:w-[160px] lg:w-[240px] transition-transform hover:scale-105 duration-500" 
                                                alt="Zed AI Academy" 
                                            />
                                        </Link>
                                    </div>
                                    <div className="hidden lg:block">
                                        <TopBar />
                                    </div>
                                    <BottomBar />
                                </div>
                            </div>
                        </div>
                    </div>
                </nav>
            </header>

            <div className={`stricky-header stricky-header--style2 stricked-menu main-menu ${scroll ? "stricky-fixed" : ""}`}>
                <div className="sticky-header__content pr-3">
                    <div className="main-menu__wrapper">
                        <div className="container">
                            <div className="main-menu__wrapper-inner">
                                <div className="main-header-two__inner flex items-center justify-between">
                                    <div className="logo-box-two py-2">
                                        <Link href="/">
                                            <img 
                                                src="/images/zed-ai-logo.png" 
                                                className="w-[120px] md:w-[200px]" 
                                                alt="Zed AI Academy" 
                                            />
                                        </Link>
                                    </div>
                                    <div className="flex items-center gap-6 pr-3">
                                        <Menu />
                                        <div className="flex items-center gap-3 border-l pl-6 border-slate-100 ">
                                            <button onClick={handlePopup} className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-[#062e39] hover:text-[#fd5523] transition-colors">
                                                <Search className="h-4 w-4" />
                                            </button>
                                            <AuthButtons />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <MobileMenu handleMobileMenu={handleMobileMenu} />
        </>
    )
}
