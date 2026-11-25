import "server-only";
import { Modality, type LiveConnectConfig } from "@google/genai";
import { modelFor } from "@/lib/ai/models";
import { gemini } from "./client.ts";

// Gemini Live (realtime voice) is Gemini-specific by design (architecture §3.6): there is no provider interface for
// it. The server mints a single-use ephemeral token locked to the tutor's model and config; the browser connects
// with it (src/components/tutor/practice/live-client.ts). Live audio is metered from session events, not here.

export const LIVE_TOKEN_TTL_MS = 30 * 60_000;
export const LIVE_NEW_SESSION_WINDOW_MS = 2 * 60_000;

export type LiveToolDeclaration = { name: string; description: string; parameters: unknown };

/**
 * Single-use ephemeral token for a Gemini Live session, locked to the tutor's model and config.
 * The client connects with apiKey = token and httpOptions.apiVersion = 'v1alpha' (see the SDK docs).
 */
export async function mintGeminiLiveToken(input: {
  systemInstruction: string;
  voiceName: string;
  tools: LiveToolDeclaration[];
}): Promise<{ token: string; liveModel: string; expireTime: string }> {
  const liveModel = modelFor("tutorLive");
  const now = Date.now();
  const expireTime = new Date(now + LIVE_TOKEN_TTL_MS).toISOString();

  const liveConfig: LiveConnectConfig = {
    responseModalities: [Modality.AUDIO],
    systemInstruction: input.systemInstruction,
    tools: [
      {
        functionDeclarations: input.tools.map((decl) => ({
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
