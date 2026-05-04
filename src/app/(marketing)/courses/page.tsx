import Layout from "@/components/layout/Layout";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  COURSE_CATEGORY_FILTERS,
  COURSE_LEVEL_FILTERS,
  formatCategoryLabel,
  formatLevelLabel,
  formatPrice,
  getCourseMeta,
} from "@/lib/course-experience";

// TypeScript cast so Layout's optional props don't cause strict errors
const SiteLayout = Layout as React.ComponentType<React.PropsWithChildren<{
  headerStyle: number; footerStyle: number; breadcrumbTitle?: string;
}>>;

type CourseRow = {
  id: string; slug: string; title: string; description: string | null;
  thumbnail_url: string | null; category: string | null;
  level: "beginner" | "intermediate" | "advanced" | null;
  price_type: "free" | "one_time" | "subscription_only" | "both";
  price_amount: number | null; is_featured: boolean;
  avgRating?: number; reviewCount?: number;
};

import { Star } from "lucide-react";

function CourseCard({ course }: { course: CourseRow }) {
  const meta = getCourseMeta(course.category);
  const isFree = course.price_type === "free";
  const priceAmt = !isFree && course.price_amount ? Math.round(course.price_amount) : null;
  const excerpt = course.description ?? meta.audience;

  return (
    <div className="col-xl-4 col-lg-6 wow fadeInUp" data-wow-delay=".1s">
      <div className="blog-one__single">
        <div className="blog-one__single-img" style={{ position: "relative", overflow: "hidden" }}>
          <Link href={`/courses/${course.slug}`}>
            {course.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={course.thumbnail_url}
                alt={course.title}
                style={{ height: "220px", width: "100%", objectFit: "cover" }}
              />
            ) : (
              <div style={{
                height: "220px", width: "100%",
                background: "linear-gradient(135deg, #062e39 0%, #0d4f63 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span className="icon-book" style={{ fontSize: "48px", color: "rgba(253,85,35,0.65)" }}></span>
              </div>
            )}
          </Link>
          {course.is_featured && (
            <div style={{
              position: "absolute", top: "12px", right: "12px",
              background: "#fd5523", color: "#fff", padding: "3px 10px",
              borderRadius: "20px", fontSize: "12px", fontWeight: 600, zIndex: 1,
            }}>
              Featured
            </div>
          )}
        </div>

        <div className="blog-one__single-content">
          <div className="date-box">
            {isFree ? (
              <>
                <h2 style={{ fontSize: "13px", lineHeight: 1.3 }}>FREE</h2>
                <p>enroll</p>
              </>
            ) : (
              <>
                <h2>{priceAmt ?? "–"}</h2>
                <p>ZMW</p>
              </>
            )}
          </div>

          <div className="blog-one__single-content-inner">
            <ul className="meta-box" style={{ marginBottom: "12px" }}>
              <li>
                <div className="icon"><span className="icon-user"></span></div>
                <div className="text-box"><p>{formatLevelLabel(course.level)}</p></div>
              </li>
              <li>
                <div className="icon"><span className="icon-chat"></span></div>
                <div className="text-box"><p>{course.category ?? "AI"}</p></div>
              </li>
            </ul>

            {course.reviewCount && course.reviewCount > 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
                <Star style={{ width: "14px", height: "14px", color: "#facc15", fill: "#facc15" }} />
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#062e39" }}>{course.avgRating?.toFixed(1)}</span>
                <span style={{ fontSize: "12px", color: "#999" }}>({course.reviewCount})</span>
              </div>
            ) : (
              <div style={{ height: "26px", marginBottom: "12px" }} />
            )}

            <h2 style={{ marginTop: 0 }}><Link href={`/courses/${course.slug}`}>{course.title}</Link></h2>
            <p>{excerpt.length > 95 ? excerpt.slice(0, 95) + "…" : excerpt}</p>

            <div className="btn-box">
              <Link className="thm-btn" href={`/courses/${course.slug}`}>
                View Course
                <i className="icon-right-arrow21"></i>
                <span className="hover-btn hover-bx"></span>
                <span className="hover-btn hover-bx2"></span>
                <span className="hover-btn hover-bx3"></span>
                <span className="hover-btn hover-bx4"></span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; level?: string; q?: string }>;
}) {
  const params = await searchParams;
  const category = COURSE_CATEGORY_FILTERS.includes(
    (params.category ?? "all") as (typeof COURSE_CATEGORY_FILTERS)[number]
  )
    ? (params.category ?? "all")
    : "all";
  const level = COURSE_LEVEL_FILTERS.includes(
    (params.level ?? "all") as (typeof COURSE_LEVEL_FILTERS)[number]
  )
    ? (params.level ?? "all")
    : "all";

  const supabase = createClient();
  let query = supabase
    .from("courses")
    .select("id, slug, title, description, thumbnail_url, category, level, price_type, price_amount, is_featured")
    .eq("status", "published")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (category !== "all") query = query.ilike("category", `%${category.replace(/-/g, " ")}%`);
  if (level !== "all") query = query.eq("level", level as "beginner" | "intermediate" | "advanced");
  if (params.q) query = query.or(`title.ilike.%${params.q}%,description.ilike.%${params.q}%`);

  const { data: courses } = await query as { data: CourseRow[] | null };
  const totalCount = courses?.length ?? 0;
  const freeCount = courses?.filter((c) => c.price_type === "free").length ?? 0;

  // Discovery sections — only on unfiltered view
  const isFiltered = category !== "all" || level !== "all" || !!params.q;
  const featured = !isFiltered ? (courses?.filter((c) => c.is_featured) ?? []) : [];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let newCourses: CourseRow[] = [];
  if (!isFiltered) {
    const { data: newData } = await supabase
      .from("courses")
      .select("id, slug, title, description, thumbnail_url, category, level, price_type, price_amount, is_featured")
      .eq("status", "published")
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(6) as { data: CourseRow[] | null };
    newCourses = newData ?? [];
  }

  // Enrollment counts and reviews for all courses
  let popularCourses: (CourseRow & { enrollmentCount: number })[] = [];
  
  if (courses && courses.length > 0) {
    const courseIds = courses.map((c) => c.id);
    
    // Fetch enrollments
    const { data: enrollData } = await supabase
      .from("enrollments")
      .select("course_id")
      .in("course_id", courseIds);

    const countMap: Record<string, number> = {};
    for (const e of enrollData ?? []) {
      countMap[e.course_id] = (countMap[e.course_id] ?? 0) + 1;
    }
    
    // Fetch reviews
    const { data: reviewsData } = await supabase
      .from("reviews")
      .select("course_id, rating")
      .in("course_id", courseIds);
      
    const reviewMap: Record<string, { sum: number, count: number }> = {};
    for (const r of reviewsData ?? []) {
      if (!reviewMap[r.course_id]) reviewMap[r.course_id] = { sum: 0, count: 0 };
      reviewMap[r.course_id].sum += r.rating;
      reviewMap[r.course_id].count += 1;
    }
    
    // Populate course metadata
    for (const c of courses) {
      if (reviewMap[c.id]) {
        c.avgRating = reviewMap[c.id].sum / reviewMap[c.id].count;
        c.reviewCount = reviewMap[c.id].count;
      }
    }
    
    for (const c of newCourses) {
      if (reviewMap[c.id]) {
        c.avgRating = reviewMap[c.id].sum / reviewMap[c.id].count;
        c.reviewCount = reviewMap[c.id].count;
      }
    }

    if (!isFiltered) {
      popularCourses = courses
        .map((c) => ({ ...c, enrollmentCount: countMap[c.id] ?? 0 }))
        .filter((c) => c.enrollmentCount > 0)
        .sort((a, b) => b.enrollmentCount - a.enrollmentCount)
        .slice(0, 4);
    }
  }

  return (
    <SiteLayout headerStyle={2} footerStyle={1} breadcrumbTitle="All Courses">
      <section className="blog-page">
        <div className="container">

          {/* ── Discovery sections (unfiltered only) ──────────────────── */}
          {!isFiltered && (
            <>
              {/* Popular courses strip */}
              {popularCourses.length > 0 && (
                <div style={{ marginBottom: "60px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
                    <span style={{ fontSize: "18px", fontWeight: 800, color: "#062e39" }}>🔥 Most Popular</span>
                    <span style={{ flex: 1, height: "1px", background: "#f0f0f0" }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
                    {popularCourses.map((course, i) => (
                      <Link key={course.id} href={`/courses/${course.slug}`} style={{ textDecoration: "none" }}>
                        <div style={{
                          border: "1px solid #f0f0f0", borderRadius: "16px", overflow: "hidden",
                          background: "#fff", transition: "box-shadow 0.2s",
                          display: "flex", gap: "14px", padding: "14px", alignItems: "center",
                        }}>
                          <div style={{
                            width: "52px", height: "52px", flexShrink: 0, borderRadius: "12px",
                            overflow: "hidden", background: "#fff2e9",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {course.thumbnail_url
                              ? <img src={course.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <span style={{ fontSize: "22px", color: "#fd5523/30" }}>#</span>}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: "#062e39", fontSize: "13px", lineHeight: 1.4, marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {course.title}
                            </div>
                            <div style={{ fontSize: "12px", color: "#fd5523", fontWeight: 600 }}>
                              {course.enrollmentCount} student{course.enrollmentCount !== 1 ? "s" : ""}
                            </div>
                          </div>
                          <div style={{ marginLeft: "auto", flexShrink: 0, fontWeight: 900, color: "#e5e7eb", fontSize: "18px" }}>
                            #{i + 1}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* New this month */}
              {newCourses.length > 0 && (
                <div style={{ marginBottom: "60px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
                    <span style={{ fontSize: "18px", fontWeight: 800, color: "#062e39" }}>✨ New This Month</span>
                    <span style={{ flex: 1, height: "1px", background: "#f0f0f0" }} />
                  </div>
                  <div style={{ display: "flex", gap: "16px", overflowX: "auto", paddingBottom: "8px" }}>
                    {newCourses.map((course) => (
                      <Link key={course.id} href={`/courses/${course.slug}`} style={{ textDecoration: "none", flexShrink: 0, width: "200px" }}>
                        <div style={{ borderRadius: "14px", overflow: "hidden", border: "1px solid #f0f0f0", background: "#fff" }}>
                          <div style={{ height: "110px", overflow: "hidden", background: "#fff2e9" }}>
                            {course.thumbnail_url
                              ? <img src={course.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <div style={{ height: "100%", background: "linear-gradient(135deg,#062e39,#0d4f63)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#fd5523", fontSize: "28px" }}>✦</span></div>}
                          </div>
                          <div style={{ padding: "12px" }}>
                            <div style={{ fontSize: "11px", color: "#fd5523", fontWeight: 700, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              {course.category ?? "AI"}
                            </div>
                            <p style={{ fontSize: "13px", fontWeight: 700, color: "#062e39", margin: 0, lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                              {course.title}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Stats + filters */}
          <div style={{ marginBottom: "50px" }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              flexWrap: "wrap", gap: "10px", marginBottom: "22px",
            }}>
              <p style={{ margin: 0, fontWeight: 600, color: "#062e39", fontSize: "16px" }}>
                {totalCount} course{totalCount !== 1 ? "s" : ""}
                {freeCount > 0 && (
                  <span style={{ color: "#fd5523", marginLeft: "12px", fontWeight: 500, fontSize: "14px" }}>
                    · {freeCount} free
                  </span>
                )}
              </p>
            </div>

            <form method="GET" action="/courses">
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "stretch" }}>
                <div className="sidebar__search-form" style={{ flex: "1 1 220px" }}>
                  <input
                    type="search" name="q"
                    placeholder="Search courses…"
                    defaultValue={params.q}
                  />
                  <button type="submit"><i className="fa fa-search"></i></button>
                </div>

                <select
                  name="category"
                  defaultValue={category}
                  style={{
                    padding: "0 16px", border: "2px solid #e8e8e8", borderRadius: "8px",
                    background: "#fff", fontSize: "14px", color: "#444", minWidth: "160px",
                  }}
                >
                  {COURSE_CATEGORY_FILTERS.map((item) => (
                    <option key={item} value={item}>{formatCategoryLabel(item)}</option>
                  ))}
                </select>

                <select
                  name="level"
                  defaultValue={level}
                  style={{
                    padding: "0 16px", border: "2px solid #e8e8e8", borderRadius: "8px",
                    background: "#fff", fontSize: "14px", color: "#444", minWidth: "140px",
                  }}
                >
                  {COURSE_LEVEL_FILTERS.map((item) => (
                    <option key={item} value={item}>{item === "all" ? "All levels" : item}</option>
                  ))}
                </select>
              </div>

              {/* Category chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "14px" }}>
                {COURSE_CATEGORY_FILTERS.map((item) => (
                  <Link
                    key={item}
                    href={`/courses?category=${item}&level=${level}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`}
                    style={{
                      display: "inline-block", padding: "5px 15px", borderRadius: "20px",
                      fontSize: "13px", fontWeight: 500, textDecoration: "none",
                      background: category === item ? "#fd5523" : "#f0f0f0",
                      color: category === item ? "#fff" : "#555",
                      transition: "all 0.2s",
                    }}
                  >
                    {formatCategoryLabel(item)}
                  </Link>
                ))}
              </div>
            </form>
          </div>

          {/* Course grid */}
          {courses && courses.length > 0 ? (
            <div className="row">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "80px 20px", borderTop: "1px solid #eee" }}>
              <span className="icon-book" style={{ fontSize: "48px", color: "#ccc", display: "block", marginBottom: "20px" }}></span>
              <p style={{ fontSize: "18px", color: "#999", marginBottom: "24px" }}>
                No courses match your search.
              </p>
              <Link className="thm-btn" href="/courses">
                Clear Filters
                <i className="icon-right-arrow21"></i>
                <span className="hover-btn hover-bx"></span>
                <span className="hover-btn hover-bx2"></span>
                <span className="hover-btn hover-bx3"></span>
                <span className="hover-btn hover-bx4"></span>
              </Link>
            </div>
          )}

        </div>
      </section>
    </SiteLayout>
  );
}
