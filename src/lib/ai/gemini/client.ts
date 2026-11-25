import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { AiProvider } from "../provider.ts";
import { createGeminiProvider, type GeminiClientLike } from "./adapter.ts";

/**
 * The one @google/genai client on the server. Reads GEMINI_API_KEY / GOOGLE_API_KEY from the environment.
 * Prefer `aiCall` (`@/lib/ai/call`) over using this directly; the raw client is exported only for Gemini-specific
 * features that have no provider interface yet (image generation, function calling, the legacy dock stream).
 */
export const gemini = new GoogleGenAI({});

/** The Gemini provider behind `aiCall`. */
export const geminiProvider: AiProvider = createGeminiProvider(gemini as unknown as GeminiClientLike);

/** Creates a Gemini context cache holding `systemInstruction` for `model`. Returns the cache name. */
export async function createContextCache(
  model: string,
  systemInstruction: string,
  ttlSeconds: number,
): Promise<string | undefined> {
  const created = await gemini.caches.create({
    model,
    config: { systemInstruction, ttl: `${ttlSeconds}s` },
  });
  return created?.name ?? undefined;
}
