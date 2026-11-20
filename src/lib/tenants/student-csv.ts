export interface ParsedStudentRow {
  email: string;
  fullName?: string;
}

export interface StudentCsvParseResult {
  validRows: ParsedStudentRow[];
  invalidLines: { line: number; raw: string; reason: string }[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parses CSV, TSV, or newline/comma-separated student lists.
 * Supports optional headers (email, full_name / name) and `Name <email>` entries.
 */
export function parseStudentCsv(input: string): StudentCsvParseResult {
  const validRows: ParsedStudentRow[] = [];
  const invalidLines: { line: number; raw: string; reason: string }[] = [];
  const seenEmails = new Set<string>();

  const lines = input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");

  let emailColIdx = -1;
  let nameColIdx = -1;

  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const delimiter = trimmed.includes("\t")
      ? "\t"
      : trimmed.includes(";")
      ? ";"
      : ",";

    const cells = trimmed
      .split(delimiter)
      .map((cell) => cell.trim().replace(/^["']|["']$/g, ""));

    // Detect header row on first non-empty line
    if (index === 0 || (validRows.length === 0 && invalidLines.length === 0 && emailColIdx === -1)) {
      const lowerCells = cells.map((c) => c.toLowerCase());
      const headerEmailIdx = lowerCells.findIndex(
        (c) => c === "email" || c === "email address" || c === "e-mail" || c === "student_email"
      );
      if (headerEmailIdx !== -1) {
        emailColIdx = headerEmailIdx;
        nameColIdx = lowerCells.findIndex(
          (c) =>
            c === "name" ||
            c === "full_name" ||
            c === "full name" ||
            c === "student_name" ||
            c === "student"
        );
        return;
      }
    }

    // Handle `Full Name <email@domain.com>` single-cell format
    if (cells.length === 1) {
      const angleMatch = cells[0].match(/^(.*?)<([^>]+)>$/);
      if (angleMatch) {
        const namePart = angleMatch[1].trim().replace(/^["']|["']$/g, "");
        const emailPart = angleMatch[2].trim().toLowerCase();
        if (EMAIL_RE.test(emailPart)) {
          if (!seenEmails.has(emailPart)) {
            seenEmails.add(emailPart);
            validRows.push({
              email: emailPart,
              ...(namePart ? { fullName: namePart } : {}),
            });
          }
          return;
        }
      }
    }

    let email = "";
    let fullName = "";

    if (emailColIdx !== -1 && emailColIdx < cells.length) {
      email = (cells[emailColIdx] || "").toLowerCase();
      if (nameColIdx !== -1 && nameColIdx < cells.length) {
        fullName = cells[nameColIdx] || "";
      }
    } else {
      // Infer email cell automatically when no header is present
      const foundIdx = cells.findIndex((c) => EMAIL_RE.test(c));
      if (foundIdx !== -1) {
        email = cells[foundIdx].toLowerCase();
        const otherCells = cells.filter((_, idx) => idx !== foundIdx).filter(Boolean);
        if (otherCells.length > 0) {
          fullName = otherCells.join(" ");
        }
      }
    }

    if (!email || !EMAIL_RE.test(email)) {
      invalidLines.push({
        line: index + 1,
        raw: trimmed,
        reason: "Missing or invalid email address",
      });
      return;
    }

    if (!seenEmails.has(email)) {
      seenEmails.add(email);
      validRows.push({
        email,
        ...(fullName ? { fullName } : {}),
      });
    }
  });

  return { validRows, invalidLines };
}
