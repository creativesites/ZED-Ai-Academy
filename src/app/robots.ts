import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

function getBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : BRAND.url);
  return raw.replace(/\/+$/, "");
}

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/courses", "/blog", "/about", "/pricing", "/contact", "/launch-your-academy", "/academy/"],
        disallow: [
          // No trailing slashes: "/dashboard/" would not match "/dashboard" itself.
          "/api",
          "/admin",
          "/superadmin",
          "/creator",
          "/dashboard",
          "/onboarding",
          "/after-sign-in",
          "/company",
          "/practice",
          "/live-sessions",
          "/test",
          "/sign-in",
          "/sign-up",
          "/login",
          "/register",
          "/courses/*/learn",
          "/courses/*/checkout",
          "/academy/*/admin",
          "/academy/*/classroom",
          "/academy/*/dashboard",
          "/academy/*/join",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
