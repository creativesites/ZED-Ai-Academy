import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { askTurnAllowed } from "@/lib/tutor/server/ask-server";
import { loadSessionContext } from "@/lib/tutor/server/session-context";
import { loadOwnedSession, readJson, sessionIdSchema } from "@/lib/tutor/server/session-store";
import { runSessionTurn, TurnConflictError } from "@/lib/tutor/server/turn-runner";
import { sessionLimitReason } from "@/lib/tutor/server/turn-pipeline";
import { turnStreamResponse } from "@/lib/tutor/server/turn-stream-response";
import { LEARNER_AUDIO_TYPES, LEARNER_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/tutor/recording";

// POST /api/tutor/sessions/[id]/turn: one Voice, Text, or Multimodal Image exchange.
// Body: JSON { text } or multipart/form-data with an `audio` file (max 2 MB) or `image` file (max 3 MB, optional `text`).
// POST ...?stream=1: the same turn as Server-Sent Events (see src/lib/tutor/runtime/sse.ts for the wire protocol).

const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set(LEARNER_AUDIO_TYPES);
const ALLOWED_IMAGE_TYPES = new Set(LEARNER_IMAGE_TYPES);
const MAX_TEXT_CHARS = 1000;

const textSchema = z.object({
  text: z.string().trim().min(1).max(MAX_TEXT_CHARS),
});

type TurnInput =
  | {
      ok: true;
      text?: string;
      audio?: { bytes: Buffer; mimeType: string };
      image?: { bytes: Buffer; mimeType: string };
    }
  | { ok: false; status: number; error: string };

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!sessionIdSchema.safeParse(id).success) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await loadOwnedSession(id, userId);
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.status !== "active") {
    return NextResponse.json({ error: "Session is not active", status: session.status }, { status: 409 });
  }
  if (session.mode === "live") {
    return NextResponse.json({ error: "Live sessions send events to /events, not turns" }, { status: 409 });
  }
  // P1-06: lesson Ask conversations need lesson access on every turn, not only when they were opened.
  if (!(await askTurnAllowed(session, userId))) {
    return NextResponse.json({ error: "Access denied", reason: "not_enrolled" }, { status: 403 });
  }

  const input = await readTurnInput(req);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: input.status });

  const sessionContext = await loadSessionContext(session);
  const idx = sessionContext.history.length
    ? Math.max(...sessionContext.history.map((t) => t.idx)) + 1
    : 0;

  // When the session is already over, skip transcription and let the pipeline end it.
  const limit = sessionLimitReason({
    idx,
    sessionStartedAtMs: Date.parse(session.started_at),
    maxMinutes: sessionContext.scenario.max_minutes,
    nowMs: Date.now(),
  });

  // Single-pass multimodal turn: send learnerAudio or learnerImage directly into runSessionTurn.
  const learnerText: string | null = !limit && !input.audio ? (input.text ?? null) : null;
  const learnerAudio = !limit ? input.audio : undefined;
  const learnerImage = !limit ? input.image : undefined;

  // P1-05: ?stream=1 answers the same turn as Server-Sent Events (events as they close, then the same body as below).
  if (req.nextUrl.searchParams.get("stream") === "1") {
    return turnStreamResponse({ ctx: sessionContext, idx, learnerText, learnerAudio, learnerImage });
  }

  try {
    const result = await runSessionTurn({
      ctx: sessionContext,
      idx,
      learnerText,
      learnerAudio,
      learnerImage,
      openingInstruction: "",
      deferTts: true,
    });
    return NextResponse.json({
      turnIdx: idx,
      learnerText: result.learnerText ?? learnerText,
      events: result.events,
      ended: result.ended,
      endReason: result.endReason ?? null,
    });
  } catch (err) {
    if (err instanceof TurnConflictError) {
      return NextResponse.json({ error: "Another turn was saved at the same time. Try again." }, { status: 409 });
    }
    console.error("[tutor] turn failed:", err);
    return NextResponse.json({ error: "The teacher could not respond. Try again." }, { status: 502 });
  }
}

async function readTurnInput(req: NextRequest): Promise<TurnInput> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_IMAGE_BYTES + 256 * 1024) {
      return { ok: false, status: 413, error: "Upload is too large (3 MB maximum)" };
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return { ok: false, status: 400, error: "Malformed multipart body" };
    }

    const file = form.get("audio");
    const imageFile = form.get("image");
    const textField = form.get("text");
    const text = typeof textField === "string" ? textField.trim() : "";

    if (imageFile instanceof Blob) {
      if (file instanceof Blob) return { ok: false, status: 400, error: "Send audio or an image, not both" };
      if (imageFile.size > MAX_IMAGE_BYTES) return { ok: false, status: 413, error: "Image is too large (3 MB maximum)" };
      const mimeType = imageFile.type.split(";")[0].trim().toLowerCase();
      if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
        return { ok: false, status: 415, error: "Unsupported image type. Use JPG, PNG or WebP." };
      }
      if (text.length > MAX_TEXT_CHARS) return { ok: false, status: 400, error: "Text is too long" };
      const bytes = Buffer.from(await imageFile.arrayBuffer());
      return {
        ok: true,
        text: text || "Please review this image of my work.",
        image: { bytes, mimeType },
      };
    }

    if (file instanceof Blob) {
      if (text) return { ok: false, status: 400, error: "Send either text or audio, not both" };
      if (file.size > MAX_AUDIO_BYTES) return { ok: false, status: 413, error: "Audio is too large (2 MB maximum)" };
      const mimeType = file.type.split(";")[0].trim().toLowerCase();
      if (!ALLOWED_AUDIO_TYPES.has(mimeType)) {
        return { ok: false, status: 415, error: "Unsupported audio type. Use webm, ogg, wav or mp4." };
      }
      const bytes = Buffer.from(await file.arrayBuffer());
      return { ok: true, audio: { bytes, mimeType } };
    }

    if (!text) return { ok: false, status: 400, error: "Send text, an audio file, or an image" };
    if (text.length > MAX_TEXT_CHARS) return { ok: false, status: 400, error: "Text is too long" };
    return { ok: true, text };
  }

  const parsed = textSchema.safeParse(await readJson(req));
  if (!parsed.success) return { ok: false, status: 400, error: "Send { text } or multipart audio" };
  return { ok: true, text: parsed.data.text };
}
