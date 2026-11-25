import type { MetadataRoute } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { BRAND } from "@/lib/brand";

export const revalidate = 3600;

function getBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : BRAND.url);
  return raw.replace(/\/+$/, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/courses`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/launch-your-academy`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/ai-tutor`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  try {
    const supabase = createServiceClient();

    const [{ data: companies }, { data: courses }, { data: blogPosts }] = await Promise.all([
      supabase
        .from("companies")
        .select("slug, updated_at, created_at")
        .eq("status", "active")
        .limit(500),
      supabase
        .from("courses")
        .select("slug, updated_at, created_at, company_id, companies(slug)")
        .eq("status", "published")
        .limit(1000),
      supabase
        .from("blog_posts")
        .select("slug, updated_at, published_at")
        .eq("status", "published")
        .limit(500),
    ]);

    const academyRoutes: MetadataRoute.Sitemap = (companies ?? [])
      .filter((c: any) => Boolean(c.slug))
      .map((c: any) => ({
        url: `${baseUrl}/academy/${c.slug}`,
        lastModified: new Date(c.updated_at || c.created_at || now),
        changeFrequency: "weekly",
        priority: 0.8,
      }));

    const courseRoutes: MetadataRoute.Sitemap = (courses ?? [])
      .filter((c: any) => Boolean(c.slug))
      .map((c: any) => {
        const companySlug = Array.isArray(c.companies)
          ? c.companies[0]?.slug
          : c.companies?.slug;
        const url = companySlug
          ? `${baseUrl}/academy/${companySlug}/courses/${c.slug}`
          : `${baseUrl}/courses/${c.slug}`;
        return {
          url,
          lastModified: new Date(c.updated_at || c.created_at || now),
          changeFrequency: "weekly",
          priority: 0.7,
        };
      });

    const blogRoutes: MetadataRoute.Sitemap = (blogPosts ?? [])
      .filter((b: any) => Boolean(b.slug))
      .map((b: any) => ({
        url: `${baseUrl}/blog/${b.slug}`,
        lastModified: new Date(b.updated_at || b.published_at || now),
        changeFrequency: "monthly",
        priority: 0.6,
      }));

    return [...staticRoutes, ...academyRoutes, ...courseRoutes, ...blogRoutes];
  } catch (err) {
    console.error("Failed to build dynamic sitemap entries:", err);
    return staticRoutes;
  }
}
