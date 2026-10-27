import { createHash } from "node:crypto";

// Audio helpers for the TTS cache. Pure except for node:crypto. No imports from "@/".

export const TTS_DEFAULT_SAMPLE_RATE = 24_000;

/**
 * Gemini TTS returns raw 16-bit little-endian PCM with a mimeType such as
 * "audio/L16;codec=pcm;rate=24000". Returns the sample rate, or the default when absent.
 */
export function parsePcmSampleRate(mimeType: string | undefined): number {
  const match = mimeType?.match(/rate=(\d+)/i);
  const rate = match ? Number(match[1]) : NaN;
  return Number.isInteger(rate) && rate >= 8000 && rate <= 48000 ? rate : TTS_DEFAULT_SAMPLE_RATE;
}

/**
 * Wraps raw PCM (16-bit signed little-endian) in a canonical 44-byte WAV header.
 * Mono by default. Returns a new Buffer; the input is not modified.
 */
export function pcmToWav(pcm: Uint8Array, sampleRate: number, channels = 1, bitsPerSample = 16): Buffer {
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.byteLength;
  const out = Buffer.alloc(44 + dataSize);

  out.write("RIFF", 0, "ascii");
  out.writeUInt32LE(36 + dataSize, 4);
  out.write("WAVE", 8, "ascii");
  out.write("fmt ", 12, "ascii");
  out.writeUInt32LE(16, 16); // PCM fmt chunk size
  out.writeUInt16LE(1, 20); // audio format: PCM
  out.writeUInt16LE(channels, 22);
  out.writeUInt32LE(sampleRate, 24);
  out.writeUInt32LE(byteRate, 28);
  out.writeUInt16LE(blockAlign, 32);
  out.writeUInt16LE(bitsPerSample, 34);
  out.write("data", 36, "ascii");
  out.writeUInt32LE(dataSize, 40);
  Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength).copy(out, 44);
  return out;
}

/**
 * Cache key for a synthesized line: sha256 of voice and text, hex encoded.
 * The object path is `<key>.wav` in the tutor-tts-cache bucket.
 */
export function ttsCacheKey(voice: string, text: string): string {
  return createHash("sha256").update(`${voice}\n${text}`, "utf8").digest("hex");
}

export function ttsCachePath(voice: string, text: string): string {
  return `${ttsCacheKey(voice, text)}.wav`;
}
