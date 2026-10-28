import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { modelFor } from "@/lib/ai/models";
import { describeGeminiError } from "@/lib/tutor/gemini-errors";
import { generateTurnJson, synthesizeSpeechWav } from "@/lib/tutor/server/gemini-models";

// GET /api/tutor/demo/health: checks that Gemini works for the tutor, step by step. Open it in the
// browser while signed in. It makes two tiny model calls (one turn, one short line of speech) and
// reports which model answered, or the exact error. Nothing is stored.

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

type Check = { ok: boolean; model?: string; ms: number; error?: string; code?: string; note?: string };

async function timed(run: () => Promise<Omit<Check, "ms" | "ok">>): Promise<Check> {
  const started = Date.now();
  try {
    return { ok: true, ...(await run()), ms: Date.now() - started };
  } catch (err) {
    const info = describeGeminiError(err);
    return { ok: false, ms: Date.now() - started, code: info.code, error: info.detail };
  }
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in first, then open this page again." }, { status: 401 });

  const keySet = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  const configured = {
    tutorTurn: modelFor("tutorTurn"),
    tutorTts: modelFor("tutorTts"),
    tutorTranscribe: modelFor("tutorTranscribe"),
    tutorReport: modelFor("tutorReport"),
  };
  if (!keySet) {
    return NextResponse.json(
      { ok: false, keySet, configured, error: "GEMINI_API_KEY is not set for this deployment. Add it in Vercel, then redeploy." },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const turn = await timed(async () => {
    const res = await generateTurnJson({
      systemInstruction: 'You are a friendly teacher. Reply with JSON: {"events":[{"type":"say","text":"..."}]}.',
      contents: [{ role: "user", parts: [{ text: "Say hello in one short sentence." }] }],
    });
    const text = res.text ?? "";
    return { model: res.model, note: text ? `${text.length} chars of JSON` : "empty reply" };
  });

  const speech = await timed(async () => {
    const res = await synthesizeSpeechWav("Hello! Welcome to the tea house.", "Kore");
    return { model: res.model, note: `${Math.round(res.wav.length / 1024)} KB of audio` };
  });

  return NextResponse.json(
    {
      ok: turn.ok && speech.ok,
      keySet,
      demoEnabled: process.env.TUTOR_DEMO_ENABLED !== "false",
      configured,
      checks: { turn, speech },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
