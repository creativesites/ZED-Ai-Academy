import "server-only";
import { Modality, type LiveConnectConfig } from "@google/genai";
import { gemini } from "@/lib/ai/gemini";
import { modelFor } from "@/lib/ai/models";
import { createServiceClient } from "@/lib/supabase/server";
import { liveToolDeclarations } from "../events.ts";
import { ttsCachePath } from "../audio.ts";
import { synthesizeSpeechWav } from "./gemini-models.ts";

// Thin wrappers around @google/genai for the tutor. Everything that talks to Gemini goes through
// here or gemini-models.ts, so routes and pipelines can be read without SDK details. The models
// file has no database access and is what the public demo uses. This file adds the Supabase TTS
// cache and the Live token. Nothing here is unit tested (no keys in the build environment); the SDK
// surface was checked against @google/genai 1.52.0.

export { generateReportJson, generateTurnJson, transcribeLearnerAudio } from "./gemini-models.ts";

export const TTS_BUCKET = "tutor-tts-cache";

export const LIVE_TOKEN_TTL_MS = 30 * 60_000;
export const LIVE_NEW_SESSION_WINDOW_MS = 2 * 60_000;

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

  const speech = await synthesizeSpeechWav(text, voice);

  const { error } = await supabase.storage.from(TTS_BUCKET).upload(path, speech.wav, {
    contentType: "audio/wav",
    upsert: true,
  });
  if (error) throw new Error(`TTS cache upload failed: ${error.message}`);

  return { url, cached: false, model, totalTokens: speech.totalTokens };
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
