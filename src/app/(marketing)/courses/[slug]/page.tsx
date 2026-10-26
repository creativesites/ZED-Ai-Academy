import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function LegacyCourseDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = createClient();

  // Find the tenant the course belongs to
  const { data: course } = await supabase
    .from("courses")
    .select("company_id, companies(slug)")
    .eq("slug", slug)
    .single();

  if (!course) {
    notFound();
  }

  const comp = Array.isArray((course as any).companies)
    ? (course as any).companies[0]
    : (course as any).companies;

  const tenantSlug = comp?.slug || "zedai";

  // Redirect to the tenant-native course page
  redirect(`/academy/${tenantSlug}/courses/${slug}`);
}
