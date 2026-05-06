"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * HeroEnrollButton — Smart enrollment CTA for breadcrumb hero course cards.
 *
 * Flow:
 * - Logged in + free course → server action enrollFree → redirect to learn page
 * - Logged in + paid course → navigate to course detail page
 * - Not logged in → redirect to /sign-up?enroll_course=<slug>
 */
export function HeroEnrollButton({
  courseId,
  courseSlug,
  priceType,
  priceAmount,
  compact = false,
}) {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [enrolling, setEnrolling] = useState(false);

  const isFree = priceType === "free";
  const label = isFree ? "Enroll Free" : priceAmount ? `ZMW ${Math.round(priceAmount)}` : "View Course";

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isSignedIn) {
      // Redirect to sign-up with course slug for post-signup auto-enrollment
      router.push(`/sign-up?enroll_course=${courseSlug}`);
      return;
    }

    if (isFree) {
      // Enroll immediately via server action
      setEnrolling(true);
      try {
        const res = await fetch("/api/hero-enroll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId, courseSlug }),
        });
        const data = await res.json();
        if (data.redirect) {
          router.push(data.redirect);
        } else {
          router.push(`/courses/${courseSlug}`);
        }
      } catch {
        router.push(`/courses/${courseSlug}`);
      }
      return;
    }

    // Paid course — go to course detail page and open enrollment modal
    router.push(`/courses/${courseSlug}?action=enroll`);
  };

  return (
    <button
      onClick={handleClick}
      disabled={enrolling}
      className="hero-enroll-btn"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        padding: compact ? "8px 16px" : "10px 20px",
        borderRadius: "100px",
        border: "none",
        background: isFree ? "#16a34a" : "#fd5523",
        color: "#fff",
        fontSize: compact ? "12px" : "13px",
        fontWeight: 700,
        cursor: enrolling ? "wait" : "pointer",
        transition: "all 0.2s ease",
        opacity: enrolling ? 0.7 : 1,
        whiteSpace: "nowrap",
        boxShadow: isFree
          ? "0 4px 14px rgba(22,163,74,0.3)"
          : "0 4px 14px rgba(253,85,35,0.3)",
      }}
    >
      {enrolling ? (
        <>
          <span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite", display: "inline-block" }} />
          Enrolling...
        </>
      ) : (
        <>
          {isFree ? "Enroll Free →" : label + " →"}
        </>
      )}
    </button>
  );
}
