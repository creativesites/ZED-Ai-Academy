import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { finalizeTutorSession } from "@/lib/tutor/server/report";
import { loadOwnedSession, readJson, sessionIdSchema } from "@/lib/tutor/server/session-store";

// POST /api/tutor/sessions/[id]/complete: ends the session, stores the client's speaking time,
// and generates the report. Idempotent: a second call returns the stored report and changes nothing.

const SIX_HOURS_MS = 6 * 60 * 60_000;

const bodySchema = z.object({
  learnerSpeakingMs: z.number().int().min(0).max(SIX_HOURS_MS),
  teacherSpeakingMs: z.number().int().min(0).max(SIX_HOURS_MS),
  status: z.enum(["completed", "abandoned"]),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!sessionIdSchema.safeParse(id).success) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await loadOwnedSession(id, userId);
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await finalizeTutorSession({
      session,
      learnerSpeakingMs: parsed.data.learnerSpeakingMs,
      teacherSpeakingMs: parsed.data.teacherSpeakingMs,
      status: parsed.data.status,
    });
    return NextResponse.json({ report: result.report, created: result.created });
  } catch (err) {
    console.error("[tutor] could not finalize session:", err);
    return NextResponse.json(
      { error: "The report could not be generated. Call this endpoint again to retry." },
      { status: 502 },
    );
  }
}
