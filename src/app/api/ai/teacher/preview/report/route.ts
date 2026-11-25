import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { authorizeFlowPreview } from "@/lib/authz/context-server";
import { describeGeminiError } from "@/lib/tutor/gemini-errors";
import { buildTranscript, parseTutorReport } from "@/lib/tutor/report-model";
import { skillPackLanguage } from "@/lib/tutor/skill-packs";
import { generateReportJson } from "@/lib/tutor/server/gemini-calls";
import { recordUsage } from "@/lib/tutor/server/usage";
import { previewHistoryToTurns, previewReportJsonSchema } from "@/lib/tutor/authoring/preview";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = previewReportJsonSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid preview report request" }, { status: 400 });
  }

  const { flow, history } = parsed.data;
  const authResult = await authorizeFlowPreview(userId, flow);
  const companyId = authResult.allowed ? authResult.companyId : null;
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const turns = previewHistoryToTurns(history);
  const hasSpeech = turns.some((t) => typeof t.learner_text === "string" && t.learner_text.trim().length > 0);
  if (!hasSpeech) {
    return NextResponse.json({
      report: {
        scores: { fluency: 0, accuracy: 0, vocabulary: 0, overall: 0 },
        strengths: ["Preview ended before a student response was sent."],
        mistakes: [],
        tone_stats: {},
        next_step: "Send at least one response in preview to see the full teacher feedback.",
      },
    });
  }

  try {
    const generated = await generateReportJson({
      transcript: buildTranscript(turns),
      scenarioTitle: flow.title,
      scenarioGoal: flow.goal,
      language: skillPackLanguage(flow.skillPack),
    });

    await recordUsage({
      companyId,
      userId,
      sessionId: null,
      model: generated.model,
      kind: "llm",
      units: generated.totalTokens ?? 0,
      unit: "tokens",
    });

    const parsedReport = parseTutorReport(generated.text);
    if (!parsedReport.ok) {
      return NextResponse.json({ error: parsedReport.error }, { status: 502 });
    }
    return NextResponse.json({ report: parsedReport.report });
  } catch (err) {
    const info = describeGeminiError(err);
    return NextResponse.json(
      { error: "Preview report could not be generated.", reason: `gemini_${info.code}`, detail: info.detail },
      { status: 502 },
    );
  }
}
