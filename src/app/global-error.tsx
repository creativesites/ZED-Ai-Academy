"use client";

import { useEffect } from "react";

/**
 * Last-resort error page: replaces the root layout when it crashes (e.g. auth provider or
 * metadata failure), so it must render its own <html> and <body> and avoid app dependencies.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#050D20",
          color: "#FFFFFF",
          fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: 24,
        }}
      >
        <main style={{ maxWidth: 440, textAlign: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/cs-learn-emblem-on-dark.png" alt="CS Learn" width={72} height={63} style={{ margin: "0 auto 20px" }} />
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ color: "#94A3B8", lineHeight: 1.6, margin: "0 0 24px" }}>
            We hit an unexpected problem loading CS Learn. Please try again in a moment.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              onClick={() => reset()}
              style={{ background: "#075BEB", color: "#fff", border: 0, borderRadius: 12, padding: "12px 20px", fontWeight: 600, cursor: "pointer" }}
            >
              Try again
            </button>
            {/* Full page load on purpose: the root layout itself failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 12, padding: "12px 20px", fontWeight: 600, textDecoration: "none" }}>
              Go home
            </a>
          </div>
          {error.digest && (
            <p style={{ marginTop: 24, fontSize: 12, color: "#64748B" }}>Reference: {error.digest}</p>
          )}
        </main>
      </body>
    </html>
  );
}
