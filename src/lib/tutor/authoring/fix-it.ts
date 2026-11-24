// Pure builder for 1-click "3-min Fix-It Flow" remediation scenarios from misconception clusters.
// Pure: no I/O or "@/" imports so node:test runs it directly.

export type MisconceptionFixItInput = {
  objectiveText: string;
  sampleDetails: string[];
  misconceptionCount: number;
  partialCount: number;
};

export type GeneratedFixItFlow = {
  title: string;
  goal: string;
  maxMinutes: number;
  style: "guided_lesson";
  skillPack: "general-tutor";
  scene: "Scene_Classroom";
  level: string;
  beats: Array<{
    id: string;
    goal: string;
    boardContent: string;
    checkQuestion: string;
  }>;
  targetItems: Array<{ text: string; meaning: string }>;
};

export function buildFixItFlowFromMisconception(
  input: MisconceptionFixItInput,
): GeneratedFixItFlow {
  const cleanObjective = input.objectiveText.trim().slice(0, 120) || "Core concept review";
  const clues = input.sampleDetails
    .map((d) => d.trim())
    .filter(Boolean)
    .slice(0, 3);

  const clueNote =
    clues.length > 0
      ? `Common learner stumbling blocks observed: ${clues.join(" | ")}`
      : "Learners frequently hesitate or mix up the core distinction.";

  const title = `Fix-It (3m): ${cleanObjective}`.slice(0, 140);
  const goal = `Clear up the common misconception around "${cleanObjective}" using one concrete everyday example and two quick mastery checks. ${clueNote}`.slice(
    0,
    590,
  );

  return {
    title,
    goal,
    maxMinutes: 3,
    style: "guided_lesson",
    skillPack: "general-tutor",
    scene: "Scene_Classroom",
    level: "Remediation",
    beats: [
      {
        id: "spot_trap",
        goal: `Contrast the common mistake with the right mental model for "${cleanObjective}". ${clueNote}`,
        boardContent:
          clues.length > 0
            ? `Common trap: ${clues[0]}\nKey shift: Focus on ${cleanObjective}`
            : `Key focus: ${cleanObjective}`,
        checkQuestion: `Which part of "${cleanObjective}" usually trips people up first?`,
      },
      {
        id: "worked_example",
        goal: `Walk through one short, concrete local example demonstrating "${cleanObjective}" step by step, then ask the learner to choose the right move via ask_choice.`,
        boardContent: `Step 1: Identify the goal\nStep 2: Apply ${cleanObjective}\nStep 3: Double-check the result`,
        checkQuestion: `In this example, which step applies "${cleanObjective}" correctly?`,
      },
      {
        id: "verify_mastery",
        goal: `Ask the learner to apply "${cleanObjective}" in one fresh 1-sentence scenario, log note_evidence for "${cleanObjective}", award progress if solid, and wrap up warmly.`,
        boardContent: `Final check: Apply "${cleanObjective}" in your own words.`,
        checkQuestion: `How would you apply "${cleanObjective}" to a fresh situation?`,
      },
    ],
    targetItems: [
      {
        text: cleanObjective.slice(0, 120),
        meaning: clues[0]?.slice(0, 180) ?? "Core concept to clarify and verify",
      },
    ],
  };
}
