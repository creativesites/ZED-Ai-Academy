import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addGoalSchema,
  authorizeMemoryAction,
  buildLearnerExport,
  cleanLearnerText,
  editMemorySchema,
  evidenceRedactionFor,
  exportFileName,
  staffVisibility,
} from "./memory-actions.ts";
import type { LearnerMemoryRecord } from "./memory.ts";

const ROW = { user_id: "user_a", company_id: "co_1", status: "active" };

test("ownership: only the owner may act; others and missing rows look identical", () => {
  assert.deepEqual(authorizeMemoryAction(ROW, "user_a"), { ok: true, companyId: "co_1" });
  assert.deepEqual(authorizeMemoryAction(ROW, "user_b"), { ok: false, reason: "not_found" });
  assert.deepEqual(authorizeMemoryAction(null, "user_a"), { ok: false, reason: "not_found" });
  assert.deepEqual(authorizeMemoryAction(undefined, "user_a"), { ok: false, reason: "not_found" });
  assert.deepEqual(authorizeMemoryAction({ ...ROW, status: "deleted" }, "user_a"), { ok: false, reason: "not_found" });
  assert.deepEqual(authorizeMemoryAction(ROW, null), { ok: false, reason: "unauthenticated" });
  assert.deepEqual(authorizeMemoryAction(ROW, ""), { ok: false, reason: "unauthenticated" });
});

test("hidden rows can still be managed by their owner (unhide, edit, delete)", () => {
  assert.equal(authorizeMemoryAction({ ...ROW, status: "hidden" }, "user_a").ok, true);
});

test("tenant comes from the row", () => {
  const r = authorizeMemoryAction({ ...ROW, company_id: "co_9" }, "user_a");
  assert.ok(r.ok && r.companyId === "co_9");
});

test("input validation", () => {
  assert.equal(editMemorySchema.safeParse({ id: "not-a-uuid", content: "x" }).success, false);
  assert.equal(editMemorySchema.safeParse({ id: "7c9e6679-7425-40de-944b-e07fc1f90ae7", content: "x" }).success, true);
  assert.equal(addGoalSchema.safeParse({ domain: "", content: "x" }).success, false);
  assert.equal(cleanLearnerText("  hello \n\n world  "), "hello world");
  assert.equal(cleanLearnerText("   "), null);
  assert.equal(cleanLearnerText("z".repeat(900))!.length, 500);
});

test("delete redacts linked evidence detail only when linked to a session", () => {
  assert.equal(evidenceRedactionFor({ sessionId: null, objectiveKey: "k" }, "u"), null);
  assert.deepEqual(evidenceRedactionFor({ sessionId: "s1", objectiveKey: null }, "u"), { userId: "u", sessionId: "s1", objectiveKey: null });
  assert.deepEqual(evidenceRedactionFor({ sessionId: "s1", objectiveKey: "k" }, "u"), { userId: "u", sessionId: "s1", objectiveKey: "k" });
});

const MEM: LearnerMemoryRecord = {
  id: "m1", companyId: "co_1", kind: "goal", content: "Pass the exam", source: "learner_stated", sourceRef: null,
  sessionId: null, courseId: null, objectiveKey: null, confidence: 1, visibleToStaff: false, status: "active",
  expiresAt: null, createdAt: "2026-11-01T00:00:00Z",
};

test("export is valid JSON with all sections and no deleted rows", () => {
  const json = buildLearnerExport({
    userId: "user_a",
    exportedAt: "2026-11-25T10:00:00Z",
    memories: [MEM, { ...MEM, id: "m2", status: "hidden" }, { ...MEM, id: "m3", status: "deleted" }],
    preferences: { dataSaver: true },
    habits: { streakDays: 2 },
    objectives: [{ objectiveKey: "k" }],
    evidence: [],
  });
  const doc = JSON.parse(json);
  assert.equal(doc.format, "zed-ai-academy.learner-memory");
  assert.deepEqual(doc.memories.map((m: { id: string }) => m.id), ["m1", "m2"]);
  assert.equal(doc.preferences.dataSaver, true);
  assert.equal(doc.objectives.length, 1);
  assert.equal(exportFileName("2026-11-25T10:00:00Z"), "what-my-teacher-knows-2026-11-25.json");
});

test("staff visibility labels", () => {
  assert.equal(staffVisibility({ type: "memory", visibleToStaff: false }), "private");
  assert.equal(staffVisibility({ type: "memory", visibleToStaff: true }), "staff");
  assert.equal(staffVisibility({ type: "objective" }), "staff");
  assert.equal(staffVisibility({ type: "preference" }), "private");
});
