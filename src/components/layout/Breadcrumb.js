"use client"

import Link from "next/link"
import { useEffect, useState, useRef, useCallback } from "react"
import { usePathname } from "next/navigation"
import { HeroEnrollButton } from "@/components/hero/HeroEnrollButton"

/* ──────────────────────────────────────────────────────────────
   PAGE HERO CONFIGURATIONS
   Each key maps to a route prefix. The breadcrumb component
   auto-detects the active page and renders the matching hero.
   ────────────────────────────────────────────────────────────── */
const PAGE_HEROES = {
    courses: {
        title: "Explore Our Courses",
        tagline: "Learn AI Skills",
        subtitle: "Practical, hands-on courses designed for Zambian professionals",
        description: "Master the AI tools transforming industries — from ChatGPT to Midjourney and beyond.",
        gradient: "linear-gradient(135deg, #062e39 0%, #0a4a5c 40%, #0d6070 70%, #106a78 100%)",
        accentColor: "#fd5523",
        icon: "icon-book",
        rightPanel: "slider", // shows courses slider
        cta: { text: "View All Courses", href: "#catalog", icon: "icon-right-arrow21" },
        pattern: "mesh",
    },
    about: {
        title: "About Zed AI Academy",
        tagline: "Our Story",
        subtitle: "Zambia's leading platform for practical AI education",
        description: "We believe every professional deserves access to world-class AI training.",
        gradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 70%, #062e39 100%)",
        accentColor: "#fd8d69",
        icon: "icon-plane2",
        rightPanel: "featured", // shows featured course
        cta: null,
        pattern: "dots",
    },
    pricing: {
        title: "Pricing Plans",
        tagline: "Simple Pricing",
        subtitle: "Transparent plans in Zambian Kwacha — no hidden fees",
        description: "Start free, upgrade when you're ready.",
        gradient: "linear-gradient(135deg, #062e39 0%, #0b3d4d 35%, #fd5523 120%)",
        accentColor: "#fbbf24",
        icon: "icon-like",
        rightPanel: "featured",
        cta: null,
        pattern: "grid",
    },
    contact: {
        title: "Contact Us",
        tagline: "Get In Touch",
        subtitle: "Have a question? Our team responds within 24 hours",
        description: "Whether it's about courses, team plans, or partnerships — we're here to help.",
        gradient: "linear-gradient(135deg, #062e39 0%, #0d4f63 50%, #1a6b80 100%)",
        accentColor: "#34d399",
        icon: "icon-chat",
        rightPanel: "featured",
        cta: null,
        pattern: "waves",
    },
    blog: {
        title: "Blog & AI Insights",
        tagline: "AI Knowledge",
        subtitle: "Expert articles, tutorials, and AI industry updates",
        description: "Stay ahead of the curve with insights from Africa's growing AI community.",
        gradient: "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 80%, #4f46e5 100%)",
        accentColor: "#a78bfa",
        icon: "icon-pen",
        rightPanel: "featured",
        cta: null,
        pattern: "dots",
    },
    faq: {
        title: "FAQ",
        tagline: "Help Center",
        subtitle: "Quick answers to common questions",
        description: "Everything you need to know about courses, pricing, and certificates.",
        gradient: "linear-gradient(135deg, #062e39 0%, #0a4a5c 50%, #0d6070 100%)",
        accentColor: "#fbbf24",
        icon: "icon-like",
        rightPanel: "featured",
        cta: null,
        pattern: "mesh",
    },
    certificates: {
        title: "Certificates",
        tagline: "Your Achievements",
        subtitle: "Verified digital certificates for completed courses",
        description: "Showcase your AI skills with certificates you can share on LinkedIn.",
        gradient: "linear-gradient(135deg, #062e39 0%, #134e5e 50%, #1a6b80 100%)",
        accentColor: "#fbbf24",
        icon: "icon-trophy",
        rightPanel: "featured",
        cta: null,
        pattern: "grid",
    },
}

