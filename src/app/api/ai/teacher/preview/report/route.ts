import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { canManageCourse } from "@/lib/courses/course-auth-server";
import { ZEDAI_TENANT_ID } from "@/lib/tenants/constants";
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
  let companyId: string | null = null;

  if (flow.courseId) {
    const { allowed, course } = await canManageCourse(createClient(), flow.courseId, userId);
    if (!allowed || !course) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    companyId = course.company_id ?? ZEDAI_TENANT_ID;
  } else if (flow.companyId) {
    const db = createServiceClient();
    const [{ data: profile }, { data: company }, { data: member }] = await Promise.all([
      db.from("profiles").select("role").eq("id", userId).maybeSingle(),
      db.from("companies").select("admin_id").eq("id", flow.companyId).maybeSingle(),
      db
        .from("company_members")
        .select("role, status")
        .eq("company_id", flow.companyId)
        .eq("profile_id", userId)
        .maybeSingle(),
    ]);
    if (
      profile?.role === "super_admin" ||
      company?.admin_id === userId ||
      (member?.status === "active" && ["company_admin", "teacher", "instructor"].includes(member.role))
    ) {
      companyId = flow.companyId;
    }
  }
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
