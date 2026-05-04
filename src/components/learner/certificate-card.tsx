import Link from "next/link";
import { Award, ExternalLink, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type CertificateCardProps = {
  certificate: {
    id: string;
    public_id: string;
    issued_at: string;
    file_url: string | null;
  };
  courseTitle: string;
  userName?: string;
};

export function CertificateCard({
  certificate,
  courseTitle,
  userName,
}: CertificateCardProps) {
  return (
    <Card className="overflow-hidden border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-slate-50 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50">
            <Award className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Certificate of Completion</p>
            <h3 className="mt-0.5 font-semibold leading-snug text-slate-900">{courseTitle}</h3>
          </div>
        </div>
        {userName && (
          <p className="mt-3 text-sm text-slate-600">
            Awarded to <span className="font-medium text-slate-900">{userName}</span>
          </p>
        )}
      </div>

      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Issued</p>
            <p className="text-sm text-slate-700">
              {new Date(certificate.issued_at).toLocaleDateString("en-ZM", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-7 border-slate-300 bg-transparent text-xs text-slate-700 hover:bg-slate-100"
              render={
                <Link
                  href={`/certificates/${certificate.public_id}`}
                  target="_blank"
                />
              }
            >
              <ExternalLink className="mr-1 h-3 w-3" />
              View
            </Button>
            {certificate.file_url && (
              <Button
                className="h-7 bg-blue-600 text-xs text-white hover:bg-blue-500"
                render={
                  <a href={certificate.file_url} target="_blank" rel="noreferrer" download />
                }
              >
                <Download className="mr-1 h-3 w-3" />
                Download
              </Button>
            )}
          </div>
        </div>

        <p className="mt-3 font-mono text-xs text-slate-500">ID: {certificate.public_id}</p>
      </CardContent>
    </Card>
  );
}
