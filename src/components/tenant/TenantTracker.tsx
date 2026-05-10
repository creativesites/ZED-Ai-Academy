"use client";

import { useEffect } from "react";

export function TenantTracker({ domain }: { domain: string }) {
  useEffect(() => {
    // Set cookie on client side to avoid Next.js server component restriction
    // Max age 7 days
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `last_visited_tenant=${domain}; path=/; expires=${expires}; SameSite=Lax`;
  }, [domain]);

  return null;
}
