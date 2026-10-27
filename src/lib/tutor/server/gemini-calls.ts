import "server-only";
import { Modality, type LiveConnectConfig } from "@google/genai";
import { gemini } from "@/lib/ai/gemini";
import { modelFor } from "@/lib/ai/models";
import { createServiceClient } from "@/lib/supabase/server";
import { liveToolDeclarations } from "../events.ts";
import { parsePcmSampleRate, pcmToWav, ttsCachePath } from "../audio.ts";
import { REPORT_JSON_SCHEMA, REPORT_SYSTEM_PROMPT } from "../report-model.ts";
import { TUTOR_TURN_JSON_SCHEMA } from "../turn-schema.ts";
import type { GenContent, TurnGenerateResult } from "./turn-pipeline.ts";

// Thin wrappers around @google/genai for the tutor. Everything that talks to Gemini goes through
// here, so routes and pipelines can be read without SDK details. Nothing here is unit tested
// (no keys in the build environment); the SDK surface was checked against @google/genai 1.52.0.

export const TTS_BUCKET = "tutor-tts-cache";

export const LIVE_TOKEN_TTL_MS = 30 * 60_000;
export const LIVE_NEW_SESSION_WINDOW_MS = 2 * 60_000;

/** Voice and Text turn: structured JSON with the turn schema. */
export async function generateTurnJson(input: {
  systemInstruction: string;
  contents: GenContent[];
}): Promise<TurnGenerateResult & { model: string }> {
  const model = modelFor("tutorTurn");
  const response = await gemini.models.generateContent({
    model,
    contents: input.contents,
    config: {
      systemInstruction: input.systemInstruction,
      responseMimeType: "application/json",
      responseJsonSchema: TUTOR_TURN_JSON_SCHEMA,
      temperature: 0.8,
      maxOutputTokens: 2048,
    },
  });
  return { text: response.text, totalTokens: response.usageMetadata?.totalTokenCount, model };
}

const TRANSCRIBE_INSTRUCTION =
  "Transcribe the learner's speech in this audio verbatim, in the language they spoke. Output only the transcript, with no quotes, labels or commentary. If there is no speech, output nothing.";

/**
 * Learner audio to text. Tries the transcription model first. If that model cannot be called this
 * way (the SDK sends any model id, so failure shows up at request time), falls back to the turn
 * model with the same audio and a verbatim-transcription instruction.
 */
export async function transcribeLearnerAudio(input: {
  bytes: Buffer;
  mimeType: string;
}): Promise<{ text: string; model: string; totalTokens?: number; fellBack: boolean }> {
  const parts = [
    { inlineData: { data: input.bytes.toString("base64"), mimeType: input.mimeType } },
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

export type SynthesizedSpeech = {
  url: string;
  cached: boolean;
  model: string;
  totalTokens?: number;
};

/**
 * Speech for one line, cached in the tutor-tts-cache bucket under sha256(model + voice + text).
 * A cache hit costs nothing. A miss calls TTS, wraps the raw PCM in a WAV header and uploads it.
 */
export async function synthesizeCachedSpeech(text: string, voice: string): Promise<SynthesizedSpeech> {
  const supabase = createServiceClient();
  const model = modelFor("tutorTts");
  const path = ttsCachePath(model, voice, text);
  const url = supabase.storage.from(TTS_BUCKET).getPublicUrl(path).data.publicUrl;

  const hit = await fetch(url, { method: "HEAD" }).then((r) => r.ok).catch(() => false);
  if (hit) return { url, cached: true, model };

  const response = await gemini.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
    },
  });

  const inline = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
  if (!inline?.data) throw new Error("TTS returned no audio");

  const raw = Buffer.from(inline.data, "base64");
  const mime = (inline.mimeType ?? "").toLowerCase();
  // Some TTS responses already come as WAV. Raw PCM (audio/L16 or no container) gets a header.
  const wav = mime.startsWith("audio/wav") || mime.startsWith("audio/x-wav") ? raw : pcmToWav(raw, parsePcmSampleRate(inline.mimeType));

  const { error } = await supabase.storage.from(TTS_BUCKET).upload(path, wav, {
    contentType: "audio/wav",
    upsert: true,
  });
  if (error) throw new Error(`TTS cache upload failed: ${error.message}`);

  return { url, cached: false, model, totalTokens: response.usageMetadata?.totalTokenCount };
}

/**
 * Single-use ephemeral token for a Gemini Live session, locked to the tutor's model and config.
 * The client connects with apiKey = token and httpOptions.apiVersion = 'v1alpha' (see the SDK docs).
 */
export async function mintLiveToken(input: {
  systemInstruction: string;
  voiceName: string;
}): Promise<{ token: string; liveModel: string; expireTime: string }> {
  const liveModel = modelFor("tutorLive");
  const now = Date.now();
  const expireTime = new Date(now + LIVE_TOKEN_TTL_MS).toISOString();

  const liveConfig: LiveConnectConfig = {
    responseModalities: [Modality.AUDIO],
    systemInstruction: input.systemInstruction,
    tools: [
      {
        functionDeclarations: liveToolDeclarations().map((decl) => ({
          name: decl.name,
          description: decl.description,
          parametersJsonSchema: decl.parameters,
        })),
      },
    ],
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: input.voiceName } } },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    contextWindowCompression: { slidingWindow: {} },
    sessionResumption: {},
  };

  const token = await gemini.authTokens.create({
    config: {
      uses: 1,
      expireTime,
      newSessionExpireTime: new Date(now + LIVE_NEW_SESSION_WINDOW_MS).toISOString(),
      httpOptions: { apiVersion: "v1alpha" },
      liveConnectConstraints: { model: liveModel, config: liveConfig },
    },
  });
  if (!token.name) throw new Error("Gemini did not return an ephemeral token");
  return { token: token.name, liveModel, expireTime };
}

/** Structured post-session report from the transcript. Throws when the model reply is unusable. */
export async function generateReportJson(input: {
  transcript: string;
  scenarioTitle: string;
  scenarioGoal: string;
  language: string | null;
}): Promise<TurnGenerateResult & { model: string }> {
  const model = modelFor("tutorReport");
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
      maxOutputTokens: 2048,
    },
  });
  return { text: response.text, totalTokens: response.usageMetadata?.totalTokenCount, model };
}
