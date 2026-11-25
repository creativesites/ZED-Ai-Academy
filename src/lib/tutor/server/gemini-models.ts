import "server-only";
import { aiCall, aiSpeech, aiStream, type AiMeter } from "@/lib/ai/call";
import type { TextRequestInput } from "@/lib/ai/call-core";
import { modelFor } from "@/lib/ai/models";
import type { AiContent } from "@/lib/ai/provider";
import { parsePcmSampleRate, pcmToWav } from "../audio.ts";
import { geminiAudioMimeType } from "../recording.ts";
import { REPORT_JSON_SCHEMA, REPORT_SYSTEM_PROMPT } from "../report-model.ts";
import { TUTOR_TURN_JSON_SCHEMA } from "../turn-schema.ts";
import type { GenContent, TurnGenerateResult } from "./turn-pipeline.ts";

// Tutor model calls that touch no database: turn JSON, transcription, speech and the report. They all go through
// `aiCall` (model + fallback chain from models.ts, error classification, timing). The session routes reach them
// through gemini-calls.ts (which adds storage and Live tokens); the public demo routes import this file directly.
//
// Metering: by default the CALLER meters these (session turns, reports and TTS write a ledger row with the session
// id; the public demo is budgeted per IP), so `aiCall` is told `{ by: "caller" }`. Callers without their own
// metering pass `meter`.

const CALLER_METERS: AiMeter = { by: "caller", reason: "tutor session/demo routes record usage themselves" };

type TurnJsonInput = {
  systemInstruction: string;
  contents: GenContent[];
  audio?: { bytes: Buffer; mimeType: string };
  image?: { bytes: Buffer; mimeType: string };
  cachedContent?: string;
  meter?: AiMeter;
};

/** Voice and Text turn: structured JSON with the turn schema. Supports inline multimodal audio or work images. */
export async function generateTurnJson(input: TurnJsonInput): Promise<TurnGenerateResult & { model: string }> {
  const result = await aiCall("tutorTurn", turnJsonRequest(input), { meter: input.meter ?? CALLER_METERS });
  return {
    text: result.text,
    totalTokens: result.usage.totalTokens,
    // P2-06 telemetry: prompt, output and context-cache tokens per turn.
    usage: {
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cachedTokens: result.usage.cachedTokens,
    },
    model: result.model,
  };
}

/**
 * The same turn request as `generateTurnJson`, streamed (P1-05). Fallback to another model applies only to opening
 * the stream. Metering is the caller's (it records usage once the stream ends), unless `meter` is given.
 */
export async function streamTurnJson(input: TurnJsonInput): Promise<{
  model: string;
  stream: AsyncIterable<{
    text: string;
    usage?: { totalTokens?: number; inputTokens?: number; outputTokens?: number; cachedTokens?: number };
  }>;
}> {
  const result = await aiStream("tutorTurn", turnJsonRequest(input), { meter: input.meter ?? CALLER_METERS });
  return { model: result.model, stream: result.stream };
}

function turnJsonRequest(input: TurnJsonInput): TextRequestInput {
  const lastTurnText = input.contents[input.contents.length - 1]?.parts?.[0]?.text ?? "";
  const contents: AiContent[] = input.audio
    ? [
        ...input.contents.slice(0, -1),
        {
          role: "user" as const,
          parts: [
            {
              inlineData: {
                data: input.audio.bytes.toString("base64"),
                mimeType: geminiAudioMimeType(input.audio.mimeType),
              },
            },
            {
              text: "Listen to the learner's spoken reply above. Put their verbatim transcript in `learnerText` and respond as the teacher in `events`. If no speech is audible, set `learnerText` to an empty string and gently ask them to repeat.",
            },
          ],
        },
      ]
    : input.image
      ? [
          ...input.contents.slice(0, -1),
          {
            role: "user" as const,
            parts: [
              {
                inlineData: {
                  data: input.image.bytes.toString("base64"),
                  mimeType: input.image.mimeType,
                },
              },
              {
                text: lastTurnText && lastTurnText !== "Learner: [shared work image]"
                  ? `${lastTurnText}\n\nExamine the learner's uploaded image of their work above carefully. Point out what they did well, spot any specific mistake or gap, and guide them step by step using show_board if helpful.`
                  : "The learner uploaded a photo/screenshot of their work above. Examine it carefully, praise what they did well, point out any specific error or next step, and guide them warmly using show_board if helpful.",
              },
            ],
          },
        ]
      : input.contents;

  const primary = modelFor("tutorTurn");
  return (model) => ({
    contents,
    // The context cache was created for the primary model only; fallbacks get the inline system instruction.
    ...(input.cachedContent && model === primary
      ? { cachedContent: input.cachedContent }
      : { systemInstruction: input.systemInstruction }),
    responseJsonSchema: TUTOR_TURN_JSON_SCHEMA,
    temperature: 0.8,
    thinking: "minimal",
    maxOutputTokens: 4096,
  });
}

