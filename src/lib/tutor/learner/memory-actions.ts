import { z } from "zod";
import { MEMORY_CONTENT_MAX_CHARS, type LearnerMemoryRecord } from "./memory.ts";

// Pure rules behind the "What my teacher knows" server actions (P1-08): input validation, ownership,
// what a delete must also redact, and the export document. Tested; the actions only add Clerk + Supabase.

export const memoryIdSchema = z.string().uuid();

export const editMemorySchema = z.object({
  id: memoryIdSchema,
  content: z.string(),
});

export const addGoalSchema = z.object({
  domain: z.string().trim().min(1).max(120),
  content: z.string(),
});

/** Normalises learner-entered memory text: one line, trimmed, ≤500 chars. Null when empty. */
export function cleanLearnerText(raw: string): string | null {
  const text = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.slice(0, MEMORY_CONTENT_MAX_CHARS);
}

export type OwnedRow = { user_id: string; company_id: string; status: string } | null | undefined;

export type OwnershipResult = { ok: true; companyId: string } | { ok: false; reason: "unauthenticated" | "not_found" };

/**
 * A learner may act on a memory only if it is theirs. Someone else's row and a missing row are the same
 * answer ("not_found"), so ids cannot be probed. The tenant comes from the row, never from the client.
 */
export function authorizeMemoryAction(row: OwnedRow, userId: string | null | undefined): OwnershipResult {
  if (!userId) return { ok: false, reason: "unauthenticated" };
  if (!row || row.user_id !== userId || row.status === "deleted") return { ok: false, reason: "not_found" };
  return { ok: true, companyId: row.company_id };
}

/**
 * Which learner_evidence rows lose their free-text `detail` when a memory is deleted: the same learner's
 * evidence from the session the memory was made from (narrowed to its objective when it has one).
 * Evidence rows themselves stay (mastery needs them, Architecture §4.4). Null when nothing is linked.
 */
export function evidenceRedactionFor(
  memory: Pick<LearnerMemoryRecord, "sessionId" | "objectiveKey">,
  userId: string,
): { userId: string; sessionId: string; objectiveKey: string | null } | null {
  if (!memory.sessionId) return null;
  return { userId, sessionId: memory.sessionId, objectiveKey: memory.objectiveKey ?? null };
}

export type ExportInput = {
  userId: string;
  exportedAt: string;
  memories: ReadonlyArray<LearnerMemoryRecord>;
  preferences: unknown;
  habits: unknown;
  objectives: ReadonlyArray<unknown>;
  evidence: ReadonlyArray<unknown>;
};

/** The JSON document the learner downloads. Deleted rows are never included (they no longer exist). */
export function buildLearnerExport(input: ExportInput): string {
  return JSON.stringify(
    {
      format: "zed-ai-academy.learner-memory",
      version: 1,
      exportedAt: input.exportedAt,
      userId: input.userId,
      memories: input.memories
        .filter((m) => m.status !== "deleted")
        .map((m) => ({
          id: m.id,
          academy: m.companyId,
          kind: m.kind,
          content: m.content,
          source: m.source,
          sourceRef: m.sourceRef,
          courseId: m.courseId,
          status: m.status,
          visibleToStaff: m.visibleToStaff,
          expiresAt: m.expiresAt,
          createdAt: m.createdAt,
        })),
      preferences: input.preferences ?? null,
      habits: input.habits ?? null,
      objectives: input.objectives,
      evidence: input.evidence,
    },
    null,
    2,
  );
}

/** File name for the export download. */
export function exportFileName(exportedAt: string): string {
  return `what-my-teacher-knows-${exportedAt.slice(0, 10)}.json`;
}

export type StaffVisibility = "private" | "staff";

/**
 * The staff-visibility label for an item. Memories: only when the learner's row allows it (and a tenant
 * policy, not yet configurable, allows it — today always off unless the row says so). Objective states:
 * academy staff can see mastery (existing insights), so they are labelled honestly.
 */
export function staffVisibility(item: { type: "memory"; visibleToStaff: boolean } | { type: "objective" } | { type: "preference" }): StaffVisibility {
  if (item.type === "objective") return "staff";
  if (item.type === "preference") return "private";
  return item.visibleToStaff ? "staff" : "private";
}
