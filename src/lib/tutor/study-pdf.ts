// Renders AI Teacher study notes as a designed, print-ready A4 PDF (client or server).
// Uses pdf-lib's built-in Helvetica, so text is sanitised to the WinAnsi character set.

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import type { StudyExportInput } from "./study-export.ts";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_H = 40;

const hex = (h: string): RGB => {
  const n = parseInt(h.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

const C = {
  teal: hex("#062e39"),
  tealSoft: hex("#e7f0f1"),
  orange: hex("#fd5523"),
  orangeSoft: hex("#fff1ec"),
  ink: hex("#1d2b30"),
  muted: hex("#5d6b70"),
  faint: hex("#9aa6aa"),
  line: hex("#dfe5e6"),
  track: hex("#eef1f2"),
  green: hex("#16a34a"),
  greenSoft: hex("#ecfdf3"),
  roseSoft: hex("#fff5f5"),
  rose: hex("#e11d48"),
  white: rgb(1, 1, 1),
  headerSub: hex("#b8cdd1"),
};

const CHAR_MAP: Record<string, string> = {
  "→": "->", "←": "<-", "⇒": "=>", "≈": "~", "≤": "<=", "≥": ">=", "≠": "!=",
  "✓": "", "✔": "", "✗": "x", "✘": "x", "★": "*", "☆": "*", " ": " ",
  " ": " ", "​": "", "\t": "  ", "−": "-", "×": "x",
};

/** Keep only characters Helvetica (WinAnsi) can draw; strip light Markdown. */
export function sanitizePdfText(input: string, supported: Set<number>): string {
  const cleaned = input
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\r/g, "");
  let out = "";
  for (const ch of cleaned) {
    if (ch === "\n") { out += ch; continue; }
    if (supported.has(ch.codePointAt(0)!)) { out += ch; continue; }
    if (ch in CHAR_MAP) { out += CHAR_MAP[ch]; continue; }
    const base = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
    if (base && [...base].every((b) => supported.has(b.codePointAt(0)!))) out += base;
  }
  return out.replace(/[ ]{2,}/g, " ");
}

/** Greedy word wrap; breaks words longer than the line. */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) { lines.push(""); continue; }
    let line = "";
    for (let word of words) {
      while (font.widthOfTextAtSize(word, size) > maxWidth) {
        let cut = word.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(word.slice(0, cut), size) > maxWidth) cut--;
        if (line) { lines.push(line); line = ""; }
        lines.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function formatDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

const titleCase = (k: string) =>
  k.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export type StudyPdfOptions = {
  /** PNG bytes of the brand logo, drawn in the header if given. */
  logoPng?: Uint8Array | ArrayBuffer | null;
  brandName?: string;
};

export async function buildStudyNotesPdf(
  input: StudyExportInput,
  options: StudyPdfOptions = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const brand = options.brandName ?? "Zed AI Academy";
  doc.setTitle(input.title);
  doc.setAuthor(brand);
  doc.setSubject("AI Teacher study notes");
  doc.setCreator(brand);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const supported = new Set(regular.getCharacterSet());
  const t = (s: string | undefined | null) => sanitizePdfText(s ?? "", supported).trim();

  let logo: PDFImage | null = null;
  if (options.logoPng) {
    try { logo = await doc.embedPng(options.logoPng); } catch { logo = null; }
  }

  const title = t(input.title) || "AI Teacher session";
  const teacher = t(input.teacherName);
  const dateStr = formatDate(input.dateIso);

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = 0;

  // ── Cover header ────────────────────────────────────────────────
  const titleLines = wrapText(title, bold, 24, CONTENT_W - 10);
  const headerH = 96 + titleLines.length * 29;
  page.drawRectangle({ x: 0, y: PAGE_H - headerH, width: PAGE_W, height: headerH, color: C.teal });
  page.drawRectangle({ x: 0, y: PAGE_H - headerH - 5, width: PAGE_W, height: 5, color: C.orange });
  page.drawCircle({ x: PAGE_W - 40, y: PAGE_H - 30, size: 90, color: C.orange, opacity: 0.12 });
  page.drawCircle({ x: PAGE_W - 120, y: PAGE_H - headerH + 10, size: 40, color: C.white, opacity: 0.05 });

  let hy = PAGE_H - 44;
  if (logo) {
    const h = 24;
    const w = (logo.width / logo.height) * h;
    page.drawImage(logo, { x: MARGIN, y: hy - 1, width: w, height: h });
    page.drawText("AI TEACHER STUDY NOTES", {
      x: MARGIN + w + 20, y: hy + 7, size: 9, font: bold, color: C.orange,
    });
  } else {
    page.drawText(`${brand.toUpperCase()}  |  AI TEACHER STUDY NOTES`, {
      x: MARGIN, y: hy + 7, size: 9, font: bold, color: C.orange,
    });
  }
  hy -= 34;
  for (const line of titleLines) {
    page.drawText(line, { x: MARGIN, y: hy, size: 24, font: bold, color: C.white });
    hy -= 29;
  }
  const meta = [teacher ? `With ${teacher}` : "", dateStr].filter(Boolean).join("   |   ");
  if (meta) page.drawText(meta, { x: MARGIN, y: hy + 4, size: 10.5, font: regular, color: C.headerSub });

  y = PAGE_H - headerH - 5 - 30;

  // ── Layout helpers ──────────────────────────────────────────────
  const bottomLimit = MARGIN + FOOTER_H;
  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({ x: 0, y: PAGE_H - 6, width: PAGE_W, height: 6, color: C.teal });
    const label = wrapText(title, regular, 9, CONTENT_W)[0] ?? "";
    page.drawText(label, { x: MARGIN, y: PAGE_H - 30, size: 9, font: regular, color: C.faint });
    y = PAGE_H - 56;
  };
  const ensure = (h: number) => { if (y - h < bottomLimit) newPage(); };

  const section = (label: string, accent: RGB = C.orange) => {
    ensure(60);
    y -= 6;
    page.drawRectangle({ x: MARGIN, y: y - 2, width: 4, height: 16, color: accent });
    page.drawText(label, { x: MARGIN + 12, y, size: 14, font: bold, color: C.teal });
    y -= 12;
    page.drawLine({
      start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 0.6, color: C.line,
    });
    y -= 18;
  };

  const paragraph = (
    text: string,
    opts: { font?: PDFFont; size?: number; color?: RGB; x?: number; width?: number; leading?: number } = {},
  ) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 10.5;
    const x = opts.x ?? MARGIN;
    const width = opts.width ?? CONTENT_W;
    const leading = opts.leading ?? size * 1.45;
    for (const line of wrapText(text, font, size, width)) {
      ensure(leading);
      page.drawText(line, { x, y, size, font, color: opts.color ?? C.ink });
      y -= leading;
    }
  };

  /** A rounded-feel card whose height is measured before drawing so it never splits badly. */
  const card = (
    measure: () => number,
    draw: (top: number) => void,
    fill: RGB,
    stripe?: RGB,
  ) => {
    const h = measure();
    ensure(Math.min(h, PAGE_H - MARGIN * 2 - FOOTER_H - 60) + 10);
    const top = y;
    page.drawRectangle({ x: MARGIN, y: top - h, width: CONTENT_W, height: h, color: fill });
    if (stripe) page.drawRectangle({ x: MARGIN, y: top - h, width: 3, height: h, color: stripe });
    draw(top);
    y = top - h - 10;
  };

  // ── Report sections ─────────────────────────────────────────────
  const report = input.report;
  if (report) {
    const scores = Object.entries(report.scores ?? {}).filter(
      ([, v]) => typeof v === "number",
    ) as Array<[string, number]>;
    if (scores.length > 0) {
      section("Session snapshot");
      const barX = MARGIN + 120;
      const barW = CONTENT_W - 120 - 46;
      for (const [k, v] of scores) {
        ensure(24);
        const pct = Math.max(0, Math.min(100, Math.round(v)));
        page.drawText(t(titleCase(k)), { x: MARGIN, y, size: 10.5, font: bold, color: C.ink });
        page.drawRectangle({ x: barX, y: y - 1, width: barW, height: 9, color: C.track });
        const fillColor = pct >= 75 ? C.green : pct >= 50 ? C.orange : C.rose;
        if (pct > 0) page.drawRectangle({ x: barX, y: y - 1, width: (barW * pct) / 100, height: 9, color: fillColor });
        const label = `${pct}%`;
        page.drawText(label, {
          x: MARGIN + CONTENT_W - bold.widthOfTextAtSize(label, 10.5), y, size: 10.5, font: bold, color: C.teal,
        });
        y -= 22;
      }
      paragraph("Scores are guidance to help you focus, not a grade.", {
        font: italic, size: 8.5, color: C.faint,
      });
      y -= 10;
    }

    if (report.strengths?.length) {
      section("What went well", C.green);
      for (const s of report.strengths) {
        const lines = wrapText(t(s), regular, 10.5, CONTENT_W - 22);
        ensure(lines.length * 15 + 4);
        page.drawCircle({ x: MARGIN + 5, y: y + 3.5, size: 3, color: C.green });
        for (const line of lines) {
          page.drawText(line, { x: MARGIN + 18, y, size: 10.5, font: regular, color: C.ink });
          y -= 15;
        }
        y -= 4;
      }
      y -= 8;
    }

    if (report.mistakes?.length) {
      section("Key corrections");
      const innerX = MARGIN + 16;
      const innerW = CONTENT_W - 32;
      for (const m of report.mistakes) {
        const said = wrapText(t(m.said), regular, 10, innerW - 70);
        const correct = wrapText(t(m.correct), bold, 10.5, innerW - 70);
        const note = m.note ? wrapText(t(m.note), italic, 9.5, innerW) : [];
        const category = t(m.category).toUpperCase();
        const h = 16 + 14 + said.length * 14 + 4 + correct.length * 15 + (note.length ? 6 + note.length * 13 : 0) + 10;
        card(
          () => h,
          (top) => {
            let cy = top - 18;
            if (category) {
              const w = bold.widthOfTextAtSize(category, 7.5) + 12;
              page.drawRectangle({ x: innerX, y: cy - 3, width: w, height: 13, color: C.white });
              page.drawText(category, { x: innerX + 6, y: cy + 0.5, size: 7.5, font: bold, color: C.orange });
            }
            cy -= 18;
            page.drawText("You said", { x: innerX, y: cy, size: 8.5, font: bold, color: C.faint });
            for (const line of said) {
              page.drawText(line, { x: innerX + 70, y: cy, size: 10, font: regular, color: C.muted });
              const w = regular.widthOfTextAtSize(line, 10);
              page.drawLine({
                start: { x: innerX + 70, y: cy + 3.5 }, end: { x: innerX + 70 + w, y: cy + 3.5 },
                thickness: 0.7, color: C.rose, opacity: 0.7,
              });
              cy -= 14;
            }
            cy -= 4;
            page.drawText("Better", { x: innerX, y: cy, size: 8.5, font: bold, color: C.green });
            for (const line of correct) {
              page.drawText(line, { x: innerX + 70, y: cy, size: 10.5, font: bold, color: C.teal });
              cy -= 15;
            }
            if (note.length) {
              cy -= 6;
              for (const line of note) {
                page.drawText(line, { x: innerX, y: cy, size: 9.5, font: italic, color: C.muted });
                cy -= 13;
              }
            }
          },
          C.orangeSoft,
          C.orange,
        );
      }
      y -= 6;
    }

    if (report.nextStep) {
      section("Your next step");
      const lines = wrapText(t(report.nextStep), bold, 11.5, CONTENT_W - 36);
      card(
        () => 24 + lines.length * 16,
        (top) => {
          let cy = top - 22;
          for (const line of lines) {
            page.drawText(line, { x: MARGIN + 18, y: cy, size: 11.5, font: bold, color: C.teal });
            cy -= 16;
          }
        },
        C.tealSoft,
        C.teal,
      );
      y -= 8;
    }
  }

  // ── Saved concepts / phrases ────────────────────────────────────
  if (input.savedTakeaways?.length) {
    section("Key concepts to remember");
    for (const item of input.savedTakeaways) {
      const pronRaw = item.pron ? t(item.pron) : "";
      const head = t(item.text) || pronRaw;
      const pron = head === pronRaw ? "" : pronRaw;
      const meaning = item.meaning ? t(item.meaning) : "";
      const headLines = wrapText(head, bold, 11, CONTENT_W - 30);
      const pronLines = pron ? wrapText(`/${pron}/`, italic, 9.5, CONTENT_W - 30) : [];
      const meanLines = meaning ? wrapText(meaning, regular, 10, CONTENT_W - 30) : [];
      card(
        () => 14 + headLines.length * 15 + pronLines.length * 13 + meanLines.length * 14 + 6,
        (top) => {
          let cy = top - 18;
          for (const l of headLines) { page.drawText(l, { x: MARGIN + 16, y: cy, size: 11, font: bold, color: C.teal }); cy -= 15; }
          for (const l of pronLines) { page.drawText(l, { x: MARGIN + 16, y: cy, size: 9.5, font: italic, color: C.orange }); cy -= 13; }
          for (const l of meanLines) { page.drawText(l, { x: MARGIN + 16, y: cy, size: 10, font: regular, color: C.muted }); cy -= 14; }
        },
        C.track,
        C.teal,
      );
    }
    y -= 6;
  }

  // ── Transcript ──────────────────────────────────────────────────
  if (input.transcript?.length) {
    section("Session transcript", C.teal);
    const labelW = 78;
    const textX = MARGIN + labelW;
    const textW = CONTENT_W - labelW;
    for (const entry of input.transcript) {
      const translation = entry.translation ? t(entry.translation) : "";
      const text = t(entry.text) || translation;
      if (!text) continue;
      let label: string;
      let labelColor: RGB;
      let font = regular;
      let color = C.ink;
      if (entry.role === "learner") {
        label = "You"; labelColor = C.teal; color = C.muted;
      } else if (entry.role === "note") {
        label = "Board"; labelColor = C.faint; font = italic;
      } else {
        label = teacher || "Teacher"; labelColor = C.orange;
      }
      const noteTitle = entry.role === "note" && entry.title ? t(entry.title) : "";
      const lines = wrapText(noteTitle ? `${noteTitle}: ${text}` : text, font, 10, textW);
      const trLines = translation && translation !== text ? wrapText(translation, italic, 9, textW) : [];
      ensure(Math.min(lines.length, 3) * 14 + 4);
      const labelLine = wrapText(label, bold, 9, labelW - 10)[0] ?? label;
      page.drawText(labelLine, { x: MARGIN, y, size: 9, font: bold, color: labelColor });
      for (const line of lines) {
        ensure(14);
        page.drawText(line, { x: textX, y, size: 10, font, color });
        y -= 14;
      }
      for (const line of trLines) {
        ensure(13);
        page.drawText(line, { x: textX, y, size: 9, font: italic, color: C.faint });
        y -= 13;
      }
      y -= 7;
    }
  }

  if (!report && !input.savedTakeaways?.length && !input.transcript?.length) {
    paragraph("No notes yet. Talk with your AI teacher, then download again.", { color: C.muted });
  }

  // ── Footers ─────────────────────────────────────────────────────
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({
      start: { x: MARGIN, y: MARGIN + 14 }, end: { x: PAGE_W - MARGIN, y: MARGIN + 14 },
      thickness: 0.5, color: C.line,
    });
    p.drawText(`${brand}  |  AI Teacher study notes`, { x: MARGIN, y: MARGIN, size: 8, font: regular, color: C.faint });
    const pn = `Page ${i + 1} of ${pages.length}`;
    p.drawText(pn, {
      x: PAGE_W - MARGIN - regular.widthOfTextAtSize(pn, 8), y: MARGIN, size: 8, font: regular, color: C.faint,
    });
  });

  return doc.save();
}

export function pdfFilename(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${base || "ai-teacher-notes"}.pdf`;
}
