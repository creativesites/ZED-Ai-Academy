// Browser-only: builds the study-notes PDF (pdf-lib is loaded on demand) and downloads it.

import type { StudyExportInput } from "./study-export.ts";

let logoCache: Promise<Uint8Array | null> | null = null;

function loadLogo(): Promise<Uint8Array | null> {
  if (!logoCache) {
    logoCache = fetch("/images/zed-ai-logo.png")
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((b) => (b ? new Uint8Array(b) : null))
      .catch(() => null);
  }
  return logoCache;
}

export async function downloadStudyNotesPdf(input: StudyExportInput): Promise<void> {
  const [{ buildStudyNotesPdf, pdfFilename }, logoPng] = await Promise.all([
    import("./study-pdf.ts"),
    loadLogo(),
  ]);
  const bytes = await buildStudyNotesPdf(
    { ...input, dateIso: input.dateIso ?? new Date().toISOString() },
    { logoPng },
  );
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = pdfFilename(input.title);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
