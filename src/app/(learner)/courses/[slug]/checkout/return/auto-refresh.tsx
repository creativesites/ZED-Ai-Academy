"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-runs the server check every 5 seconds while a payment is pending. */
export function AutoRefresh({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.replace(href), 5000);
    return () => clearTimeout(t);
  }, [href, router]);
  return null;
}
