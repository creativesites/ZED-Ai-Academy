import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { enrollFree } from "@/actions/enrollments";
import { formatLevelLabel, formatPrice, getCourseMeta } from "@/lib/course-experience";
import { Award, BookOpen, CheckCircle, Layers, Lock, MessageSquare, Play, Users, Zap } from "lucide-react";
import type { Metadata } from "next";
import Layout from "@/components/layout/Layout";
import { CourseReviews } from "@/components/learner/course-reviews";
import { WhatsAppShare } from "@/components/shared/whatsapp-share";
import { ManualEnrollModal } from "@/components/learner/manual-enroll-modal";
import type { Review } from "@/types/database";

const SiteLayout = Layout as React.ComponentType<React.PropsWithChildren<{
  headerStyle: number; footerStyle: number; breadcrumbTitle?: string;
}>>;

type PageProps = { 
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ action?: string }>;
};
type LessonRow = { id: string; title: string; position: number; is_preview: boolean };
type ModuleRow = { id: string; title: string; position: number; lessons: LessonRow[] };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createClient();
  const { data } = await supabase.from("courses").select("title, description").eq("slug", slug).single();
  if (!data) return { title: "Course Not Found" };
  return { title: `${data.title} | Zed AI Academy`, description: data.description ?? undefined };
}

