import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { isDemoEnabled, parseDemoReport } from "@/lib/tutor/demo";
import { demoScenario } from "@/lib/tutor/demo-scenarios";
import { demoRateLimiter, runDemoReport } from "@/lib/tutor/server/demo-runner";
import { describeGeminiError } from "@/lib/tutor/gemini-errors";

// POST /api/tutor/demo/report: { scenarioKey, history } -> { report }. Stateless, nothing is written.
// Shares the demo budget with /api/tutor/demo/turn.

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDemoEnabled(process.env.TUTOR_DEMO_ENABLED)) {
    return NextResponse.json({ error: "The live demo is paused. Try the watch-only demo." }, { status: 503 });
  }

  const json = await req.json().catch(() => null);
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return NextResponse.json({ error: "Send a JSON object" }, { status: 400 });
  }
  const body = json as { scenarioKey?: unknown; history?: unknown };

  const parsed = parseDemoReport({ scenarioKey: body.scenarioKey, history: body.history });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const scenario = demoScenario(parsed.value.scenarioKey);
  if (!scenario) return NextResponse.json({ error: "Unknown scenario" }, { status: 400 });

  const budget = demoRateLimiter.take(userId);
  if (!budget.ok) {
    return NextResponse.json(
      { error: "You have used this hour's demo turns. Try again later, or sign up for a full session." },
      { status: 429, headers: { "Retry-After": String(budget.retryAfterSec) } },
    );
  }

  try {
    const report = await runDemoReport(scenario, parsed.value.history);
    return NextResponse.json({ report });
  } catch (err) {
    const info = describeGeminiError(err);
    console.error("[tutor] demo report failed:", info.code, info.detail);
    return NextResponse.json(
      { error: "The report could not be generated. Try again.", reason: `gemini_${info.code}`, detail: info.detail },
      { status: 502 },
    );
  }
}
