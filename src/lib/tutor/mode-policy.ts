import type { Mode } from "./scenario.ts";

// Thresholds for choosing and changing modes. Keep all tuning numbers here.
export const MODE_THRESHOLDS = {
  // Live is preferred only when measured RTT is at or below this (ms).
  liveStartRttMs: 350,
  // Live downgrades to Voice above this RTT (ms).
  liveDowngradeRttMs: 600,
  // Live downgrades to Voice above this packet loss fraction (0..1).
  liveDowngradePacketLoss: 0.08,
  // Live downgrades to Voice after this many consecutive errors.
  liveDowngradeErrors: 2,
  // Voice downgrades to Text after this many consecutive errors.
  voiceDowngradeErrors: 3,
} as const;

export type ChooseStartModeInput = {
  allowedModes: Mode[];
  micPermission: "granted" | "denied" | "prompt";
  rttMs?: number;
  liveMinutesLeft?: number;
};

export type DowngradeStats = {
  mode: Mode;
  rttMs: number;
  packetLoss: number;
  consecutiveErrors: number;
};

/**
 * Picks the starting mode.
 * - Mic denied and Text allowed: Text.
 * - Live when allowed, mic not denied, RTT unknown or <= liveStartRttMs, and live minutes unknown or > 0.
 * - Otherwise Voice when allowed.
 * - Otherwise the first allowed mode (this may still need a mic if the mic is denied and Text is not allowed).
 * Throws if no modes are allowed.
 */
export function chooseStartMode(input: ChooseStartModeInput): Mode {
  const { allowedModes, micPermission, rttMs, liveMinutesLeft } = input;
  if (allowedModes.length === 0) {
    throw new Error("chooseStartMode: allowedModes is empty; a scenario must allow at least one mode");
  }
  const allowed = (mode: Mode) => allowedModes.includes(mode);

  if (micPermission === "denied" && allowed("text")) return "text";

  const liveRttOk = rttMs === undefined || rttMs <= MODE_THRESHOLDS.liveStartRttMs;
  const liveMinutesOk = liveMinutesLeft === undefined || liveMinutesLeft > 0;
  if (allowed("live") && micPermission !== "denied" && liveRttOk && liveMinutesOk) return "live";

  if (allowed("voice")) return "voice";

  return allowedModes[0];
}

/**
 * Returns the mode to move to, or null to stay put.
 * - live -> voice when RTT, packet loss or consecutive errors cross the thresholds.
 * - voice -> text after enough consecutive errors.
 * - text never downgrades.
 */
export function shouldDowngrade(stats: DowngradeStats): Mode | null {
  switch (stats.mode) {
    case "live": {
      const degraded =
        stats.rttMs > MODE_THRESHOLDS.liveDowngradeRttMs ||
        stats.packetLoss > MODE_THRESHOLDS.liveDowngradePacketLoss ||
        stats.consecutiveErrors >= MODE_THRESHOLDS.liveDowngradeErrors;
      return degraded ? "voice" : null;
    }
    case "voice":
      return stats.consecutiveErrors >= MODE_THRESHOLDS.voiceDowngradeErrors ? "text" : null;
    case "text":
      return null;
  }
}
