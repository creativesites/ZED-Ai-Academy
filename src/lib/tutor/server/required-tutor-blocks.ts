import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { parseTutorSessionBlock } from "../tutor-session-block.ts";

// Lesson completion gate for required tutor_session blocks. Used by every path that marks a lesson
// complete (the manual "Complete" action and the quiz pass), so the rule is the same everywhere.
// A required block counts only when its scenario is published; a missing scenario cannot block completion.

type Db = ReturnType<typeof createClient>;

/** Scenario ids of required, published tutor_session blocks in the lesson that this learner has not completed. */
export async function pendingRequiredTutorScenarios(db: Db, lessonId: string, userId: string): Promise<string[]> {
  const { data: blocks } = await db
    .from("content_blocks")
    .select("content")
    .eq("lesson_id", lessonId)
    .eq("type", "tutor_session");
  const requiredIds = (blocks ?? []).flatMap((b) => {
    const parsed = parseTutorSessionBlock(b.content);
    return parsed?.required ? [parsed.scenarioId] : [];
  });
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
