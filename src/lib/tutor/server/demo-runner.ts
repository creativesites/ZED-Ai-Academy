import "server-only";
import { createDemoRateLimiter, DEMO_TURNS_PER_HOUR, DEMO_WINDOW_MS, demoHistoryToTurns, demoSpeechDataUrl, demoWrapUpInstruction, type DemoHistoryEntry } from "../demo.ts";
import type { DemoScenario } from "../demo-scenarios.ts";
import { buildTranscript, parseTutorReport, type TutorReportContent } from "../report-model.ts";
import { generateReportJson, generateTurnJson, synthesizeSpeechWav } from "./gemini-models.ts";
import { buildSystemPrompt } from "./prompt.ts";
import { fallbackLanguageFor, runTutorTurn, type TurnPipelineResult } from "./turn-pipeline.ts";

// Runs the showcase demo with the real prompt builder and turn pipeline and in-memory deps: no
// database reads or writes, no usage metering, TTS returned inline as data URLs. Only the public
// /api/tutor/demo routes use this file.

/**
 * Best-effort budget for demo model calls, shared by the turn and report routes. It lives in
 * process memory, so each serverless instance keeps its own count.
 */
export const demoRateLimiter = createDemoRateLimiter({ limit: DEMO_TURNS_PER_HOUR, windowMs: DEMO_WINDOW_MS });

const OPENING_INSTRUCTION =
  "Open the scenario now. Greet the learner in character, set up the first beat, and hand the turn over with listen.";

export function demoSystemInstruction(scenario: DemoScenario, wrapUp: string | null): string {
  const base = buildSystemPrompt({
    scenario: {
      title: scenario.title,
      goal: scenario.goal,
      beats: scenario.beats.map((b) => ({ id: b.id, goal: b.goal })),
      targetItems: scenario.targetItems,
      level: scenario.level,
      roleNotes: scenario.roleNotes ?? null,
      maxMinutes: scenario.maxMinutes,
    },
    persona: {
      name: scenario.persona.name,
      displayName: scenario.persona.displayName,
      languages: scenario.persona.languages,
      personalityPrompt: scenario.persona.personalityPrompt,
    },
    skillPack: scenario.skillPack,
    learnerProfile: { levelEstimate: scenario.level, recentMistakes: [], memoryNotes: [] },
    lessonText: "",
    mode: "voice",
  });
  return wrapUp ? `${base}\n\n---\n\nDemo rule: ${wrapUp}` : base;
}

/** One demo exchange. `text` is the learner's words, or null for the opening. */
export async function runDemoTurn(input: {
  scenario: DemoScenario;
  history: DemoHistoryEntry[];
  text: string | null;
  elapsedMs: number;
}): Promise<TurnPipelineResult> {
  const { scenario, history, text, elapsedMs } = input;
  const learnerTurn = text !== null;
  const wrapUp = demoWrapUpInstruction({ history, learnerTurn });
  const turns = demoHistoryToTurns(history);

  return runTutorTurn(
    {
      sessionStartedAtMs: Date.now() - elapsedMs,
      maxMinutes: scenario.maxMinutes,
      idx: turns.length,
      learnerText: text,
      openingInstruction: OPENING_INSTRUCTION,
      systemInstruction: demoSystemInstruction(scenario, wrapUp),
      voice: scenario.persona.voiceName,
      history: turns,
      fallbackLanguage: fallbackLanguageFor(scenario.language),
    },
    {
      now: () => Date.now(),
      generate: generateTurnJson,
      synthesize: async (line, voice) => {
        const speech = await synthesizeSpeechWav(line, voice);
        return demoSpeechDataUrl(speech.wav);
      },
      saveTurn: async () => undefined,
    },
  );
}

/** The end-of-demo report from the in-memory transcript. Throws when the model reply is unusable. */
export async function runDemoReport(scenario: DemoScenario, history: DemoHistoryEntry[]): Promise<TutorReportContent> {
  const generated = await generateReportJson({
    transcript: buildTranscript(demoHistoryToTurns(history)),
    scenarioTitle: scenario.title,
    scenarioGoal: scenario.goal,
    language: scenario.language,
  });
  const parsed = parseTutorReport(generated.text);
  if (!parsed.ok) throw new Error(`demo report unusable: ${parsed.error}`);
  return parsed.report;
}
