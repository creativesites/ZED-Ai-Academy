"use client";

import { useEffect } from "react";

export function EnrollActionFocus({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    const el = document.getElementById("enroll-cta");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
  }, [active]);

  return null;
}
