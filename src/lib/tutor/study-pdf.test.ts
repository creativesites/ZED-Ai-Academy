import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { readFileSync } from "node:fs";
import { buildStudyNotesPdf, collectStudyText, needsUnicodeFont, pdfFilename, sanitizePdfText, wrapText } from "./study-pdf.ts";

describe("study notes PDF", () => {
  it("sanitises text Helvetica cannot draw", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const set = new Set(font.getCharacterSet());
    assert.equal(sanitizePdfText("Role → **Task** ✓ 🚀 “ok”", set).trim(), "Role -> Task “ok”");
    assert.equal(sanitizePdfText("nǐ hǎo 你好", set).trim(), "ni hao");
  });

  it("wraps long text within the width", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const lines = wrapText("word ".repeat(80) + "x".repeat(200), font, 10, 200);
    assert.ok(lines.length > 5);
    for (const l of lines) assert.ok(font.widthOfTextAtSize(l, 10) <= 200);
  });

  it("builds a multi-page PDF with emoji and empty input", async () => {
    const bytes = await buildStudyNotesPdf({
      title: "Session 🚀",
      teacherName: "Maureen",
      transcript: Array.from({ length: 80 }, () => ({ role: "teacher" as const, text: "Hello there → let's learn. ".repeat(5) })),
    });
    const parsed = await PDFDocument.load(bytes);
    assert.ok(parsed.getPageCount() >= 2);
    const empty = await buildStudyNotesPdf({ title: "" });
    assert.equal((await PDFDocument.load(empty)).getPageCount(), 1);
    assert.equal(pdfFilename("Gross Margin 101!"), "gross-margin-101.pdf");
  });

  it("detects when Chinese or pinyin needs the Unicode font", () => {
    assert.equal(needsUnicodeFont("Prompt makeover — café “ok”"), false);
    assert.equal(needsUnicodeFont("nǐ hǎo"), true);
    assert.equal(needsUnicodeFont("你好"), true);
    assert.ok(collectStudyText({ title: "x", savedTakeaways: [{ text: "谢谢" }] }).includes("谢谢"));
  });

  it("embeds Noto Sans SC so Chinese text keeps its characters", async () => {
    const font = (n: string) => readFileSync(new URL(`../../../public/fonts/pdf/NotoSansSC-${n}.ttf`, import.meta.url));
    const bytes = await buildStudyNotesPdf(
      { title: "Greetings 你好", savedTakeaways: [{ text: "你好", pron: "nǐ hǎo", meaning: "Hello" }] },
      { unicodeFonts: { regular: font("Regular"), bold: font("Bold") } },
    );
    assert.equal((await PDFDocument.load(bytes)).getPageCount(), 1);
    assert.ok(bytes.length > 500_000, "fonts are embedded");
  });
});
