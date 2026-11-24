// Generates a clean Markdown study sheet from a completed or in-progress AI Teacher session
// so learners can download & keep their notes, takeaways, corrections, and transcript.

import type { TutorReportContent } from "./report-model.ts";

export type ExportTranscriptLine = {
  role: "teacher" | "learner" | "note";
  title?: string;
  text: string;
  translation?: string;
};

export type StudyExportInput = {
  title: string;
  teacherName?: string;
  dateIso?: string;
  report?: TutorReportContent | null;
  transcript?: ExportTranscriptLine[];
  savedTakeaways?: Array<{ text: string; pron?: string; meaning?: string }>;
};

export function buildStudyNotesMarkdown(input: StudyExportInput): string {
  const lines: string[] = [];
  const dateStr = (input.dateIso ?? new Date().toISOString()).slice(0, 10);

  lines.push(`# ${input.title}`);
  lines.push(
    `> AI Teacher Study Notes${input.teacherName ? ` · with ${input.teacherName}` : ""} · ${dateStr}`,
  );
  lines.push("");

  if (input.report) {
    const scoreEntries = Object.entries(input.report.scores).filter(
      ([, v]) => typeof v === "number",
    );
    if (scoreEntries.length > 0) {
      lines.push("## Session Guidance");
      for (const [k, v] of scoreEntries) {
        lines.push(`- **${k.charAt(0).toUpperCase() + k.slice(1)}**: ${v}%`);
      }
      lines.push("");
    }

    if (input.report.strengths.length > 0) {
      lines.push("## What Went Well");
      for (const s of input.report.strengths) lines.push(`- ${s}`);
      lines.push("");
    }

    if (input.report.mistakes.length > 0) {
      lines.push("## Key Corrections & Improvements");
      for (const m of input.report.mistakes) {
        lines.push(
          `- ~~${m.said}~~ → **${m.correct}** _(${m.category})_${m.note ? ` — ${m.note}` : ""}`,
        );
      }
      lines.push("");
    }

    if (input.report.nextStep) {
      lines.push("## Next Step");
      lines.push(input.report.nextStep);
      lines.push("");
    }
  }

  if (input.savedTakeaways && input.savedTakeaways.length > 0) {
    lines.push("## Key Concepts & Phrases");
    for (const item of input.savedTakeaways) {
      const pron = item.pron ? ` (${item.pron})` : "";
      const meaning = item.meaning ? ` — ${item.meaning}` : "";
      lines.push(`- **${item.text}**${pron}${meaning}`);
    }
    lines.push("");
  }

  if (input.transcript && input.transcript.length > 0) {
    lines.push("## Session Transcript");
    for (const entry of input.transcript) {
      if (entry.role === "learner") {
        lines.push(`- **You:** ${entry.text}`);
      } else if (entry.role === "note") {
        lines.push(`- **Board (${entry.title ?? "Note"}):** ${entry.text}`);
      } else {
        const tr = entry.translation ? ` _(${entry.translation})_` : "";
        lines.push(`- **${input.teacherName ?? "AI Teacher"}:** ${entry.text}${tr}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

export function slugifyFilename(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${base || "ai-teacher-notes"}.md`;
}
