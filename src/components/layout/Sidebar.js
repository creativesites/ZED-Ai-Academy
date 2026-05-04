'use client'
import Link from "next/link"
import { Sparkles, Mail, Phone, MapPin, X } from "lucide-react"

export default function Sidebar({ isSidebar, handleSidebar }) {
    return (
        <>
        <div className={`xs-sidebar-group info-group info-sidebar ${isSidebar ? "isActive" : ""}`}>
            <div className="xs-overlay xs-bg-black" onClick={handleSidebar}></div>
            <div className="xs-sidebar-widget">
                <div className="sidebar-widget-container">
                    <div className="widget-heading">
                        <button onClick={handleSidebar} className="close-side-widget">
                            <X className="h-6 w-6 text-white" />
                        </button>
                    </div>
                    <div className="sidebar-textwidget">
                        <div className="sidebar-info-contents">
                            <div className="content-inner">
                                <div className="logo mb-10">
                                    <Link href="/"><img src="/images/zed-ai-logo.png" alt="Zed AI Academy" className="w-[220px]" /></Link>
                                </div>
                                <div className="content-box mb-12">
                                    <h4 className="text-xl font-bold text-[#062e39] mb-4">Master AI Skills</h4>
                                    <div className="inner-text">
                                        <p className="text-slate-500 leading-relaxed">
                                            Zed AI Academy is Zambia&apos;s premier platform for mastering Artificial Intelligence. 
                                            We bridge the gap between global technology and local talent through hands-on, practical training.
                                        </p>
                                    </div>
                                    <div className="mt-6 flex flex-col gap-2">
                                        <Link href="/dashboard" className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-slate-50 text-[#062e39] font-bold transition-all hover:bg-[#fd5523] hover:text-white group">
                                            <div className="h-2 w-2 rounded-full bg-[#fd5523] group-hover:bg-white" />
                                            Student Dashboard
                                        </Link>
                                        <Link href="/dashboard/settings" className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-slate-50 text-[#062e39] font-bold transition-all hover:bg-[#fd5523] hover:text-white group">
                                            <div className="h-2 w-2 rounded-full bg-[#fd5523] group-hover:bg-white" />
                                            Account Settings
                                        </Link>
                                    </div>
                                </div>

                                <div className="sidebar-contact-info mb-12">
                                    <h4 className="text-xl font-bold text-[#062e39] mb-6">Contact Info</h4>
                                    <ul className="space-y-6">
                                        <li className="flex items-start gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                                                <MapPin className="h-5 w-5 text-[#fd5523]" />
                                            </div>
                                            <span className="text-slate-600 text-sm font-medium pt-2">Lusaka, Zambia 🇿🇲<br/>East Park Office Suite</span>
                                        </li>
                                        <li className="flex items-start gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                                                <Phone className="h-5 w-5 text-[#fd5523]" />
                                            </div>
                                            <div className="pt-2">
                                                <Link href="tel:+260979046745" className="block text-slate-600 text-sm font-bold hover:text-[#fd5523] transition-colors">0979 046 745</Link>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">WhatsApp Available</span>
                                            </div>
                                        </li>
                                        <li className="flex items-start gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                                                <Mail className="h-5 w-5 text-[#fd5523]" />
                                            </div>
                                            <div className="pt-2">
                                                <Link href="mailto:creativesites263@gmail.com" className="block text-slate-600 text-sm font-bold hover:text-[#fd5523] transition-colors">creativesites263@gmail.com</Link>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Admissions & Support</span>
                                            </div>
                                        </li>
                                    </ul>
                                </div>

                                <div className="thm-social-link1">
                                    <h4 className="text-xl font-bold text-[#062e39] mb-6">Connect With Us</h4>
                                    <ul className="social-box flex gap-4">
                                        <li className="facebook">
                                            <Link href="#" className="h-12 w-12 rounded-2xl bg-[#062e39] text-white flex items-center justify-center hover:bg-[#fd5523] transition-all duration-300">
                                                <i className="icon-facebook-f" aria-hidden="true"></i>
                                            </Link>
                                        </li>
                                        <li className="twitter">
                                            <Link href="#" className="h-12 w-12 rounded-2xl bg-[#062e39] text-white flex items-center justify-center hover:bg-[#fd5523] transition-all duration-300">
                                                <i className="icon-twitter" aria-hidden="true"></i>
                                            </Link>
                                        </li>
                                        <li className="linkedin">
                                            <Link href="#" className="h-12 w-12 rounded-2xl bg-[#062e39] text-white flex items-center justify-center hover:bg-[#fd5523] transition-all duration-300">
                                                <i className="icon-linkedin" aria-hidden="true"></i>
                                            </Link>
                                        </li>
                                    </ul>
                                </div>

                                <div className="mt-12 p-8 rounded-[2.5rem] bg-[#062e39] text-white text-center">
                                     <h5 className="text-lg font-bold mb-3">Ready to Start?</h5>
                                     <p className="text-white/60 text-sm mb-6 leading-relaxed">Join our next cohort and transform your career with AI.</p>
                                     <Link href="/courses" className="thm-btn w-full">
                                        View Courses
                                        <i className="icon-right-arrow21"></i>
                                     </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        </>
    )
}
