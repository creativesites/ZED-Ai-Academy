import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { chooseStartMode } from "@/lib/tutor/mode-policy";
import { resolveTutorAccess } from "@/lib/tutor/server/access";
import { mintLiveToken } from "@/lib/tutor/server/gemini-calls";
import { loadSessionContext, personaVoiceName, type SessionContext, type TutorSessionRow } from "@/lib/tutor/server/session-context";
import {
  abandonSession,
  countRecentSessionStarts,
  readJson,
  SESSION_STARTS_PER_HOUR,
} from "@/lib/tutor/server/session-store";
import { recordUsage } from "@/lib/tutor/server/usage";
import { runSessionTurn, sessionSystemPrompt } from "@/lib/tutor/server/turn-runner";

// POST /api/tutor/sessions: start a ZAI Tutor session.
// Live mode returns a single-use ephemeral token. Voice and Text mode runs the opening turn server-side.

const RATE_WINDOW_MS = 60 * 60_000;

const OPENING_INSTRUCTION =
  "The learner has just joined the session. Open it now as the teacher: greet the learner in character and begin the first beat of the scenario.";

const startSchema = z
  .object({
    origin: z.enum(["lesson", "assignment", "practice"]),
    scenarioId: z.string().uuid().optional(),
    lessonId: z.string().uuid().optional(),
    assignmentId: z.string().uuid().optional(),
    micPermission: z.enum(["granted", "denied", "prompt"]),
    rttMs: z.number().min(0).max(60_000).optional(),
  })
  .superRefine((body, ctx) => {
    if (body.origin === "lesson" && !body.lessonId) {
      ctx.addIssue({ code: "custom", path: ["lessonId"], message: "lessonId is required for lesson sessions" });
    }
    if (body.origin === "assignment" && !body.assignmentId) {
      ctx.addIssue({ code: "custom", path: ["assignmentId"], message: "assignmentId is required for assignment sessions" });
    }
  });

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const recentStarts = await countRecentSessionStarts(userId, RATE_WINDOW_MS);
  if (recentStarts >= SESSION_STARTS_PER_HOUR) {
    return NextResponse.json(
      { error: "Too many tutor sessions started recently. Try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  const parsed = startSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;

  const access = await resolveTutorAccess({
    userId,
    scenarioId: body.scenarioId,
    origin: body.origin,
    lessonId: body.lessonId,
    assignmentId: body.assignmentId,
  });
  if (!access.ok) {
    return NextResponse.json({ error: "Access denied", reason: access.reason }, { status: access.status });
  }

  const mode = chooseStartMode({
    allowedModes: access.allowedModes,
    micPermission: body.micPermission,
    rttMs: body.rttMs,
    liveMinutesLeft: access.liveMinutesLeft,
  });

  const { data: row, error: insertError } = await createServiceClient()
    .from("tutor_sessions")
    .insert({
      company_id: access.companyId,
      user_id: userId,
      scenario_id: access.scenario.id,
      origin: body.origin,
      lesson_id: access.lessonId,
      assignment_id: access.assignmentId,
      mode,
      status: "active",
    })
    .select("*")
    .single();
  if (insertError || !row) {
    console.error("[tutor] could not create session:", insertError?.message);
    return NextResponse.json({ error: "Could not start the session" }, { status: 500 });
  }

  const session: TutorSessionRow = row;
  const sessionContext = await loadSessionContext(session).catch(async (err: unknown) => {
    console.error("[tutor] could not load session context:", err);
    await abandonSession(session.id);
    return null;
  });
  if (!sessionContext) {
    return NextResponse.json({ error: "Could not prepare the session" }, { status: 500 });
  }

  const persona = {
    id: sessionContext.persona.id,
    name: sessionContext.persona.name,
    displayName: sessionContext.persona.display_name,
    languages: sessionContext.persona.languages,
    riveVariant: sessionContext.persona.rive_variant,
  };
  const scenario = publicScenario(sessionContext);

  if (mode === "live") {
    const minted = await mintLiveToken({
      systemInstruction: sessionSystemPrompt(sessionContext, "live"),
      voiceName: personaVoiceName(sessionContext.persona),
    });
    // Metering records the mint only. Audio seconds are reported by the client on complete.
    await recordUsage({
      companyId: session.company_id,
      userId,
      sessionId: session.id,
      model: minted.liveModel,
      kind: "llm",
      units: 0,
      unit: "token_mint",
    });
    return NextResponse.json({
      sessionId: session.id,
      mode,
      liveToken: minted.token,
      liveModel: minted.liveModel,
      liveTokenExpiresAt: minted.expireTime,
      persona,
      scenario,
    });
  }

  try {
    const opening = await runSessionTurn({
      ctx: sessionContext,
      idx: 0,
      learnerText: null,
      openingInstruction: OPENING_INSTRUCTION,
    });
    return NextResponse.json({
      sessionId: session.id,
      mode,
      persona,
      scenario,
      openingEvents: opening.events,
    });
  } catch (err) {
    console.error("[tutor] opening turn failed:", err);
    await abandonSession(session.id);
    return NextResponse.json({ error: "The teacher could not start the session. Try again." }, { status: 502 });
  }
}

function publicScenario(ctx: SessionContext) {
  return {
    id: ctx.scenario.id,
    title: ctx.scenario.title,
    goal: ctx.scenario.goal,
    maxMinutes: ctx.scenario.max_minutes,
  };
}
