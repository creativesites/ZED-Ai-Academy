import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { buildStudyNotesPdf, pdfFilename, sanitizePdfText, wrapText } from "./study-pdf.ts";

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
});