const TRANSCRIBE_INSTRUCTION =
  "Transcribe the learner's speech in this audio verbatim, in the language they spoke. Output only the transcript, with no quotes, labels or commentary. If there is no speech, output nothing.";

/**
 * Learner audio to text. Tries the transcription model first. If that model cannot be called this
 * way (the SDK sends any model id, so failure shows up at request time), falls back to the turn
 * model with the same audio and a verbatim-transcription instruction.
 */
export async function transcribeLearnerAudio(input: { bytes: Buffer; mimeType: string }): Promise<{
  text: string;
  model: string;
  totalTokens?: number;
  fellBack: boolean;
}> {
  const contents: AiContent[] = [
    {
      role: "user",
      parts: [
        {
          inlineData: {
            data: input.bytes.toString("base64"),
            mimeType: geminiAudioMimeType(input.mimeType),
          },
        },
        { text: TRANSCRIBE_INSTRUCTION },
      ],
    },
  ];

  const primary = modelFor("tutorTranscribe");
  try {
    const result = await aiCall("tutorTranscribe", { contents }, { meter: CALLER_METERS, models: [primary] });
    return { text: result.text.trim(), model: result.model, totalTokens: result.usage.totalTokens, fellBack: false };
  } catch (err) {
    console.warn(`[tutor] transcribe model ${primary} failed, falling back to turn model:`, err);
  }

  const fallback = modelFor("tutorTurn");
  const result = await aiCall(
    "tutorTranscribe",
    { contents, temperature: 0 },
    { meter: CALLER_METERS, models: [fallback] },
  );
  return { text: result.text.trim(), model: result.model, totalTokens: result.usage.totalTokens, fellBack: true };
}

/** Speech for one line as a WAV file. Raw PCM from Gemini gets a WAV header. Nothing is stored. */
export async function synthesizeSpeechWav(
  text: string,
  voice: string,
): Promise<{ wav: Buffer; model: string; totalTokens?: number }> {
  const result = await aiSpeech("tutorTts", { text, voice }, { meter: CALLER_METERS });
  const raw = Buffer.from(result.audio.data, "base64");
  const mime = result.audio.mimeType.toLowerCase();
  // Some TTS responses already come as WAV. Raw PCM (audio/L16 or no container) gets a header.
  const wav =
    mime.startsWith("audio/wav") || mime.startsWith("audio/x-wav")
      ? raw
      : pcmToWav(raw, parsePcmSampleRate(result.audio.mimeType));
  return { wav, model: result.model, totalTokens: result.usage.totalTokens };
}

/** Structured post-session report from the transcript. Throws when the model reply is unusable. */
export async function generateReportJson(input: {
  transcript: string;
  scenarioTitle: string;
  scenarioGoal: string;
  language: string | null;
}): Promise<TurnGenerateResult & { model: string }> {
  const result = await aiCall(
    "tutorReport",
    {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Scenario: ${input.scenarioTitle}\nGoal: ${input.scenarioGoal}\nLanguage: ${input.language ?? "unspecified"}\n\nTranscript:\n${input.transcript}`,
            },
          ],
        },
      ],
      systemInstruction: REPORT_SYSTEM_PROMPT,
      responseJsonSchema: REPORT_JSON_SCHEMA,
      temperature: 0.3,
      thinking: "minimal",
      maxOutputTokens: 8192,
    },
    { meter: CALLER_METERS },
  );
  return { text: result.text, totalTokens: result.usage.totalTokens, model: result.model };
}
