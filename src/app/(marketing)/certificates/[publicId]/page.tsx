import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CertificateViewer } from "@/components/certificates/certificate-viewer";

type PageProps = { params: Promise<{ publicId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { publicId } = await params;
  const supabase = createClient();
  const { data } = (await supabase
    .from("certificates")
    .select("courses(title), profiles(full_name)")
    .eq("public_id", publicId)
    .maybeSingle()) as {
    data: {
      courses: { title: string } | null;
      profiles: { full_name: string | null } | null;
    } | null;
  };

  if (!data) return { title: "Certificate Not Found — Zed AI Academy" };

  return {
    title: `Verified Certificate — ${data.courses?.title ?? "Course"} | Zed AI Academy`,
    description: `Official certificate of completion issued to ${data.profiles?.full_name ?? "a learner"} for ${data.courses?.title ?? "a course"} on Zed AI Academy.`,
  };
}

export default async function CertificateVerificationPage({ params }: PageProps) {
  const { publicId } = await params;
  const supabase = createClient();

  const { data } = (await supabase
    .from("certificates")
    .select(
      "id, issued_at, public_id, file_url, courses(id, title, slug, category, company_id), profiles(full_name, avatar_url)"
    )
    .eq("public_id", publicId)
    .maybeSingle()) as {
    data: {
      id: string;
      issued_at: string;
      public_id: string;
      file_url: string | null;
      courses: {
        id: string;
        title: string;
        slug: string;
        category?: string | null;
        company_id?: string | null;
      } | null;
      profiles: { full_name: string | null; avatar_url: string | null } | null;
    } | null;
  };

  if (!data) notFound();

  let companyName: string | null = null;
  if (data.courses?.company_id) {
    const { data: comp } = await supabase
      .from("companies")
      .select("name")
      .eq("id", data.courses.company_id)
      .maybeSingle();
    companyName = comp?.name ?? null;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://academy.zedai.org";
  const verificationUrl = `${appUrl}/certificates/${data.public_id}`;

  const certData = {
    id: data.id,
    public_id: data.public_id,
    issued_at: data.issued_at,
    file_url: data.file_url,
    courses: data.courses
      ? {
          id: data.courses.id,
          title: data.courses.title,
          slug: data.courses.slug,
          category: data.courses.category,
          company_name: companyName,
        }
      : null,
    profiles: data.profiles,
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#fbf8f5] via-slate-50 to-[#f4f0eb] px-4 py-8 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <CertificateViewer certificate={certData} verificationUrl={verificationUrl} />
      </div>
    </main>
  );
}
