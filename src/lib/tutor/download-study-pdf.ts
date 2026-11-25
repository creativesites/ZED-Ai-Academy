// Browser-only: builds the study-notes PDF (pdf-lib is loaded on demand) and downloads it.

import type { StudyExportInput } from "./study-export.ts";

let logoCache: Promise<Uint8Array | null> | null = null;

function loadLogo(): Promise<Uint8Array | null> {
  if (!logoCache) {
    logoCache = fetch("/brand/cs-learn-logo-on-dark.png") // CS Learn lockup for the navy PDF header
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((b) => (b ? new Uint8Array(b) : null))
      .catch(() => null);
  }
  return logoCache;
}

let unicodeFontCache: Promise<{ regular: Uint8Array; bold: Uint8Array } | null> | null = null;

/** Noto Sans SC (GB2312 + Latin + pinyin), fetched only for sessions that need it. */
function loadUnicodeFonts() {
  if (!unicodeFontCache) {
    const get = (name: string) =>
      fetch(`/fonts/pdf/${name}`).then((r) => {
        if (!r.ok) throw new Error(`font ${name}: ${r.status}`);
        return r.arrayBuffer();
      });
    unicodeFontCache = Promise.all([get("NotoSansSC-Regular.ttf"), get("NotoSansSC-Bold.ttf")])
      .then(([regular, bold]) => ({ regular: new Uint8Array(regular), bold: new Uint8Array(bold) }))
      .catch((err) => {
        console.warn("[study-notes] Unicode font unavailable, using built-in font", err);
        unicodeFontCache = null;
        return null;
      });
  }
  return unicodeFontCache;
}

export async function downloadStudyNotesPdf(input: StudyExportInput): Promise<void> {
  const [mod, logoPng] = await Promise.all([import("./study-pdf.ts"), loadLogo()]);
  const { buildStudyNotesPdf, pdfFilename, needsUnicodeFont, collectStudyText } = mod;
  const unicodeFonts = needsUnicodeFont(collectStudyText(input)) ? await loadUnicodeFonts() : null;
  const bytes = await buildStudyNotesPdf(
    { ...input, dateIso: input.dateIso ?? new Date().toISOString() },
    { logoPng, unicodeFonts },
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
