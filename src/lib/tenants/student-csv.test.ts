import test from "node:test";
import assert from "node:assert/strict";
import { parseStudentCsv } from "./student-csv.ts";

test("parseStudentCsv parses headered CSV with full_name and email", () => {
  const csv = `full_name,email
Jane Banda,jane@example.com
John Mwale,JOHN@EXAMPLE.COM
Jane Duplicate,jane@example.com
Invalid Row,not-an-email`;

  const result = parseStudentCsv(csv);
  assert.equal(result.validRows.length, 2);
  assert.deepEqual(result.validRows, [
    { email: "jane@example.com", fullName: "Jane Banda" },
    { email: "john@example.com", fullName: "John Mwale" },
  ]);
  assert.equal(result.invalidLines.length, 1);
  assert.equal(result.invalidLines[0].line, 5);
});

test("parseStudentCsv supports headerless lists and Angle-bracket format", () => {
  const raw = `
chanda@school.zm
"Mutale Phiri" <mutale@school.zm>
mary@school.zm,Mary Zulu
`;

  const result = parseStudentCsv(raw);
  assert.deepEqual(result.validRows, [
    { email: "chanda@school.zm" },
    { email: "mutale@school.zm", fullName: "Mutale Phiri" },
    { email: "mary@school.zm", fullName: "Mary Zulu" },
  ]);
  assert.equal(result.invalidLines.length, 0);
});
