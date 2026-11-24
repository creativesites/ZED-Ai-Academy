import type { TutorEvent } from "../events.ts";

// Pure simulated-student QA stress-test definitions and evaluator for Creator Studio.
// Tests a draft AI Teacher flow against three realistic student personas before publishing.

export type StressPersonaId = "struggling" | "off_topic" | "confident";

export type StressProbe = {
  id: StressPersonaId;
  label: string;
  description: string;
  learnerMessage: string;
};

export const STRESS_TEST_PROBES: readonly StressProbe[] = [
  {
    id: "struggling",
    label: "Struggling learner",
    description: "Feels lost and asks for a simpler breakdown.",
    learnerMessage: "Honestly I'm totally lost and don't get this at all. Can you simplify it?",
  },
  {
    id: "off_topic",
    label: "Off-topic distraction",
    description: "Tries to steer the AI teacher away from the lesson.",
    learnerMessage: "Forget the lesson for a minute—who do you think will win the football match this weekend?",
  },
  {
    id: "confident",
    label: "Confident / fast learner",
    description: "Gives a quick confident answer and asks to be tested.",
    learnerMessage: "Got it, that makes sense! Give me a quick check question to test if I really understand.",
  },
];

export type StressCaseResult = {
  id: StressPersonaId;
  label: string;
  learnerMessage: string;
  teacherReply: string;
  eventTypes: string[];
  passed: boolean;
  checks: Array<{ label: string; ok: boolean; note: string }>;
};

export type StressTestSummary = {
  overallScore: number; // 0..100
  passedCount: number;
  totalCount: number;
  cases: StressCaseResult[];
};

const OFF_TOPIC_DRIFT = /\b(chelsea|arsenal|manchester|liverpool|real madrid|barcelona|chipolopolo|premier league|world cup|champions league)\b/i;

export function evaluateStressResponse(
  probe: StressProbe,
  events: readonly TutorEvent[],
  fallbackUsed: boolean,
): StressCaseResult {
  const sayLines = events
    .filter((e): e is Extract<TutorEvent, { type: "say" }> => e.type === "say")
    .map((e) => e.text.trim())
    .filter(Boolean);
  const teacherReply = sayLines.join(" ");
  const eventTypes = Array.from(new Set(events.map((e) => e.type)));
  const wordCount = teacherReply ? teacherReply.split(/\s+/).length : 0;

  const checks: Array<{ label: string; ok: boolean; note: string }> = [];

  checks.push({
    label: "Valid structured turn",
    ok: !fallbackUsed && sayLines.length > 0,
    note: fallbackUsed ? "Model output fell back to apology." : "Produced clean spoken teacher events.",
  });

  checks.push({
    label: "Concise pacing",
    ok: wordCount > 0 && wordCount <= 85,
    note: wordCount > 85 ? `Long reply (${wordCount} words) — aim for 1–3 crisp sentences.` : `${wordCount} words — crisp and conversational.`,
  });

  if (probe.id === "struggling") {
    const usedScaffold = events.some(
      (e) => e.type === "show_board" || e.type === "ask_choice" || e.type === "ask_confidence" || e.type === "show_card",
    );
    checks.push({
      label: "Uses visual scaffolding",
      ok: usedScaffold,
      note: usedScaffold
        ? "Used board/card/check tools to support a confused learner."
        : "Replied with speech only; adding a board example or quick check helps struggling learners.",
    });
  } else if (probe.id === "off_topic") {
    const stayedOnTopic = !OFF_TOPIC_DRIFT.test(teacherReply);
    checks.push({
      label: "Stays on lesson guardrails",
      ok: stayedOnTopic,
      note: stayedOnTopic
        ? "Kindly redirected back to the lesson without engaging in off-topic chat."
        : "Drifted into off-topic sports talk instead of redirecting.",
    });
  } else if (probe.id === "confident") {
    const checkedUnderstanding = events.some(
      (e) => e.type === "ask_choice" || e.type === "listen" || e.type === "note_evidence" || e.type === "show_board",
    );
    checks.push({
      label: "Checks mastery actively",
      ok: checkedUnderstanding,
      note: checkedUnderstanding
        ? "Challenged the learner with an active check or prompt."
        : "Did not emit ask_choice, listen, or note_evidence to verify mastery.",
    });
  }

  const passed = checks.every((c) => c.ok);
  return {
    id: probe.id,
    label: probe.label,
    learnerMessage: probe.learnerMessage,
    teacherReply: teacherReply || "(no spoken reply)",
    eventTypes,
    passed,
    checks,
  };
}

export function summarizeStressTest(cases: StressCaseResult[]): StressTestSummary {
  const totalChecks = cases.reduce((acc, c) => acc + c.checks.length, 0);
  const okChecks = cases.reduce((acc, c) => acc + c.checks.filter((k) => k.ok).length, 0);
  const overallScore = totalChecks > 0 ? Math.round((okChecks / totalChecks) * 100) : 0;
  return {
    overallScore,
    passedCount: cases.filter((c) => c.passed).length,
    totalCount: cases.length,
    cases,
  };
}
