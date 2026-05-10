'use client'
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { X as XClose, Mail, Phone, MapPin, Camera, X as XSocial, Briefcase, ChevronRight, LayoutDashboard, Sparkles, MessageCircle } from "lucide-react";
import { LaunchAcademyCTA } from "@/components/layout/LaunchAcademyCTA";

const MobileMenu = ({ handleMobileMenu }) => {
  const [isActive, setIsActive] = useState({ status: false, key: "" });
  const { isSignedIn, isLoaded } = useAuth();

  const handleToggle = (key) => {
    setIsActive(prev =>
      prev.key === key ? { status: false, key: "" } : { status: true, key }
    );
  };

  return (
    <>
      <div className="mobile-nav__wrapper">
        <div className="mobile-nav__overlay mobile-nav__toggler" onClick={handleMobileMenu}></div>
        <div className="mobile-nav__content bg-gradient-to-br from-[#062e39] to-[#0a4055] p-8">
          <button className="mobile-nav__close absolute top-8 right-8 h-12 w-12 rounded-2xl bg-gradient-to-br from-[#062e39] to-[#0a4055] flex items-center justify-center text-[#062e39]" onClick={handleMobileMenu}>
            <XClose className="h-6 w-6" />
          </button>

          <div className="logo-box mb-12">
            <Link href="/" onClick={handleMobileMenu}>
              <img src="/images/zed-ai-logo.png" width="200" alt="Zed AI Academy" />
            </Link>
          </div>

          <div className="mobile-nav__container mb-12">
            <ul className="space-y-4">
              <li><Link href="/" onClick={handleMobileMenu} className="text-2xl font-black text-[#062e39] hover:text-[#fd5523] transition-colors">Home</Link></li>
              <li><Link href="/courses" onClick={handleMobileMenu} className="text-2xl font-black text-[#062e39] hover:text-[#fd5523] transition-colors">Courses</Link></li>
              <li>
                <div className="flex items-center justify-between">
                   <Link href="/pricing" onClick={handleMobileMenu} className="text-2xl font-black text-[#062e39] hover:text-[#fd5523] transition-colors">Pricing</Link>
                   <button onClick={() => handleToggle(1)} className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center">
                      <ChevronRight className={`h-5 w-5 transition-transform ${isActive.key === 1 ? 'rotate-90' : ''}`} />
                   </button>
                </div>
                {isActive.key === 1 && (
                  <ul className="mt-4 ml-6 space-y-3 border-l-2 border-slate-50 pl-6 animate-in slide-in-from-top-2">
                    <li><Link href="/pricing" onClick={handleMobileMenu} className="text-lg font-bold text-slate-500 hover:text-[#fd5523]">Individual Plans</Link></li>
                    <li><Link href="/pricing#teams" onClick={handleMobileMenu} className="text-lg font-bold text-slate-500 hover:text-[#fd5523]">Team Plans</Link></li>
                  </ul>
                )}
              </li>
              <li><Link href="/about" onClick={handleMobileMenu} className="text-2xl font-black text-[#062e39] hover:text-[#fd5523] transition-colors">About</Link></li>
              {/* <li><Link href="/blog" onClick={handleMobileMenu} className="text-2xl font-black text-[#062e39] hover:text-[#fd5523] transition-colors">Blog</Link></li> */}
              <li><Link href="/contact" onClick={handleMobileMenu} className="text-2xl font-black text-[#062e39] hover:text-[#fd5523] transition-colors">Contact</Link></li>
            </ul>
          </div>

          <div className="space-y-8 mb-12">
            <div className="flex items-start gap-4">
               <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-[#fd5523] shrink-0">
                  <Mail className="h-5 w-5" />
               </div>
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email Us</p>
                  <Link href="mailto:creativesites263@gmail.com" className="text-sm font-bold text-[#062e39]">creativesites263@gmail.com</Link>
               </div>
            </div>
            <div className="flex items-start gap-4">
               <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-[#fd5523] shrink-0">
                  <Phone className="h-5 w-5" />
               </div>
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Call Us</p>
                  <Link href="tel:+260979046745" className="text-sm font-bold text-[#062e39]">0979 046 745</Link>
               </div>
            </div>
          </div>

          {isLoaded && (
            <div className="pt-8 border-t border-slate-100">
              {isSignedIn ? (
                <div className="flex flex-col gap-4">
                  <LaunchAcademyCTA variant="mobileMenu" />
                  <Link href="/dashboard" onClick={handleMobileMenu} className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl bg-[#062e39] text-white font-bold">
                    <LayoutDashboard className="h-5 w-5" />
                    Student Dashboard
                  </Link>
                  <div className="flex items-center justify-center gap-4 py-4 rounded-2xl bg-slate-50">
                    <span className="text-sm font-bold text-slate-500">Manage Account</span>
                    <UserButton afterSignOutUrl="/" />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <SignUpButton mode="redirect">
                    <button className="flex items-center justify-center gap-3 w-full py-5 rounded-2xl bg-[#fd5523] text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-[#fd5523]/20">
                      <Sparkles className="h-4 w-4" />
                      Start Learning Free
                    </button>
                  </SignUpButton>
                  <SignInButton mode="redirect">
                    <button className="w-full py-5 rounded-2xl border-2 border-slate-100 text-[#062e39] font-black uppercase tracking-widest text-xs">
                      Sign In
                    </button>
                  </SignInButton>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-4 mt-12">
            <Link href="https://wa.me/260979046745" target="_blank" className="h-12 w-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-[#25D366] hover:text-white transition-all">
              <MessageCircle className="h-5 w-5" />
            </Link>
            <Link href="mailto:creativesites263@gmail.com" className="h-12 w-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-[#fd5523] hover:text-white transition-all">
              <Mail className="h-5 w-5" />
            </Link>
            <Link href="/dashboard" onClick={handleMobileMenu} className="h-12 w-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-[#062e39] hover:text-white transition-all">
              <LayoutDashboard className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileMenu;
