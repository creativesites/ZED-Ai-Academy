import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { canViewTutorSession } from "@/lib/tutor/visibility";
import { isTenantStaff, loadSession, sessionIdSchema } from "@/lib/tutor/server/session-store";

// GET /api/tutor/sessions/[id]: the session, its turns and its report.
// The learner always sees their own session. Tenant staff see it only under the privacy rules
// (lesson or assignment session, shared by the learner, or flagged). Anyone else gets a 404.

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!sessionIdSchema.safeParse(id).success) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await loadSession(id);
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = session.user_id === userId;
  const staff = isOwner ? false : await isTenantStaff(userId, session.company_id);
  const visible = canViewTutorSession(
    userId,
    {
      userId: session.user_id,
      origin: session.origin,
      sharedWithTeacher: session.shared_with_teacher,
      status: session.status,
    },
    { isTenantStaff: staff },
  );
  if (!visible) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = createServiceClient();
  const [{ data: turns }, { data: report }] = await Promise.all([
    supabase
      .from("tutor_turns")
      .select("idx, learner_text, learner_audio_ms, events, latency_ms, created_at")
      .eq("session_id", session.id)
      .order("idx", { ascending: true }),
    supabase.from("tutor_reports").select("*").eq("session_id", session.id).maybeSingle(),
  ]);

  return NextResponse.json({
    session: {
      id: session.id,
      origin: session.origin,
      mode: session.mode,
      status: session.status,
      scenarioId: session.scenario_id,
      lessonId: session.lesson_id,
      assignmentId: session.assignment_id,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      learnerSpeakingMs: session.learner_speaking_ms,
      teacherSpeakingMs: session.teacher_speaking_ms,
      sharedWithTeacher: session.shared_with_teacher,
      viewer: isOwner ? "learner" : "staff",
    },
    turns: turns ?? [],
    report: report ?? null,
  });
}