const DEFAULT_HERO = {
    title: "",
    tagline: "Zed AI Academy",
    subtitle: "Practical AI Skills for Zambian Professionals",
    description: "",
    gradient: "linear-gradient(135deg, #062e39 0%, #0d4f63 60%, #1a6b80 100%)",
    accentColor: "#fd5523",
    icon: "icon-book",
    rightPanel: "featured",
    cta: null,
    pattern: "dots",
}

/* ──────────────────────────────────────────────────────────────
   COURSE SLIDER (for courses page hero)
   ────────────────────────────────────────────────────────────── */
function CourseSlider({ courses }) {
    const [activeIdx, setActiveIdx] = useState(0)
    const intervalRef = useRef(null)

    const startAutoPlay = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current)
        intervalRef.current = setInterval(() => {
            setActiveIdx((prev) => (prev + 1) % Math.min(courses.length, 5))
        }, 4000)
    }, [courses.length])

    useEffect(() => {
        if (courses.length > 1) startAutoPlay()
        return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
    }, [courses.length, startAutoPlay])

    const goTo = (idx) => {
        setActiveIdx(idx)
        startAutoPlay()
    }

    if (!courses || courses.length === 0) return null

    const visibleCourses = courses.slice(0, 5)
    const course = visibleCourses[activeIdx]

    return (
        <div className="breadcrumb-hero__slider">
            {/* Active course card */}
            <div className="breadcrumb-hero__slide-card" key={course.id}>
                <div className="breadcrumb-hero__slide-thumb">
                    {course.thumbnail_url ? (
                        <img src={course.thumbnail_url} alt={course.title} />
                    ) : (
                        <div className="breadcrumb-hero__slide-thumb-placeholder">
                            <span className="icon-book" />
                        </div>
                    )}
                    {course.is_featured && (
                        <span className="breadcrumb-hero__slide-badge">Featured</span>
                    )}
                    <span className="breadcrumb-hero__slide-price">
                        {course.price_type === "free"
                            ? "FREE"
                            : course.price_amount
                            ? `ZMW ${Math.round(course.price_amount)}`
                            : "View"}
                    </span>
                </div>
                <div className="breadcrumb-hero__slide-info">
                    <div className="breadcrumb-hero__slide-meta">
                        {course.category && <span>{course.category}</span>}
                        {course.level && <span>{course.level}</span>}
                    </div>
                    <h3 className="breadcrumb-hero__slide-title">
                        <Link href={`/courses/${course.slug}`}>{course.title}</Link>
                    </h3>
                    {course.description && (
                        <p className="breadcrumb-hero__slide-desc">
                            {course.description.length > 80
                                ? course.description.slice(0, 80) + "…"
                                : course.description}
                        </p>
                    )}
                    <div className="breadcrumb-hero__slide-footer">
                        <HeroEnrollButton
                            courseId={course.id}
                            courseSlug={course.slug}
                            priceType={course.price_type}
                            priceAmount={course.price_amount}
                            compact
                        />
                        {course.enrollmentCount > 0 && (
                            <span className="breadcrumb-hero__slide-students">
                                👥 {course.enrollmentCount} student{course.enrollmentCount !== 1 ? "s" : ""}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Dot navigation */}
            {visibleCourses.length > 1 && (
                <div className="breadcrumb-hero__slider-dots">
                    {visibleCourses.map((c, idx) => (
                        <button
                            key={c.id}
                            className={`breadcrumb-hero__slider-dot ${idx === activeIdx ? "active" : ""}`}
                            onClick={() => goTo(idx)}
                            aria-label={`View ${c.title}`}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

/* ──────────────────────────────────────────────────────────────
   FEATURED COURSE CARD (for non-courses pages)
   ────────────────────────────────────────────────────────────── */
function FeaturedCourseCard({ courses }) {
    // Pick a featured course, or first available
    const course = courses?.find((c) => c.is_featured) || courses?.[0]
    if (!course) return null

    return (
        <div className="breadcrumb-hero__featured">
            <div className="breadcrumb-hero__featured-label">
                ✦ Featured Course
            </div>
            <Link href={`/courses/${course.slug}`} className="breadcrumb-hero__featured-card">
                <div className="breadcrumb-hero__featured-thumb">
                    {course.thumbnail_url ? (
                        <img src={course.thumbnail_url} alt={course.title} />
                    ) : (
                        <div className="breadcrumb-hero__featured-thumb-placeholder">
                            <span className="icon-book" />
                        </div>
                    )}
                </div>
                <div className="breadcrumb-hero__featured-body">
                    <div className="breadcrumb-hero__featured-meta">
                        {course.category && <span>{course.category}</span>}
                        <span>{course.price_type === "free" ? "Free" : course.price_amount ? `ZMW ${Math.round(course.price_amount)}` : ""}</span>
                    </div>
                    <h4 className="breadcrumb-hero__featured-title">{course.title}</h4>
                    {course.enrollmentCount > 0 && (
                        <p className="breadcrumb-hero__featured-students">
                            {course.enrollmentCount} student{course.enrollmentCount !== 1 ? "s" : ""} enrolled
                        </p>
                    )}
                </div>
            </Link>
            <div style={{ marginTop: "10px" }}>
                <HeroEnrollButton
                    courseId={course.id}
                    courseSlug={course.slug}
                    priceType={course.price_type}
                    priceAmount={course.price_amount}
                />
            </div>
        </div>
    )
}

/* ──────────────────────────────────────────────────────────────
   REAL STATS BAR (factual data from API)
   ────────────────────────────────────────────────────────────── */
function StatsBar({ stats, accentColor }) {
    if (!stats) return null

    const items = [
        stats.totalCourses > 0 && { icon: "📚", value: `${stats.totalCourses}`, label: "Courses" },
        stats.uniqueStudents > 0 && { icon: "👥", value: `${stats.uniqueStudents}`, label: "Students" },
        stats.avgRating && { icon: "⭐", value: stats.avgRating, label: "Rating" },
        stats.freeCourses > 0 && { icon: "🆓", value: `${stats.freeCourses}`, label: "Free" },
    ].filter(Boolean)

    if (items.length === 0) return null

    return (
        <div className="breadcrumb-hero__statsbar">
            {items.map((item, idx) => (
                <div key={idx} className="breadcrumb-hero__statsbar-item">
                    <span className="breadcrumb-hero__statsbar-icon">{item.icon}</span>
                    <span className="breadcrumb-hero__statsbar-value" style={{ color: accentColor }}>{item.value}</span>
                    <span className="breadcrumb-hero__statsbar-label">{item.label}</span>
                </div>
            ))}
        </div>
    )
}

/* ──────────────────────────────────────────────────────────────
   BREADCRUMB HERO COMPONENT
   ────────────────────────────────────────────────────────────── */
export default function Breadcrumb({ breadcrumbTitle }) {
    const pathname = usePathname()
    const [mounted, setMounted] = useState(false)
    const [heroData, setHeroData] = useState(null)

    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 50)
        return () => clearTimeout(t)
    }, [])

    // Fetch real data from API
    useEffect(() => {
        fetch("/api/hero-data")
            .then((r) => r.json())
            .then((data) => setHeroData(data))
            .catch(() => {})
    }, [])

    // Determine which hero config to use based on current route
    const routeKey = Object.keys(PAGE_HEROES).find((key) => {
        const segments = pathname?.split("/").filter(Boolean) || []
        return segments[0] === key
    })

    const hero = routeKey ? PAGE_HEROES[routeKey] : DEFAULT_HERO
    const displayTitle = hero.title || breadcrumbTitle

    // Build breadcrumb trail
    const segments = pathname?.split("/").filter(Boolean) || []
    const crumbs = segments.map((seg, idx) => ({
        label: seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        href: "/" + segments.slice(0, idx + 1).join("/"),
        isLast: idx === segments.length - 1,
    }))

    return (
        <section className="breadcrumb-hero" style={{ background: hero.gradient }}>
            {/* Animated background pattern */}
            <div className={`breadcrumb-hero__pattern breadcrumb-hero__pattern--${hero.pattern}`} />

            {/* Floating decorative elements */}
            <div className="breadcrumb-hero__floaters">
                <span className="breadcrumb-hero__float breadcrumb-hero__float--1" style={{ color: hero.accentColor }}>✦</span>
                <span className="breadcrumb-hero__float breadcrumb-hero__float--2" style={{ color: hero.accentColor }}>⬡</span>
                <span className="breadcrumb-hero__float breadcrumb-hero__float--3" style={{ color: hero.accentColor }}>◆</span>
            </div>

            {/* Glowing orb */}
            <div
                className="breadcrumb-hero__orb"
                style={{ background: `radial-gradient(circle, ${hero.accentColor}22 0%, transparent 70%)` }}
            />

            <div className="container">
                <div className={`breadcrumb-hero__content ${mounted ? "breadcrumb-hero__content--visible" : ""}`}>
                    {/* Left column — text content */}
                    <div className="breadcrumb-hero__text">
                        {/* Tagline chip */}
                        <div className="breadcrumb-hero__tagline" style={{ borderColor: `${hero.accentColor}40` }}>
                            <span className={hero.icon} style={{ color: hero.accentColor }} />
                            <span style={{ color: hero.accentColor }}>{hero.tagline}</span>
                        </div>

                        {/* Main title */}
                        <h1 className="breadcrumb-hero__title">{displayTitle}</h1>

                        {/* Subtitle */}
                        {hero.subtitle && (
                            <p className="breadcrumb-hero__subtitle">{hero.subtitle}</p>
                        )}

                        {/* Description */}
                        {hero.description && (
                            <p className="breadcrumb-hero__desc">{hero.description}</p>
                        )}

                        {/* Stats bar */}
                        <StatsBar stats={heroData?.stats} accentColor={hero.accentColor} />

                        {/* CTA button */}
                        {hero.cta && (
                            <div className="breadcrumb-hero__cta-wrap">
                                <Link
                                    className="thm-btn breadcrumb-hero__cta"
                                    href={hero.cta.href}
                                >
                                    {hero.cta.text}
                                    <i className={hero.cta.icon} />
                                    <span className="hover-btn hover-bx"></span>
                                    <span className="hover-btn hover-bx2"></span>
                                    <span className="hover-btn hover-bx3"></span>
                                    <span className="hover-btn hover-bx4"></span>
                                </Link>
                            </div>
                        )}

                        {/* Breadcrumb trail */}
                        <nav className="breadcrumb-hero__trail">
                            <ul>
                                <li>
                                    <Link href="/">Home</Link>
                                </li>
                                {crumbs.map((crumb) => (
                                    <li key={crumb.href}>
                                        <span className="breadcrumb-hero__separator">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="9 18 15 12 9 6" />
                                            </svg>
                                        </span>
                                        {crumb.isLast ? (
                                            <span className="breadcrumb-hero__current">{breadcrumbTitle || crumb.label}</span>
                                        ) : (
                                            <Link href={crumb.href}>{crumb.label}</Link>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    </div>

                    {/* Right column — dynamic panel */}
                    <div className="breadcrumb-hero__right">
                        {hero.rightPanel === "slider" && heroData?.courses && (
                            <CourseSlider courses={heroData.courses} />
                        )}
                        {hero.rightPanel === "featured" && heroData?.courses && (
                            <FeaturedCourseCard courses={heroData.courses} />
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom wave divider */}
            <div className="breadcrumb-hero__wave">
                <svg viewBox="0 0 1440 80" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                        d="M0,40 C320,80 640,0 960,40 C1120,60 1280,20 1440,40 L1440,80 L0,80 Z"
                        fill="#ffffff"
                    />
                </svg>
            </div>
        </section>
    )
}
