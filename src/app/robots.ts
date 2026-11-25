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
          "/api/",
          "/admin/",
          "/superadmin/",
          "/creator/",
          "/dashboard/",
          "/onboarding/",
          "/company/",
          "/test/",
          "/sign-in/",
          "/sign-up/",
          "/academy/*/admin/",
          "/academy/*/classroom/",
          "/academy/*/dashboard/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
