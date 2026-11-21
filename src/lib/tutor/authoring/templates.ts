import type { SceneArtboard } from "../rive-driver.ts";
import type { ScenarioStyle } from "../scenario.ts";

export const AUTHORING_TEMPLATE_IDS = [
  "explain_check",
  "worked_example",
  "role_play",
  "oral_check",
  "debate_defend",
  "revision_sprint",
] as const;

export type AuthoringTemplateId = (typeof AUTHORING_TEMPLATE_IDS)[number];

export type AuthoringTemplateStepHint = {
  id: string;
  label: string;
  hint: string;
};

export type AuthoringTemplate = {
  id: AuthoringTemplateId;
  label: string;
  tagline: string;
  style: ScenarioStyle;
  defaultScene: SceneArtboard;
  maxMinutes: number;
  stepSkeleton: AuthoringTemplateStepHint[];
  promptHints: string;
};

export const AUTHORING_TEMPLATES: readonly AuthoringTemplate[] = [
  {
    id: "explain_check",
    label: "Explain & check",
    tagline: "Break down an idea on the board, then check understanding.",
    style: "guided_lesson",
    defaultScene: "Scene_Classroom",
    maxMinutes: 7,
    stepSkeleton: [
      { id: "hook", label: "Hook & goal", hint: "Connect to everyday life and share the board summary." },
      { id: "explain", label: "Core concept", hint: "Explain one idea clearly with bullet points on the board." },
      { id: "check", label: "Check understanding", hint: "Ask a multiple-choice or explain-back question." },
      { id: "apply", label: "Quick application", hint: "Have the learner apply the concept to one short scenario." },
    ],
    promptHints:
      "Use a guided lesson flow: introduce the core idea with a concrete local example, put crisp bullets on the board, check understanding with a clear question, then let the learner apply it once.",
  },
  {
    id: "worked_example",
    label: "Worked example",
    tagline: "Walk through a problem step by step, then try a twist.",
    style: "guided_lesson",
    defaultScene: "Scene_Classroom",
    maxMinutes: 8,
    stepSkeleton: [
      { id: "problem", label: "Set the problem", hint: "Present a concrete, realistic problem on the board." },
      { id: "walkthrough", label: "Step-by-step", hint: "Model each step in order and reveal lines progressively." },
      { id: "variant", label: "Learner tries a variant", hint: "Give the learner a slightly changed problem to solve." },
      { id: "recap", label: "Verify & recap", hint: "Check the reasoning and note any misconception." },
    ],
    promptHints:
      "Use a worked-example flow: present one concrete worked problem on the board (steps or equation), walk through how to solve it, then hand a slightly different variant to the learner to solve out loud.",
  },
  {
    id: "role_play",
    label: "Role-play",
    tagline: "Practise a real-world situation in character.",
    style: "scene",
    defaultScene: "Scene_Classroom",
    maxMinutes: 8,
    stepSkeleton: [
      { id: "setup", label: "Set the scene", hint: "Assign roles and set the context briefly." },
      { id: "exchange", label: "Core conversation", hint: "Run a realistic back-and-forth covering the key skills." },
      { id: "curveball", label: "Handle a twist", hint: "Introduce one realistic complication or follow-up." },
      { id: "debrief", label: "Debrief", hint: "Step out of character briefly to highlight strengths and one tip." },
    ],
    promptHints:
      "Use an interactive role-play scene: put the scenario brief on the board, play a realistic counterpart (customer, colleague, patient, or manager), include one gentle twist, and close with concise feedback.",
  },
  {
    id: "oral_check",
    label: "Oral check (viva)",
    tagline: "Short spoken check with clear evidence per objective.",
    style: "oral_check",
    defaultScene: "Scene_Studio",
    maxMinutes: 5,
    stepSkeleton: [
      { id: "warmup", label: "Open-ended prompt", hint: "Ask the learner to explain the core idea in their own words." },
      { id: "probe", label: "Targeted follow-up", hint: "Ask a 'why' or 'how' question to test depth." },
      { id: "edge", label: "Apply or compare", hint: "Test a boundary case, mistake to avoid, or real example." },
      { id: "verdict", label: "Confidence & summary", hint: "Ask confidence and summarize objectives met vs to review." },
    ],
    promptHints:
      "Use an oral viva check: keep prompts crisp and neutral without giving away answers early, probe reasoning on each objective, record evidence silently with note_evidence, and conclude with an honest summary.",
  },
  {
    id: "debate_defend",
    label: "Debate / defend",
    tagline: "Take a stance, defend it with evidence, handle a counter.",
    style: "oral_check",
    defaultScene: "Scene_Studio",
    maxMinutes: 7,
    stepSkeleton: [
      { id: "stance", label: "Present the dilemma", hint: "Show two plausible options or a trade-off on the board." },
      { id: "defend", label: "Make the case", hint: "Learner chooses a side and supports it using lesson concepts." },
      { id: "counter", label: "Counter-argument", hint: "Challenge their reasoning with a fair counter-point." },
      { id: "synthesis", label: "Synthesize", hint: "Summarize strong points and any gap in reasoning." },
    ],
    promptHints:
      "Use a structured defend-your-thinking flow: put a realistic trade-off or claim on the board, ask the learner to take a position and justify it, test it with one respectful counter-argument, and summarize.",
  },
  {
    id: "revision_sprint",
    label: "Revision sprint",
    tagline: "Fast 5-minute recall and weak-spot drill.",
    style: "guided_lesson",
    defaultScene: "Scene_Classroom",
    maxMinutes: 5,
    stepSkeleton: [
      { id: "recall", label: "Quick recall", hint: "Rapid check of key terms or facts on the board." },
      { id: "repair", label: "Patch the gap", hint: "Clarify any shaky point with a one-line example." },
      { id: "rapid_check", label: "Final check", hint: "One final question to lock in confidence." },
    ],
    promptHints:
      "Use a brisk 5-minute revision sprint: keep turns punchy, put a compact summary table or checklist on the board, quiz key concepts rapidly, and end with clear next steps.",
  },
];

const TEMPLATE_BY_ID = new Map<AuthoringTemplateId, AuthoringTemplate>(
  AUTHORING_TEMPLATES.map((t) => [t.id, t]),
);

export function getAuthoringTemplate(id?: string | null): AuthoringTemplate {
  if (id && TEMPLATE_BY_ID.has(id as AuthoringTemplateId)) {
    return TEMPLATE_BY_ID.get(id as AuthoringTemplateId)!;
  }
  return AUTHORING_TEMPLATES[0];
}
