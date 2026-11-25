import { requireContentAuthor } from "@/lib/authz/content-author-server";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  evaluateStressResponse,
  STRESS_TEST_PROBES,
  summarizeStressTest,
} from "@/lib/tutor/authoring/stress-test";
import { parseTutorTurn } from "@/lib/tutor/events";
import { generateTurnJson } from "@/lib/tutor/server/gemini-models";
import { meterFor } from "@/lib/ai/meter-server";
import { buildSystemPrompt } from "@/lib/tutor/server/prompt";
import { buildContents } from "@/lib/tutor/server/turn-pipeline";

export const runtime = "nodejs";
export const maxDuration = 45;

const stressTestSchema = z.object({
  title: z.string().trim().min(2).max(160),
  goal: z.string().trim().min(5).max(800),
  skillPack: z.string().trim().min(1).max(60).default("general-tutor"),
  level: z.string().trim().max(40).optional().nullable(),
  maxMinutes: z.number().int().min(1).max(30).default(8),
  beats: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(60),
        goal: z.string().trim().min(1).max(600),
      }),
    )
    .max(12)
    .default([]),
  targetItems: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(160),
        pron: z.string().trim().max(160).optional(),
        meaning: z.string().trim().max(240).optional(),
      }),
    )
    .max(20)
    .default([]),
  personaName: z.string().trim().max(80).optional(),
  personalityPrompt: z.string().trim().max(2000).optional(),
  languages: z.array(z.string().trim().max(20)).max(6).optional(),
});

/**
 * POST /api/ai/teacher/stress-test
 * Runs 3 simulated student personas (struggling, off-topic, confident) in parallel against a draft flow
 * so teachers can verify guardrails, scaffolding, and conciseness before publishing.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const notAuthor = await requireContentAuthor(userId);
  if (notAuthor) return notAuthor;

  const body = await req.json().catch(() => null);
  const parsed = stressTestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid flow payload", issues: parsed.error.issues }, { status: 400 });
  }

  const flow = parsed.data;
  const systemInstruction = buildSystemPrompt({
    scenario: {
      title: flow.title,
      goal: flow.goal,
      beats: flow.beats,
      targetItems: flow.targetItems,
      level: flow.level ?? null,
      maxMinutes: flow.maxMinutes,
    },
    persona: {
      name: flow.personaName || "Tinashe",
      displayName: flow.personaName || "Tinashe",
      languages: flow.languages?.length ? flow.languages : ["en"],
      personalityPrompt:
        flow.personalityPrompt ||
        "Warm, concise, encouraging AI teacher who checks understanding with concrete examples.",
    },
    skillPack: flow.skillPack,
    learnerProfile: {
      levelEstimate: flow.level ?? null,
      recentMistakes: [],
      memoryNotes: [],
    },
    lessonText: "",
    mode: "text",
  });

  const simulatedHistory = [
    {
      idx: 0,
      learner_text: null,
      events: [
        {
          type: "say",
          text: `Welcome! Today we're working on "${flow.title}". Ready to start?`,
        },
        { type: "listen" },
      ],
    },
  ];

  const meter = await meterFor(userId);
  try {
    const cases = await Promise.all(
      STRESS_TEST_PROBES.map(async (probe) => {
        try {
          const contents = buildContents(simulatedHistory, probe.learnerMessage, "");
          const generated = await generateTurnJson({ systemInstruction, contents, meter });
          const parsedTurn = parseTutorTurn(generated.text ?? "");
          if (parsedTurn.ok && parsedTurn.events.length > 0) {
            return evaluateStressResponse(probe, parsedTurn.events, false);
          }
          return evaluateStressResponse(probe, [], true);
        } catch {
          return evaluateStressResponse(probe, [], true);
        }
      }),
    );

    return NextResponse.json({ summary: summarizeStressTest(cases) });
  } catch (err) {
    console.error("[tutor/stress-test] failed:", err);
    return NextResponse.json({ error: "Could not complete stress test. Try again." }, { status: 502 });
  }
}
