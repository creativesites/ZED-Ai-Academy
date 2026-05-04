import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Award, CheckCircle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

type PageProps = { params: Promise<{ publicId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { publicId } = await params;
  const supabase = createClient();
  const { data } = await supabase
    .from("certificates")
    .select("courses(title), profiles(full_name)")
    .eq("public_id", publicId)
    .single() as {
      data: {
        courses: { title: string } | null;
        profiles: { full_name: string | null } | null;
      } | null;
      error: unknown;
    };

  if (!data) return { title: "Certificate Not Found" };

  return {
    title: `Certificate — ${data.courses?.title ?? "Course"}`,
    description: `Certificate of completion issued to ${data.profiles?.full_name ?? "a learner"} for ${data.courses?.title ?? "a course"} on Zed AI Academy.`,
  };
}

export default async function CertificateVerificationPage({ params }: PageProps) {
  const { publicId } = await params;
  const supabase = createClient();

  const { data } = await supabase
    .from("certificates")
    .select("id, issued_at, public_id, file_url, courses(id, title, slug), profiles(full_name, avatar_url)")
    .eq("public_id", publicId)
    .single() as {
      data: {
        id: string;
        issued_at: string;
        public_id: string;
        file_url: string | null;
        courses: { id: string; title: string; slug: string } | null;
        profiles: { full_name: string | null; avatar_url: string | null } | null;
      } | null;
      error: unknown;
    };

  if (!data) notFound();

  const issuedDate = new Date(data.issued_at).toLocaleDateString("en-ZM", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fffaf6] to-white px-4 py-16">
      <div className="mx-auto w-full max-w-2xl">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(6,46,57,0.1)]">
          <div className="border-b border-slate-200 bg-gradient-to-r from-[#fff2e9] to-white px-8 py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#fd5523]/20 bg-[#fff6ee]">
              <Award className="h-8 w-8 text-[#fd5523]" />
            </div>
            <p className="mb-1 text-xs font-medium uppercase tracking-widest text-slate-500">Certificate of Completion</p>
            <h1 className="mt-2 text-2xl font-bold text-[#062e39]">{data.courses?.title ?? "Course"}</h1>
          </div>

          <div className="space-y-1 px-8 py-6 text-center">
            <p className="text-sm text-slate-500">This is to certify that</p>
            <p className="text-2xl font-semibold text-[#062e39]">{data.profiles?.full_name ?? "Learner"}</p>
            <p className="text-sm text-slate-500">has successfully completed this course on</p>
            <p className="font-medium text-slate-800">{issuedDate}</p>
          </div>

          <div className="mx-8 mb-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-700">Verified Certificate</p>
                <p className="mt-0.5 font-mono text-xs text-slate-500">ID: {data.public_id}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 px-8 py-4">
            <Link href="/" className="flex items-center gap-1 text-sm text-[#fd5523] hover:text-[#ef4a16]">
              Zed AI Academy
            </Link>
            <div className="flex items-center gap-3">
              {data.file_url && (
                <a href={data.file_url} download className="text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900">
                  Download PDF
                </a>
              )}
              {data.courses?.slug && (
                <Button className="h-8 bg-[#062e39] text-xs text-white hover:bg-[#0a3d4b]" render={<Link href={`/courses/${data.courses.slug}`} />}>
                  <ExternalLink className="mr-1 h-3 w-3" />
                  View Course
                </Button>
              )}
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          This certificate can be independently verified at{" "}
          <span className="text-slate-600">zedaiacademy.com/certificates/{data.public_id}</span>
        </p>
      </div>
    </div>
  );
}
