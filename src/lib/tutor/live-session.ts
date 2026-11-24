import { tutorEventSchema, type TutorEvent } from "./events.ts";

// Pure helpers for Gemini Live sessions: tool-call validation, turn batching for /events sync,
// and PCM 16-bit audio conversion/resampling. No browser or network APIs so node:test runs it directly.

export type LiveFunctionCallLike = {
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
};

export type LiveTurnBatchItem = {
  idx: number;
  learnerText: string | null;
  events: TutorEvent[];
  latencyMs?: number;
};

/**
 * Converts a Gemini Live tool call `{ name, args }` into a contract-validated `TutorEvent`.
 * Returns `null` if the tool call is unknown or fails schema validation.
 */
export function liveToolCallToTutorEvent(call: LiveFunctionCallLike): TutorEvent | null {
  if (!call.name || call.name === "say") return null;
  const candidate = {
    type: call.name,
    ...(call.args && typeof call.args === "object" ? call.args : {}),
  };
  const parsed = tutorEventSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/**
 * Tracks in-flight Live transcripts and tool events turn by turn, producing clean,
 * monotonically indexed turn batches ready for `POST /api/tutor/sessions/[id]/events`.
 */
export class LiveTurnAccumulator {
  private nextIdx = 0;
  private learnerParts: string[] = [];
  private teacherParts: string[] = [];
  private turnEvents: TutorEvent[] = [];
  private turnStartedAtMs: number | null = null;
  private pendingBatch: LiveTurnBatchItem[] = [];

  addLearnerTranscript(chunk: string, nowMs = Date.now()): void {
    const text = chunk.trim();
    if (!text) return;
    if (this.turnStartedAtMs === null) this.turnStartedAtMs = nowMs;
    this.learnerParts.push(text);
  }

  addTeacherTranscript(chunk: string, nowMs = Date.now()): void {
    const text = chunk.trim();
    if (!text) return;
    if (this.turnStartedAtMs === null) this.turnStartedAtMs = nowMs;
    this.teacherParts.push(text);
  }

  addEvent(event: TutorEvent, nowMs = Date.now()): void {
    if (this.turnStartedAtMs === null) this.turnStartedAtMs = nowMs;
    this.turnEvents.push(event);
  }

  /**
   * Finalizes the current in-flight turn (on `turnComplete` or `interrupted`) into the batch queue.
   * Returns the finalized turn item, or `null` if nothing was recorded in this turn.
   */
  commitTurn(nowMs = Date.now()): LiveTurnBatchItem | null {
    const learnerText = joinTranscriptParts(this.learnerParts);
    const teacherText = joinTranscriptParts(this.teacherParts);
    const events: TutorEvent[] = [];

    if (teacherText) {
      events.push({ type: "say", text: teacherText });
    }
    for (const ev of this.turnEvents) {
      events.push(ev);
    }

    const startedAt = this.turnStartedAtMs;
    this.learnerParts = [];
    this.teacherParts = [];
    this.turnEvents = [];
    this.turnStartedAtMs = null;

    if (!learnerText && events.length === 0) return null;

    const item: LiveTurnBatchItem = {
      idx: this.nextIdx++,
      learnerText: learnerText || null,
      events,
      ...(startedAt !== null ? { latencyMs: Math.max(0, Math.round(nowMs - startedAt)) } : {}),
    };
    this.pendingBatch.push(item);
    return item;
  }

  /** Returns and clears up to `maxItems` queued turns for upload to `/events`. */
  drain(maxItems = 20): LiveTurnBatchItem[] {
    if (this.pendingBatch.length === 0) return [];
    return this.pendingBatch.splice(0, Math.max(1, maxItems));
  }

  /** Re-queues a failed batch at the front so a later retry preserves turn order. */
  requeue(items: readonly LiveTurnBatchItem[]): void {
    if (items.length === 0) return;
    this.pendingBatch.unshift(...items);
  }

  pendingCount(): number {
    return this.pendingBatch.length;
  }

  currentTeacherText(): string {
    return joinTranscriptParts(this.teacherParts);
  }

  currentLearnerText(): string {
    return joinTranscriptParts(this.learnerParts);
  }
}

function joinTranscriptParts(parts: string[]): string {
  if (parts.length === 0) return "";
  return parts
    .join(" ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Downsamples Float32 PCM (`-1..1`) from `sourceRate` to `targetRate` (default 16 kHz)
 * and encodes it as signed 16-bit little-endian integers for Gemini Live audio input.
 */
export function float32ToInt16Pcm(
  input: Float32Array,
  sourceRate: number,
  targetRate = 16_000,
): Int16Array {
  if (input.length === 0 || sourceRate <= 0 || targetRate <= 0) return new Int16Array(0);
  const ratio = sourceRate / targetRate;
  const outLength = Math.max(1, Math.floor(input.length / ratio));
  const out = new Int16Array(outLength);

  for (let i = 0; i < outLength; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.max(start + 1, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let j = start; j < end; j += 1) sum += input[j];
    const sample = Math.max(-1, Math.min(1, sum / (end - start)));
    out[i] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
  }
  return out;
}

/** Encodes a little-endian Int16Array as base64 (works in both Node and browser). */
export function int16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** Decodes base64 little-endian 16-bit PCM into normalized Float32 samples (`-1..1`). */
export function pcm16Base64ToFloat32(base64: string): Float32Array {
  if (!base64) return new Float32Array(0);
  let bytes: Uint8Array;
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(base64, "base64");
    bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  } else {
    const binary = atob(base64);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  }
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);
  const out = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i += 1) {
    out[i] = view.getInt16(i * 2, true) / 0x8000;
  }
  return out;
}

/** Computes a 0..1 normalized RMS voice amplitude for driving avatar listening/speaking visuals. */
export function rmsFromFloat32(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sumSq = 0;
  for (let i = 0; i < samples.length; i += 1) {
    sumSq += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sumSq / samples.length);
  return Math.max(0, Math.min(1, rms * 3.5));
}
