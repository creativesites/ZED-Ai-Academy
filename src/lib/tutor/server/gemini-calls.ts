import "server-only";
import { LIVE_NEW_SESSION_WINDOW_MS, LIVE_TOKEN_TTL_MS, mintGeminiLiveToken } from "@/lib/ai/gemini/live";
import { modelFor } from "@/lib/ai/models";
import { createServiceClient } from "@/lib/supabase/server";
import { liveToolDeclarations } from "../events.ts";
import { ttsCachePath } from "../audio.ts";
import { synthesizeSpeechWav } from "./gemini-models.ts";

// Tutor model calls that need the database: the Supabase TTS cache and the Live token. The model calls themselves
// go through `aiCall` (src/lib/ai/call.ts) via gemini-models.ts; the Live token is minted by the Gemini-specific
// src/lib/ai/gemini/live.ts. Nothing here is unit tested (no keys in the build environment).

export { generateReportJson, generateTurnJson, streamTurnJson, transcribeLearnerAudio } from "./gemini-models.ts";
export { LIVE_NEW_SESSION_WINDOW_MS, LIVE_TOKEN_TTL_MS };

export const TTS_BUCKET = "tutor-tts-cache";

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
  /** The session's skill pack, so Live only gets the tools that pack is taught. */
  skillPack?: string | null;
}): Promise<{ token: string; liveModel: string; expireTime: string }> {
  return mintGeminiLiveToken({
    systemInstruction: input.systemInstruction,
    voiceName: input.voiceName,
    tools: liveToolDeclarations(input.skillPack ?? undefined),
  });
}
