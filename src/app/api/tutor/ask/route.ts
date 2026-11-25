import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findOrCreateAskSession } from "@/lib/tutor/server/ask-server";
import { readJson } from "@/lib/tutor/server/session-store";
import { isAskRuntimeEnabled } from "@/lib/tutor/runtime/ask";

// POST /api/tutor/ask: the lesson Ask dock on the Teacher Runtime (P1-06). Finds or creates the learner's `ask`
// session for a lesson and returns its conversation from the server (no browser-stored conversation).
// Body: { lessonId, restart? }. Turns then go to POST /api/tutor/sessions/:id/turn?stream=1.
// Behind NEXT_PUBLIC_TEACHER_ASK_RUNTIME (default off); 404 when off and 503 when the schema cannot store `ask`
// sessions, so the dock keeps using /api/ai/tutor exactly as before.

const bodySchema = z.object({
  lessonId: z.string().uuid(),
  restart: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  if (!isAskRuntimeEnabled(process.env.NEXT_PUBLIC_TEACHER_ASK_RUNTIME)) {
    return NextResponse.json({ error: "Not found", reason: "ask_runtime_disabled" }, { status: 404 });
  }

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const result = await findOrCreateAskSession({ userId, lessonId: parsed.data.lessonId, restart: parsed.data.restart });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.status === 429 ? "Too many conversations started recently. Try again later." : "Unavailable", reason: result.reason },
      { status: result.status, ...(result.status === 429 ? { headers: { "Retry-After": "3600" } } : {}) },
    );
  }

  return NextResponse.json({
    sessionId: result.session.id,
    created: result.created,
    turns: result.turns,
  });
}
