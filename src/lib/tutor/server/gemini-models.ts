import "server-only";
import { Modality, ThinkingLevel } from "@google/genai";
import { gemini } from "@/lib/ai/gemini";
import { modelFor } from "@/lib/ai/models";
import { parsePcmSampleRate, pcmToWav } from "../audio.ts";
import { geminiAudioMimeType } from "../recording.ts";
import { describeGeminiError, worthTryingAnotherModel } from "../gemini-errors.ts";
import { REPORT_JSON_SCHEMA, REPORT_SYSTEM_PROMPT } from "../report-model.ts";
import { TUTOR_TURN_JSON_SCHEMA } from "../turn-schema.ts";
import type { GenContent, TurnGenerateResult } from "./turn-pipeline.ts";

// Gemini calls that touch no database: turn JSON, transcription, speech and the report. The session
// routes reach them through gemini-calls.ts (which adds storage and Live tokens). The public demo
// routes import this file directly, so they never load the Supabase client.

// Backups when the configured model is not available to this key (404) or rejects the request
// (400): stable models that support the same structured output and speech. Auth and quota errors
// are not retried, since another model would fail the same way.
const TEXT_FALLBACKS = ["gemini-3.5-flash-lite", "gemini-2.5-flash"];
const TTS_FALLBACKS = ["gemini-3.8-flash-tts", "gemini-2.5-flash-preview-tts"];

/** Calls `run` with each model in turn until one succeeds. Throws the first model's error. */
async function withModelFallback<T>(primary: string, fallbacks: string[], run: (model: string) => Promise<T>): Promise<T> {
  const models = [primary, ...fallbacks.filter((m) => m !== primary)];
  let firstError: unknown;
  for (const model of models) {
    try {
      return await run(model);
    } catch (err) {
      const info = describeGeminiError(err);
      console.warn(`[tutor] Gemini ${model} failed (${info.code}${info.status ? ` ${info.status}` : ""}): ${info.detail}`);
      firstError ??= err;
      if (!worthTryingAnotherModel(info)) break;
    }
  }
  throw firstError;
}

/** Gemini 3.x thinks by default; older models do not take thinkingLevel. */
function thinkingFor(model: string) {
  return /^gemini-3/.test(model) ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {};
}

/** Voice and Text turn: structured JSON with the turn schema. */
export async function generateTurnJson(input: {
  systemInstruction: string;
  contents: GenContent[];
}): Promise<TurnGenerateResult & { model: string }> {
  return withModelFallback(modelFor("tutorTurn"), TEXT_FALLBACKS, async (model) => {
    const response = await gemini.models.generateContent({
      model,
      contents: input.contents,
      config: {
        systemInstruction: input.systemInstruction,
        responseMimeType: "application/json",
        responseJsonSchema: TUTOR_TURN_JSON_SCHEMA,
        temperature: 0.8,
        // Thinking tokens count against maxOutputTokens. A 2048 cap left too little room for the
        // JSON, so turns fell back to "could you say that again". Low thinking and a higher cap.
        ...thinkingFor(model),
        maxOutputTokens: 8192,
      },
    });
    return {
      text: response.text,
      totalTokens: response.usageMetadata?.totalTokenCount,
      model,
    };
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
  const parts = [
    {
      inlineData: {
        data: input.bytes.toString("base64"),
        mimeType: geminiAudioMimeType(input.mimeType),
      },
    },
    { text: TRANSCRIBE_INSTRUCTION },
  ];

  const primary = modelFor("tutorTranscribe");
  try {
    const response = await gemini.models.generateContent({
      model: primary,
      contents: [{ role: "user", parts }],
    });
    return {
      text: (response.text ?? "").trim(),
      model: primary,
      totalTokens: response.usageMetadata?.totalTokenCount,
      fellBack: false,
    };
  } catch (err) {
    console.warn(`[tutor] transcribe model ${primary} failed, falling back to turn model:`, err);
  }

  const fallback = modelFor("tutorTurn");
  const response = await gemini.models.generateContent({
    model: fallback,
    contents: [{ role: "user", parts }],
    config: { temperature: 0 },
  });
  return {
    text: (response.text ?? "").trim(),
    model: fallback,
    totalTokens: response.usageMetadata?.totalTokenCount,
    fellBack: true,
  };
}

/** Speech for one line as a WAV file. Raw PCM from Gemini gets a WAV header. Nothing is stored. */
export async function synthesizeSpeechWav(text: string, voice: string): Promise<{ wav: Buffer; model: string; totalTokens?: number }> {
  const { response, model } = await withModelFallback(modelFor("tutorTts"), TTS_FALLBACKS, async (model) => {
    const response = await gemini.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
        },
      },
    });
    return { response, model };
  });

  const inline = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
  if (!inline?.data) throw new Error(`TTS returned no audio (${model})`);

  const raw = Buffer.from(inline.data, "base64");
  const mime = (inline.mimeType ?? "").toLowerCase();
  // Some TTS responses already come as WAV. Raw PCM (audio/L16 or no container) gets a header.
  const wav = mime.startsWith("audio/wav") || mime.startsWith("audio/x-wav") ? raw : pcmToWav(raw, parsePcmSampleRate(inline.mimeType));
  return { wav, model, totalTokens: response.usageMetadata?.totalTokenCount };
}

/** Structured post-session report from the transcript. Throws when the model reply is unusable. */
export async function generateReportJson(input: {
  transcript: string;
  scenarioTitle: string;
  scenarioGoal: string;
  language: string | null;
}): Promise<TurnGenerateResult & { model: string }> {
  return withModelFallback(modelFor("tutorReport"), TEXT_FALLBACKS, async (model) => {
    const response = await gemini.models.generateContent({
      model,
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
      config: {
        systemInstruction: REPORT_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: REPORT_JSON_SCHEMA,
        temperature: 0.3,
        ...thinkingFor(model),
        maxOutputTokens: 8192,
      },
    });
    return {
      text: response.text,
      totalTokens: response.usageMetadata?.totalTokenCount,
      model,
    };
  });
}
