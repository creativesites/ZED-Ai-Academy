"use client";

import { useState, useTransition } from "react";
import { submitReview } from "@/actions/reviews";
import { Star, Loader2, MessageSquare, CheckCircle } from "lucide-react";
import type { Review } from "@/types/database";

type ReviewWithProfile = Review & { profiles: { full_name: string | null; avatar_url: string | null } | null };

function StarRow({ value, onChange, readonly }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type={readonly ? "button" : "button"}
          disabled={readonly}
          onClick={() => !readonly && onChange?.(i)}
          onMouseEnter={() => !readonly && setHovered(i)}
          onMouseLeave={() => !readonly && setHovered(0)}
          className={`transition-transform ${!readonly ? "hover:scale-110 cursor-pointer" : "cursor-default"}`}
        >
          <Star
            className="h-5 w-5"
            fill={(hovered || value) >= i ? "#fd5523" : "none"}
            stroke={(hovered || value) >= i ? "#fd5523" : "#d1d5db"}
          />
        </button>
      ))}
    </div>
  );
}

function avgRating(reviews: Review[]): number {
  if (reviews.length === 0) return 0;
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
}

export function CourseReviews({
  courseId,
  courseSlug,
  reviews,
  isEnrolled,
  userId,
}: {
  courseId: string;
  courseSlug: string;
  reviews: ReviewWithProfile[];
  isEnrolled: boolean;
  userId: string | null;
}) {
  const [rating, setRating] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const existingReview = reviews.find((r) => r.user_id === userId);
  const avg = avgRating(reviews);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("rating", String(rating));
    startTransition(async () => {
      try {
        await submitReview(courseId, courseSlug, formData);
        setSuccess(true);
        setRating(0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not submit review.");
      }
    });
  }

  return (
    <div style={{ marginBottom: "55px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <MessageSquare style={{ width: "22px", height: "22px", color: "#fd5523" }} />
        <h2 style={{ fontSize: "26px", fontWeight: 700, color: "#062e39", margin: 0 }}>
          Student Reviews
        </h2>
        {reviews.length > 0 && (
          <span style={{ fontSize: "14px", color: "#999", marginLeft: "4px" }}>
            ({reviews.length} review{reviews.length !== 1 ? "s" : ""})
          </span>
        )}
      </div>

      {/* Avg rating strip */}
      {reviews.length > 0 && (
        <div style={{ display: "flex", gap: "24px", marginBottom: "32px", padding: "24px", borderRadius: "16px", background: "#fff", border: "1px solid #f0f0f0", flexWrap: "wrap", alignItems: "center" }}>
          {/* Left: Score */}
          <div style={{ flexShrink: 0, textAlign: "center", minWidth: "140px" }}>
            <p style={{ fontSize: "56px", fontWeight: 800, color: "#062e39", lineHeight: 1, marginBottom: "8px" }}>
              {avg.toFixed(1)}
            </p>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
              <StarRow value={Math.round(avg)} readonly />
            </div>
            <p style={{ fontSize: "13px", color: "#999", margin: 0, fontWeight: 500 }}>
              Course Rating
            </p>
          </div>
          
          {/* Right: Distribution */}
          <div style={{ flex: 1, minWidth: "200px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {[5, 4, 3, 2, 1].map(star => {
              const count = reviews.filter(r => r.rating === star).length;
              const percent = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
              return (
                <div key={star} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", width: "32px", flexShrink: 0 }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#555" }}>{star}</span>
                    <Star style={{ width: "12px", height: "12px", color: "#fd5523", fill: "#fd5523" }} />
                  </div>
                  <div style={{ flex: 1, height: "8px", background: "#f0f0f0", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ width: `${percent}%`, height: "100%", background: "#fd5523", borderRadius: "4px" }} />
                  </div>
                  <span style={{ fontSize: "12px", color: "#999", width: "24px", textAlign: "right", flexShrink: 0 }}>
                    {Math.round(percent)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Review list */}
      {reviews.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "32px" }}>
          {reviews.map((rev) => (
            <div key={rev.id} style={{ padding: "20px", borderRadius: "14px", border: "1px solid #f0f0f0", background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: "#fff2e9", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fd5523", fontSize: "15px", flexShrink: 0 }}>
                  {rev.profiles?.avatar_url
                    ? <img src={rev.profiles.avatar_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                    : (rev.profiles?.full_name?.[0] ?? "?")}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                    <p style={{ fontWeight: 700, color: "#062e39", fontSize: "14px", margin: 0 }}>
                      {rev.profiles?.full_name ?? "Anonymous"}
                    </p>
                    <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "2px 6px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "3px" }}>
                      <CheckCircle style={{ width: "10px", height: "10px" }} />
                      Verified
                    </span>
                  </div>
                  <StarRow value={rev.rating} readonly />
                </div>
                <p style={{ marginLeft: "auto", fontSize: "12px", color: "#bbb" }}>
                  {new Date(rev.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              {rev.comment && (
                <p style={{ fontSize: "14px", color: "#555", lineHeight: 1.75, margin: 0 }}>{rev.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Write a review */}
      {isEnrolled && !existingReview && !success && (
        <div style={{ padding: "24px", borderRadius: "16px", border: "1px solid #e8e8e8", background: "#fffbf8" }}>
          <p style={{ fontSize: "15px", fontWeight: 700, color: "#062e39", marginBottom: "16px" }}>
            Share your experience
          </p>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <p style={{ fontSize: "12px", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
                Your rating
              </p>
              <StarRow value={rating} onChange={setRating} />
            </div>
            <textarea
              name="comment"
              placeholder="What did you learn? What stood out? (optional)"
              rows={3}
              style={{ width: "100%", borderRadius: "10px", border: "1px solid #e5e5e5", padding: "12px 14px", fontSize: "14px", color: "#333", resize: "vertical", fontFamily: "inherit", outline: "none" }}
            />
            {error && <p style={{ fontSize: "13px", color: "#ef4444" }}>{error}</p>}
            <button
              type="submit"
              disabled={pending || rating === 0}
              style={{
                alignSelf: "flex-start", padding: "10px 28px", borderRadius: "30px",
                background: rating === 0 ? "#e5e5e5" : "#fd5523", color: "#fff",
                fontWeight: 700, fontSize: "14px", border: "none",
                cursor: rating === 0 ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: "8px",
              }}
            >
              {pending && <Loader2 style={{ width: "14px", height: "14px" }} className="animate-spin" />}
              Submit Review
            </button>
          </form>
        </div>
      )}

      {success && (
        <div style={{ padding: "18px 22px", borderRadius: "12px", background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", fontWeight: 600, fontSize: "14px" }}>
          Thanks for your review! It will appear above shortly.
        </div>
      )}

      {isEnrolled && existingReview && (
        <div style={{ fontSize: "13px", color: "#aaa", padding: "12px 0" }}>
          You have already reviewed this course. ★ {existingReview.rating}/5
        </div>
      )}

      {!isEnrolled && (
        <p style={{ fontSize: "13px", color: "#aaa" }}>Enroll in this course to leave a review.</p>
      )}
    </div>
  );
}
