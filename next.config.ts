import type { NextConfig } from "next";

/**
 * Baseline security headers for every response.
 * - Framing is limited to our own origin (the Zoom bridge iframe is same-origin).
 * - Camera/microphone are NOT restricted here: live classes (Jitsi, Zoom) and the voice
 *   tutor need them, including inside their embedded iframes.
 * - No COOP/COEP: cross-origin isolation would break YouTube, Clerk and Jitsi embeds.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(), browsing-topics=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Vercel functions reject request bodies over 4.5 MB before Next.js sees them.
      bodySizeLimit: "4mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
