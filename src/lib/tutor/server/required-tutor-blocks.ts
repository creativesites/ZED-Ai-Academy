import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { isSchemaUnavailableError } from "../mastery/server.ts";
import { parseTutorSessionBlock } from "../tutor-session-block.ts";

// Lesson completion gate for required tutor_session blocks AND required placed teacher_moments.
// Used by every path that marks a lesson complete (manual "Complete" and quiz pass).
// A required block/moment counts only when its scenario is published; a missing scenario cannot block completion.

type Db = ReturnType<typeof createClient>;

/** Scenario ids of required, published tutor_session blocks or teacher_moments in the lesson that this learner has not completed. */
export async function pendingRequiredTutorScenarios(db: Db, lessonId: string, userId: string): Promise<string[]> {
  const [{ data: blocks }, momentsRes] = await Promise.all([
    db
      .from("content_blocks")
      .select("content")
      .eq("lesson_id", lessonId)
      .eq("type", "tutor_session"),
    (db as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: unknown) => {
            eq: (k2: string, v2: unknown) => {
              eq: (k3: string, v3: unknown) => Promise<{
                data: Array<{ scenario_id: string }> | null;
                error: { code?: string; message?: string } | null;
              }>;
            };
          };
        };
      };
    })
      .from("teacher_moments")
      .select("scenario_id")
      .eq("lesson_id", lessonId)
      .eq("status", "published")
      .eq("required", true),
  ]);

  const blockRequiredIds = (blocks ?? []).flatMap((b) => {
    const parsed = parseTutorSessionBlock(b.content);
    return parsed?.required ? [parsed.scenarioId] : [];
  });
  const momentRequiredIds =
    momentsRes.error && isSchemaUnavailableError(momentsRes.error)
      ? []
      : (momentsRes.data ?? []).map((m) => m.scenario_id);

  const requiredIds = Array.from(new Set([...blockRequiredIds, ...momentRequiredIds]));
  if (requiredIds.length === 0) return [];

  const { data: published } = await db
    .from("practice_scenarios")
    .select("id")
    .in("id", requiredIds)
    .eq("status", "published");
  const gating = (published ?? []).map((r) => r.id);
  if (gating.length === 0) return [];

  const { data: done } = await db
    .from("tutor_sessions")
    .select("scenario_id")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .eq("origin", "lesson")
    .eq("status", "completed")
    .in("scenario_id", gating);
  const doneIds = new Set((done ?? []).map((r) => r.scenario_id));
  return gating.filter((id) => !doneIds.has(id));
}
