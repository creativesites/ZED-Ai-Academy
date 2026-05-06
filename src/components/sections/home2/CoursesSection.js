import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { HeroEnrollButton } from "@/components/hero/HeroEnrollButton";
import { BookOpen, Star, Users, ArrowRight, Sparkles } from "lucide-react";

export default async function CoursesSection() {
    const supabase = createClient();

    // Fetch featured courses for the home page
    const { data: courses } = await supabase
        .from("courses")
        .select("id, slug, title, description, thumbnail_url, category, level, price_type, price_amount, is_featured")
        .eq("status", "published")
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(3);

    // Fetch enrollment counts for popularity display
    const { data: enrollData } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("status", "active");

    const enrollMap = {};
    for (const e of enrollData ?? []) {
        enrollMap[e.course_id] = (enrollMap[e.course_id] ?? 0) + 1;
    }

    if (!courses || courses.length === 0) return null;

    return (
        <section className="courses-section" style={{ padding: "100px 0", background: "#f8f9fa" }}>
            <div className="container">
                <div className="sec-title text-center">
                    <div className="sec-title__tagline">
                        <div className="line"></div>
                        <div className="text"><h4>Level Up Your Career</h4></div>
                        <div className="icon"><Sparkles className="text-[#fd5523]" size={20} /></div>
                    </div>
                    <h2 className="sec-title__title">Most Popular <span>AI Courses</span></h2>
                </div>

                <div className="row gutter-y-30">
                    {courses.map((course) => (
                        <div key={course.id} className="col-xl-4 col-lg-4 col-md-6 wow fadeInUp" data-wow-delay="100ms">
                            <div className="course-card" style={{ 
                                background: "#fff", 
                                borderRadius: "24px", 
                                overflow: "hidden", 
                                border: "1px solid #eef0f2",
                                transition: "all 0.3s ease",
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                                boxShadow: "0 10px 30px rgba(0,0,0,0.03)"
                            }}>
                                <div className="course-card__img" style={{ position: "relative", height: "220px", overflow: "hidden" }}>
                                    <img 
                                        src={course.thumbnail_url || "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=600&q=80&auto=format&fit=crop"} 
                                        alt={course.title}
                                        style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.5s ease" }}
                                    />
                                    {course.is_featured && (
                                        <span style={{ 
                                            position: "absolute", top: "15px", left: "15px", 
                                            background: "#fd5523", color: "#fff", padding: "4px 12px", 
                                            borderRadius: "100px", fontSize: "11px", fontWeight: "800", textTransform: "uppercase" 
                                        }}>Featured</span>
                                    )}
                                    <div style={{ 
                                        position: "absolute", bottom: "15px", right: "15px", 
                                        background: "rgba(6,46,57,0.85)", backdropFilter: "blur(4px)", color: "#fff", 
                                        padding: "4px 14px", borderRadius: "100px", fontSize: "13px", fontWeight: "800" 
                                    }}>
                                        {course.price_type === "free" ? "FREE" : `ZMW ${Math.round(course.price_amount)}`}
                                    </div>
                                </div>
                                
                                <div className="course-card__content" style={{ padding: "24px", flex: 1, display: "flex", flexDirection: "column" }}>
                                    <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#fd5523", background: "rgba(253,85,35,0.1)", padding: "2px 10px", borderRadius: "100px", textTransform: "uppercase" }}>
                                            {course.category}
                                        </span>
                                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#666", background: "#f0f2f5", padding: "2px 10px", borderRadius: "100px", textTransform: "uppercase" }}>
                                            {course.level}
                                        </span>
                                    </div>
                                    
                                    <h3 style={{ fontSize: "20px", fontWeight: "800", color: "#062e39", marginBottom: "12px", lineHeight: "1.3" }}>
                                        <Link href={`/courses/${course.slug}`} style={{ color: "inherit", textDecoration: "none" }}>{course.title}</Link>
                                    </h3>
                                    
                                    <p style={{ fontSize: "14px", color: "#666", lineHeight: "1.6", marginBottom: "20px", flex: 1 }}>
                                        {course.description?.length > 100 ? course.description.slice(0, 100) + "..." : course.description}
                                    </p>
                                    
                                    <div style={{ 
                                        display: "flex", alignItems: "center", justifyContent: "space-between", 
                                        paddingTop: "20px", borderTop: "1px solid #f0f2f5", marginTop: "auto" 
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", fontWeight: "600", color: "#666" }}>
                                                <Users size={14} className="text-[#fd5523]" />
                                                {enrollMap[course.id] || 0}
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", fontWeight: "600", color: "#666" }}>
                                                <Star size={14} className="text-[#fbbf24] fill-[#fbbf24]" />
                                                4.9
                                            </div>
                                        </div>
                                        <HeroEnrollButton 
                                            courseId={course.id} 
                                            courseSlug={course.slug} 
                                            priceType={course.price_type} 
                                            priceAmount={course.price_amount}
                                            compact
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="text-center" style={{ marginTop: "50px" }}>
                    <Link href="/courses" className="thm-btn" style={{ background: "transparent", border: "2px solid #062e39", color: "#062e39" }}>
                        View All Courses
                        <i className="icon-right-arrow21"></i>
                        <span className="hover-btn hover-bx"></span>
                        <span className="hover-btn hover-bx2"></span>
                        <span className="hover-btn hover-bx3"></span>
                        <span className="hover-btn hover-bx4"></span>
                    </Link>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                .course-card:hover {
                    transform: translateY(-8px);
                    box-shadow: 0 20px 40px rgba(6,46,57,0.1) !important;
                    border-color: #fd552320 !important;
                }
                .course-card:hover .course-card__img img {
                    transform: scale(1.05);
                }
            `}} />
        </section>
    );
}