export default async function CourseDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { action } = await searchParams;
  const supabase = createClient();
  const { userId } = await auth();

  const { data: course } = (await supabase
    .from("courses")
    .select("*, profiles(full_name, avatar_url, bio)")
    .eq("slug", slug)
    .single()) as {
    data: {
      id: string; slug: string; title: string; description: string | null;
      thumbnail_url: string | null; category: string | null;
      level: "beginner" | "intermediate" | "advanced" | null;
      price_type: "free" | "one_time" | "subscription_only" | "both";
      price_amount: number | null; is_featured: boolean; instructor_id: string | null;
      status: string;
      profiles: { full_name: string | null; avatar_url: string | null; bio: string | null } | null;
    } | null; error: unknown;
  };

  if (!course) notFound();
  if (course.status !== "published" && course.instructor_id !== userId) notFound();

  const isDraftPreview = course.status !== "published";

  const { data: modulesRaw } = (await supabase
    .from("modules")
    .select("id, title, position, lessons(id, title, position, is_preview)")
    .eq("course_id", course.id)
    .order("position", { ascending: true })) as { data: ModuleRow[] | null; error: unknown };

  const modules: ModuleRow[] = (modulesRaw ?? []).map((m) => ({
    ...m,
    lessons: [...(m.lessons ?? [])].sort((a, b) => a.position - b.position),
  }));

  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const previewCount = modules.flatMap((m) => m.lessons).filter((l) => l.is_preview).length;

  let isEnrolled = false;
  let enrollmentStatus: string | null = null;
  if (userId) {
    const { data: enrollment } = await supabase
      .from("enrollments").select("id, status")
      .eq("user_id", userId).eq("course_id", course.id).maybeSingle();
    isEnrolled = Boolean(enrollment);
    enrollmentStatus = enrollment?.status ?? null;
  }

  // Fetch user info for manual enroll modal
  let userEmail = "";
  let userName = "";
  if (userId) {
    try {
      const clerkUser = await currentUser();
      userEmail = clerkUser?.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId
      )?.emailAddress ?? "";
      userName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ");
    } catch { /* non-critical */ }
  }

  // Reviews
  type ReviewWithProfile = Review & { profiles: { full_name: string | null; avatar_url: string | null } | null };
  const { data: reviewsRaw } = (await supabase
    .from("reviews")
    .select("*, profiles(full_name, avatar_url)")
    .eq("course_id", course.id)
    .order("created_at", { ascending: false })) as { data: ReviewWithProfile[] | null; error: unknown };
  const reviews = reviewsRaw ?? [];

  const meta = getCourseMeta(course.category);
  const isFree = course.price_type === "free";
  const priceLabel = formatPrice(course.price_type, course.price_amount);
  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : null;

  const EnrollButton = () => {
    if (isEnrolled && enrollmentStatus === "active") return (
      <Link
        href={`/courses/${course.slug}/learn`}
        className="thm-btn"
        style={{ display: "block", textAlign: "center", background: "#16a34a", borderColor: "#16a34a" }}
      >
        Continue Learning
        <i className="icon-right-arrow21"></i>
        <span className="hover-btn hover-bx"></span>
        <span className="hover-btn hover-bx2"></span>
        <span className="hover-btn hover-bx3"></span>
        <span className="hover-btn hover-bx4"></span>
      </Link>
    );
    if (isEnrolled && enrollmentStatus === "pending_payment") return (
      <div style={{ textAlign: "center" }}>
        <Link
          href={`/courses/${course.slug}/learn`}
          className="thm-btn"
          style={{ display: "block", background: "#f59e0b", borderColor: "#f59e0b", marginBottom: "8px" }}
        >
          Access First Module
          <i className="icon-right-arrow21"></i>
          <span className="hover-btn hover-bx"></span>
          <span className="hover-btn hover-bx2"></span>
          <span className="hover-btn hover-bx3"></span>
          <span className="hover-btn hover-bx4"></span>
        </Link>
        <p style={{ fontSize: "12px", color: "#92400e", background: "#fef3c7", padding: "6px 12px", borderRadius: "8px" }}>
          ⏳ Payment pending — full access unlocks once confirmed
        </p>
      </div>
    );
    if (isFree) return (
      <form action={enrollFree.bind(null, course.id, course.slug)}>
        <button type="submit" className="thm-btn" style={{ width: "100%", border: "none", cursor: "pointer", background: "#fd5523", borderColor: "#fd5523" }}>
          Start Learning Now
          <i className="icon-right-arrow21"></i>
          <span className="hover-btn hover-bx"></span>
          <span className="hover-btn hover-bx2"></span>
          <span className="hover-btn hover-bx3"></span>
          <span className="hover-btn hover-bx4"></span>
        </button>
      </form>
    );
    if (!userId) return (
      <Link
        href="/sign-in"
        className="thm-btn"
        style={{ display: "block", textAlign: "center" }}
      >
        Sign In to Enrol
        <i className="icon-right-arrow21"></i>
        <span className="hover-btn hover-bx"></span>
        <span className="hover-btn hover-bx2"></span>
        <span className="hover-btn hover-bx3"></span>
        <span className="hover-btn hover-bx4"></span>
      </Link>
    );
    return (
      <ManualEnrollModal
        courseId={course.id}
        courseSlug={course.slug}
        courseTitle={course.title}
        priceLabel={priceLabel}
        userEmail={userEmail}
        userName={userName}
        autoOpen={action === "enroll"}
      />
    );
  };

  return (
    <SiteLayout headerStyle={2} footerStyle={1}>
      <>
        {/* Draft preview banner */}
        {isDraftPreview && (
          <div style={{
            background: "#f59e0b", color: "#451a03", padding: "10px 20px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            fontSize: "14px", fontWeight: 500,
          }}>
            <span>Draft preview — only you can see this course.</span>
            <Link
              href={`/creator/courses/${course.id}`}
              style={{ background: "rgba(0,0,0,0.1)", padding: "4px 12px", borderRadius: "6px", color: "inherit" }}
            >
              Back to Studio
            </Link>
          </div>
        )}

        {/* ── Dark hero ────────────────────────────────────────────────── */}
        <section style={{ background: "#062e39", position: "relative", overflow: "hidden" }}>
          {course.thumbnail_url && (
            <div style={{ position: "absolute", inset: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={course.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.12 }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(6,46,57,0.96), rgba(6,46,57,0.72))" }} />
            </div>
          )}
          <div className="container" style={{ position: "relative", paddingTop: "60px", paddingBottom: "60px" }}>
            {/* Breadcrumb */}
            <nav style={{ marginBottom: "22px", fontSize: "14px", color: "rgba(255,255,255,0.55)" }}>
              <Link href="/courses" style={{ color: "rgba(255,255,255,0.55)" }}>Courses</Link>
              {course.category && (
                <>
                  <span style={{ margin: "0 8px" }}>›</span>
                  <Link
                    href={`/courses?category=${course.category.toLowerCase().replace(/ /g, "-")}`}
                    style={{ color: "rgba(255,255,255,0.55)" }}
                  >
                    {course.category}
                  </Link>
                </>
              )}
              <span style={{ margin: "0 8px", color: "rgba(255,255,255,0.35)" }}>›</span>
              <span style={{ color: "rgba(255,255,255,0.85)", maxWidth: "260px", display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}>
                {course.title}
              </span>
            </nav>

            {/* Badges */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "18px" }}>
              {course.category && (
                <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "13px", fontWeight: 500, background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.18)" }}>
                  {course.category}
                </span>
              )}
              {course.level && (
                <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "13px", fontWeight: 500, background: "rgba(253,85,35,0.2)", color: "#ffd4c7", border: "1px solid rgba(253,85,35,0.3)" }}>
                  {formatLevelLabel(course.level)}
                </span>
              )}
              {course.is_featured && (
                <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "13px", fontWeight: 500, background: "rgba(253,85,35,0.9)", color: "#fff" }}>
                  Featured
                </span>
              )}
            </div>

            <h1 style={{ color: "#fff", fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, lineHeight: 1.15, marginBottom: "16px", maxWidth: "700px" }}>
              {course.title}
            </h1>

            {course.description && (
              <p style={{ color: "rgba(255,255,255,0.72)", fontSize: "16px", lineHeight: 1.75, maxWidth: "640px", marginBottom: "28px" }}>
                {course.description}
              </p>
            )}

            {/* Meta chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", color: "rgba(255,255,255,0.7)", fontSize: "14px", marginBottom: "32px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Layers style={{ width: "16px", height: "16px", color: "#fd5523" }} />
                {modules.length || "–"} modules · {totalLessons || "–"} lessons
              </span>
              {avgRating !== null && (
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Award style={{ width: "16px", height: "16px", color: "#fd5523" }} />
                  ★ {avgRating.toFixed(1)} ({reviews.length} review{reviews.length !== 1 ? "s" : ""})
                </span>
              )}
              {previewCount > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Play style={{ width: "16px", height: "16px", color: "#fd5523" }} />
                  {previewCount} free preview{previewCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Mobile-only CTA */}
            <div className="block lg:hidden" style={{ maxWidth: "400px" }}>
              <EnrollButton />
              {!isFree && !isEnrolled && (
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", marginTop: "12px", textAlign: "center" }}>
                   Unlock lifetime access for {priceLabel}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── Two-column body ──────────────────────────────────────────── */}
        <section style={{ paddingTop: "70px", paddingBottom: "100px" }}>
          <div className="container">
            <div className="row">

              {/* Left: course content */}
              <div className="col-xl-8 col-lg-7">

                {/* Program Overview */}
                <div style={{ marginBottom: "55px" }}>
                  <h2 style={{ fontSize: "26px", fontWeight: 700, color: "#062e39", marginBottom: "18px" }}>Program Overview</h2>
                  <div style={{ color: "#666", lineHeight: 1.8, fontSize: "15px" }}>
                    {course.description && <p style={{ marginBottom: "14px" }}>{course.description}</p>}
                    <p>{meta.audience}</p>
                  </div>
                </div>

                {/* Key Topics */}
                <div style={{ marginBottom: "55px" }}>
                  <h2 style={{ fontSize: "26px", fontWeight: 700, color: "#062e39", marginBottom: "6px" }}>Key Topics</h2>
                  <p style={{ color: "#999", fontSize: "14px", marginBottom: "22px" }}>Skills and concepts covered in this program.</p>
                  <ul style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px", listStyle: "none", padding: 0 }}>
                    {meta.whatYoullLearn.map((item: string) => (
                      <li key={item} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                        <CheckCircle style={{ width: "18px", height: "18px", color: "#fd5523", flexShrink: 0, marginTop: "2px" }} />
                        <span style={{ fontSize: "14px", color: "#555", lineHeight: 1.6 }}>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Who Should Attend */}
                <div style={{ marginBottom: "55px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                    <Users style={{ width: "20px", height: "20px", color: "#fd5523" }} />
                    <h2 style={{ fontSize: "26px", fontWeight: 700, color: "#062e39", margin: 0 }}>Who Should Attend</h2>
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                    {meta.isFor.map((item: string) => (
                      <li key={item} style={{
                        display: "flex", alignItems: "flex-start", gap: "14px",
                        border: "1px solid #f0f0f0", borderRadius: "12px", padding: "14px 18px",
                        background: "#fffbf8",
                      }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#fd5523", flexShrink: 0, marginTop: "8px" }}></span>
                        <span style={{ fontSize: "14px", color: "#555", lineHeight: 1.7 }}>{item}</span>
                      </li>
                    ))}
                  </ul>
                  {meta.tools?.length > 0 && (
                    <div style={{ marginTop: "18px", border: "1px solid #f0f0f0", borderRadius: "12px", padding: "16px 20px", background: "#fff" }}>
                      <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#aaa", marginBottom: "12px" }}>
                        Tools covered
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {meta.tools.map((tool: string) => (
                          <span key={tool} style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "13px", background: "#f5f5f5", color: "#444", border: "1px solid #e8e8e8" }}>
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Curriculum */}
                <div style={{ marginBottom: "55px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <h2 style={{ fontSize: "26px", fontWeight: 700, color: "#062e39", margin: 0 }}>Curriculum</h2>
                    <span style={{ fontSize: "14px", color: "#999" }}>
                      {modules.length} module{modules.length !== 1 ? "s" : ""} · {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {modules.length === 0 ? (
                    <div style={{ border: "2px dashed #e5e5e5", borderRadius: "12px", padding: "40px 20px", textAlign: "center", color: "#aaa", fontSize: "14px" }}>
                      Curriculum is being finalized.
                    </div>
                  ) : (
                    <div style={{ borderRadius: "14px", border: "1px solid #e8e8e8", overflow: "hidden" }}>
                      {modules.map((module, index) => (
                        <div key={module.id} style={{ borderBottom: index < modules.length - 1 ? "1px solid #e8e8e8" : "none" }}>
                          <div style={{ padding: "16px 20px", background: "#f8f8f8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#aaa", marginBottom: "4px" }}>
                                Module {index + 1}
                              </p>
                              <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#062e39", margin: 0 }}>{module.title}</h3>
                            </div>
                            <span style={{ fontSize: "13px", color: "#999", marginLeft: "16px", flexShrink: 0 }}>
                              {module.lessons.length} lesson{module.lessons.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          {module.lessons.map((lesson) => {
                            const inner = (
                              <>
                                {lesson.is_preview ? (
                                  <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#fff2e9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <Play style={{ width: "13px", height: "13px", color: "#fd5523", marginLeft: "1px" }} />
                                  </div>
                                ) : (
                                  <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#f3f3f3", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <Lock style={{ width: "13px", height: "13px", color: "#bbb" }} />
                                  </div>
                                )}
                                <span style={{ fontSize: "14px", color: lesson.is_preview ? "#333" : "#555", flex: 1 }}>{lesson.title}</span>
                                {lesson.is_preview && (
                                  <span style={{ fontSize: "12px", color: "#fd5523", fontWeight: 600, background: "#fff2e9", padding: "2px 10px", borderRadius: "20px", flexShrink: 0, display: "flex", alignItems: "center", gap: "4px" }}>
                                    <Play style={{ width: "10px", height: "10px" }} />
                                    Preview
                                  </span>
                                )}
                              </>
                            );
                            return lesson.is_preview ? (
                              <Link
                                key={lesson.id}
                                href={`/courses/${course.slug}/learn?lesson=${lesson.id}`}
                                style={{
                                  padding: "12px 20px", background: "#fff", display: "flex", alignItems: "center", gap: "12px",
                                  borderTop: "1px solid #f5f5f5", textDecoration: "none",
                                  transition: "background 0.15s",
                                }}
                                className="hover:bg-[#fff8f5]"
                              >
                                {inner}
                              </Link>
                            ) : (
                              <div key={lesson.id} style={{
                                padding: "12px 20px", background: "#fff", display: "flex", alignItems: "center", gap: "12px",
                                borderTop: "1px solid #f5f5f5",
                              }}>
                                {inner}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reviews */}
                <CourseReviews
                  courseId={course.id}
                  courseSlug={course.slug}
                  reviews={reviews}
                  isEnrolled={isEnrolled}
                  userId={userId}
                />

                {/* Instructor */}
                {course.profiles?.full_name && (
                  <div>
                    <h2 style={{ fontSize: "26px", fontWeight: 700, color: "#062e39", marginBottom: "20px" }}>Teaching Team</h2>
                    <div style={{ display: "flex", gap: "20px", border: "1px solid #e8e8e8", borderRadius: "16px", padding: "24px", background: "#fff", alignItems: "flex-start" }}>
                      {course.profiles.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={course.profiles.avatar_url}
                          alt={course.profiles.full_name}
                          style={{ width: "64px", height: "64px", borderRadius: "50%", objectFit: "cover", border: "3px solid #f0f0f0", flexShrink: 0 }}
                        />
                      ) : (
                        <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#fff2e9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", fontWeight: 700, color: "#fd5523", flexShrink: 0 }}>
                          {course.profiles.full_name[0]}
                        </div>
                      )}
                      <div>
                        <p style={{ fontWeight: 700, color: "#062e39", fontSize: "16px", marginBottom: "4px" }}>{course.profiles.full_name}</p>
                        <p style={{ color: "#fd5523", fontSize: "13px", marginBottom: "10px" }}>AI Educator</p>
                        <p style={{ fontSize: "14px", color: "#666", lineHeight: 1.75 }}>
                          {course.profiles.bio ?? "Practical AI educator focused on real-world application for professionals."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: sticky enrollment card */}
              <div className="col-xl-4 col-lg-5" style={{ marginTop: "0" }}>
                <div style={{ position: "sticky", top: "100px" }}>
                  <div style={{ border: "1px solid #e8e8e8", borderRadius: "16px", overflow: "hidden", boxShadow: "0 20px 60px rgba(6,46,57,0.1)" }}>
                    {/* Thumbnail */}
                    {course.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={course.thumbnail_url}
                        alt={course.title}
                        style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ aspectRatio: "16/9", background: "linear-gradient(135deg, #062e39, #0d4f63)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <BookOpen style={{ width: "40px", height: "40px", color: "rgba(253,85,35,0.5)" }} />
                      </div>
                    )}

                    <div style={{ padding: "28px" }}>
                      {/* Price */}
                      <div style={{ marginBottom: "20px" }}>
                        <p style={{ fontSize: "32px", fontWeight: 800, color: "#062e39", margin: 0 }}>{priceLabel}</p>
                        {!isFree && (
                          <p style={{ fontSize: "13px", color: "#999", marginTop: "4px" }}>One-time payment · lifetime access</p>
                        )}
                      </div>

                      {/* CTA */}
                      <div style={{ marginBottom: "22px" }}>
                        <EnrollButton />
                      </div>

                      {/* Quick meta */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", borderTop: "1px solid #f0f0f0", paddingTop: "20px", marginBottom: "20px" }}>
                        {[
                          { label: "Format", value: "Self-paced" },
                          { label: "Level", value: formatLevelLabel(course.level) },
                          { label: "Modules", value: String(modules.length || "–") },
                          { label: "Lessons", value: String(totalLessons || "–") },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <p style={{ fontSize: "11px", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "3px" }}>{label}</p>
                            <p style={{ fontSize: "14px", fontWeight: 600, color: "#062e39", margin: 0 }}>{value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Includes */}
                      <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: "20px" }}>
                        <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#aaa", marginBottom: "14px" }}>
                          This course includes
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {[
                            { icon: BookOpen, text: `${totalLessons || "–"} on-demand lessons` },
                            { icon: MessageSquare, text: "AI tutor in every lesson" },
                            { icon: Award, text: "Certificate of completion" },
                            { icon: Zap, text: "Hands-on win in lesson one" },
                            { icon: Users, text: "Role-focused exercises" },
                            ...(previewCount > 0 ? [{ icon: Play, text: `${previewCount} free preview${previewCount !== 1 ? "s" : ""}` }] : []),
                          ].map(({ icon: Icon, text }) => (
                            <div key={text} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#555" }}>
                              <Icon style={{ width: "16px", height: "16px", color: "#fd5523", flexShrink: 0 }} />
                              {text}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── Bottom CTA ────────────────────────────────────────────────── */}
        <section style={{ background: "#062e39", paddingTop: "80px", paddingBottom: "80px" }}>
          <div className="container" style={{ textAlign: "center" }}>
            <h2 style={{ color: "#fff", fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 700, marginBottom: "14px" }}>
              {course.title}
            </h2>
            <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: "36px", fontSize: "16px" }}>
              {isFree ? "Free to enroll. Start your first lesson today." : `Get full access for ${priceLabel}.`}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "14px" }}>
              {isEnrolled ? (
                <Link className="thm-btn" href={`/courses/${course.slug}/learn`} style={{ background: "#16a34a", borderColor: "#16a34a" }}>
                  Continue Learning
                  <i className="icon-right-arrow21"></i>
                  <span className="hover-btn hover-bx"></span>
                  <span className="hover-btn hover-bx2"></span>
                  <span className="hover-btn hover-bx3"></span>
                  <span className="hover-btn hover-bx4"></span>
                </Link>
              ) : isFree ? (
                <form action={enrollFree.bind(null, course.id, course.slug)}>
                  <button type="submit" className="thm-btn" style={{ border: "none", cursor: "pointer" }}>
                    Enroll for Free
                    <i className="icon-right-arrow21"></i>
                    <span className="hover-btn hover-bx"></span>
                    <span className="hover-btn hover-bx2"></span>
                    <span className="hover-btn hover-bx3"></span>
                    <span className="hover-btn hover-bx4"></span>
                  </button>
                </form>
              ) : (
                <Link className="thm-btn" href={`/courses/${course.slug}/checkout`}>
                  Unlock Full Course — {priceLabel}
                  <i className="icon-right-arrow21"></i>
                  <span className="hover-btn hover-bx"></span>
                  <span className="hover-btn hover-bx2"></span>
                  <span className="hover-btn hover-bx3"></span>
                  <span className="hover-btn hover-bx4"></span>
                </Link>
              )}
              <Link
                href="/courses"
                style={{
                  display: "inline-flex", alignItems: "center", gap: "8px",
                  padding: "16px 32px", borderRadius: "30px",
                  border: "2px solid rgba(255,255,255,0.25)", color: "#fff",
                  fontSize: "15px", fontWeight: 600, textDecoration: "none",
                  transition: "all 0.2s",
                }}
              >
                Browse all courses
              </Link>
              <WhatsAppShare
                url={`${process.env.NEXT_PUBLIC_APP_URL ?? "https://zedai.academy"}/courses/${course.slug}`}
                message={`Check out this course: "${course.title}" on Zed AI Academy 🚀`}
                label="Share on WhatsApp"
              />
            </div>
          </div>
        </section>
      </>
    </SiteLayout>
  );
}
