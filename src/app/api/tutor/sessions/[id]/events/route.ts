import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { CONTRACT_VERSION, parseTutorTurn, toClientEvent } from "@/lib/tutor/events";
import { isSchemaUnavailableError } from "@/lib/tutor/mastery/server";
import { loadOwnedSession, readJson, sessionIdSchema } from "@/lib/tutor/server/session-store";
import { MAX_TURNS } from "@/lib/tutor/server/turn-pipeline";

// POST /api/tutor/sessions/[id]/events: Live sessions post their turns in batches, so history and
// the report have the transcript. Each event is validated; invalid events are dropped, not stored.
// Live checks are never server-graded (P2-04): Gemini Live tool calls reach the browser directly, so an answer key
// there is already visible to the learner and anything the browser posts is client-asserted. Live is not taught
// answer keys at all; any key a client posts anyway is stripped, and Live answers stay teacher judgement.

const MAX_TURNS_PER_CALL = 20;
const MAX_EVENTS_IN_BODY = 64;

const turnSchema = z.object({
  idx: z.number().int().min(0).max(MAX_TURNS - 1),
  learnerText: z.string().max(4000).nullish(),
  events: z.array(z.unknown()).max(MAX_EVENTS_IN_BODY),
  latencyMs: z.number().int().min(0).max(600_000).optional(),
});

const bodySchema = z.object({
  turns: z.array(turnSchema).min(1).max(MAX_TURNS_PER_CALL),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!sessionIdSchema.safeParse(id).success) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await loadOwnedSession(id, userId);
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.mode !== "live") {
    return NextResponse.json({ error: "Only Live sessions post events" }, { status: 409 });
  }
  if (session.status !== "active") {
    return NextResponse.json({ error: "Session is not active", status: session.status }, { status: 409 });
  }

  const parsed = bodySchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  // One row per idx. If a batch repeats an idx, the last occurrence wins.
  const byIdx = new Map<number, (typeof parsed.data.turns)[number]>();
  for (const turn of parsed.data.turns) byIdx.set(turn.idx, turn);

  let dropped = 0;
  const rows = [...byIdx.values()].map((turn) => {
    const result = parseTutorTurn({ events: turn.events });
    const kept = result.ok ? result.events.map((e) => toClientEvent(e)) : [];
    dropped += turn.events.length - kept.length;
    return {
      session_id: session.id,
      idx: turn.idx,
      learner_text: turn.learnerText ?? null,
      events: kept as unknown as Json,
      latency_ms: turn.latencyMs ?? null,
    };
  });

  const db = createServiceClient();
  let { error } = await db
    .from("tutor_turns")
    .upsert(
      rows.map((row) => ({ ...row, contract_version: CONTRACT_VERSION })),
      { onConflict: "session_id,idx" },
    );
  // Before the contract_version migration is applied, store the turns without it.
  if (error && isSchemaUnavailableError(error)) {
    ({ error } = await db.from("tutor_turns").upsert(rows, { onConflict: "session_id,idx" }));
  }
  if (error) {
    console.error("[tutor] could not save live turns:", error.message);
    return NextResponse.json({ error: "Could not save turns" }, { status: 500 });
  }

  return NextResponse.json({ saved: rows.length, dropped });
}
