import "server-only";

// Gemini model per AI task. Override one task with GEMINI_MODEL_<TASK> (e.g. GEMINI_MODEL_LESSON_CONTENT),
// or every text task with GEMINI_MODEL_DEFAULT. Env overrides take effect without a code deploy.

export type AiTask =
  | "tutor" | "practiceStudio" | "editBlock" | "siteIntelligence" | "brandingAssistant" // interactive, latency-sensitive
  | "lessonContent" | "curriculum" | "courseBlueprint" | "quiz" | "practiceExercise" | "practiceScoring" // quality-sensitive generation
  | "tutorTurn" | "tutorReport" // ZAI Tutor text reasoning
  | "tutorLive" | "tutorTts" | "tutorTranscribe" // ZAI Tutor audio models (not text models)
  | "image";

export const DEFAULT_MODELS: Record<AiTask, string> = {
  tutor: "gemini-3.5-flash-lite",
  practiceStudio: "gemini-3.5-flash-lite",
  editBlock: "gemini-3.5-flash-lite",
  siteIntelligence: "gemini-3.5-flash-lite",
  brandingAssistant: "gemini-3.5-flash-lite",
  lessonContent: "gemini-3.8-flash",
  curriculum: "gemini-3.8-flash",
  courseBlueprint: "gemini-3.8-flash",
  quiz: "gemini-3.8-flash",
  practiceExercise: "gemini-3.8-flash",
  practiceScoring: "gemini-3.8-flash",
  tutorTurn: "gemini-3.8-flash",
  tutorReport: "gemini-3.8-flash",
  tutorLive: "gemini-3.8-live",
  tutorTts: "gemini-3.8-flash-lite-tts",
  tutorTranscribe: "gemini-3.5-transcribe",
  image: "gemini-3.1-flash-image-preview",
};

// Tasks served by a model family that the text-wide default must never override:
// image generation, Live audio, TTS and transcription. Each still honours its own GEMINI_MODEL_<TASK> override.
const NON_TEXT_TASKS: ReadonlySet<AiTask> = new Set<AiTask>([
  "image",
  "tutorLive",
  "tutorTts",
  "tutorTranscribe",
]);

function envValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function modelFor(task: AiTask): string {
  const snake = task.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
  const fallback = NON_TEXT_TASKS.has(task) ? undefined : envValue("GEMINI_MODEL_DEFAULT");
  return envValue(`GEMINI_MODEL_${snake}`) ?? fallback ?? DEFAULT_MODELS[task];
}
