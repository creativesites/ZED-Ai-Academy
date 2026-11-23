import type { ReportObjectiveOutcome, TutorReportContent } from "./report-model.ts";

export const VIVA_PASS_TASK_SCORE = 65;

export type VivaEvaluation = {
  passed: boolean;
  reason: string;
  metCount: number;
  totalObjectives: number;
};

/**
 * Evaluates a Certificate Viva report (`oral_check`) against objective outcomes
 * (or fallback `scores.task` when a session produced no `note_evidence`).
 */
export function evaluateVivaOutcome(report: {
  objectives?: ReadonlyArray<Pick<ReportObjectiveOutcome, "status">> | null;
  scores?: TutorReportContent["scores"] | null;
}): VivaEvaluation {
  const objectives = Array.isArray(report.objectives) ? report.objectives : [];
  if (objectives.length > 0) {
    const reviewCount = objectives.filter((o) => o.status === "review").length;
    const metCount = objectives.filter((o) => o.status === "met").length;
    const neededMet = Math.ceil(objectives.length / 2);

    if (reviewCount === 0 && metCount >= neededMet) {
      return {
        passed: true,
        reason: `Demonstrated ${metCount} of ${objectives.length} viva objectives cleanly.`,
        metCount,
        totalObjectives: objectives.length,
      };
    }

    return {
      passed: false,
      reason:
        reviewCount > 0
          ? `${reviewCount} objective(s) still need review before your certificate can be issued.`
          : `Show confident mastery on at least ${neededMet} of ${objectives.length} viva checks (currently ${metCount}).`,
      metCount,
      totalObjectives: objectives.length,
    };
  }

  const taskScore = report.scores?.task;
  if (typeof taskScore === "number") {
    const passed = taskScore >= VIVA_PASS_TASK_SCORE;
    return {
      passed,
      reason: passed
        ? `Viva oral check passed (task score ${taskScore}/100).`
        : `Viva task score was ${taskScore}/100 (need ${VIVA_PASS_TASK_SCORE}+ to pass).`,
      metCount: 0,
      totalObjectives: 0,
    };
  }

  return {
    passed: false,
    reason: "Complete the oral viva conversation with the AI teacher so your understanding can be checked.",
    metCount: 0,
    totalObjectives: 0,
  };
}

/**
 * Builds the system prompt for Gemini to synthesize a course-wide Certificate Viva (`oral_check`).
 */
export function buildCourseVivaPrompt(input: {
  courseTitle: string;
  courseDescription: string | null;
  lessonSummaries: ReadonlyArray<{ title: string; summary: string }>;
  teacherName: string;
}): string {
  const lessonsText = input.lessonSummaries
    .slice(0, 12)
    .map((l, idx) => `${idx + 1}. ${l.title}${l.summary ? `: ${l.summary}` : ""}`)
    .join("\n");

  return [
    `Create an end-of-course Certificate Viva (oral check) flow for "${input.courseTitle}".`,
    input.courseDescription ? `Course summary: ${input.courseDescription}` : null,
    `The AI teacher "${input.teacherName}" will ask the learner to defend and apply what they learned in plain words.`,
    "Requirements:",
    "- Use style = \"oral_check\", skillPack = \"general-tutor\", scene = \"Scene_Studio\", maxMinutes = 8.",
    "- Design 3 to 5 clear viva check steps covering the core concepts across these lessons (not trivial trivia).",
    "- Each step must include a crisp checkQuestion asking the learner to explain 'why' or apply to a real Zambian workplace/community scenario.",
    "Lessons covered:",
    lessonsText || "(No detailed lesson text provided; focus on the course title.)",
  ]
    .filter(Boolean)
    .join("\n");
}
