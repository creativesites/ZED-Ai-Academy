import type { Mood, VisemeValue } from "./contract.generated.ts";

// Pure mapping from the tutor contract's 9 visemes (0..8) and 8 moods to standard 3D morph-target
// weights used by Ready Player Me, Avaturn, Oculus LipSync, and ARKit GLB avatars, plus the
// built-in stylized Three.js starter teacher.

export type MorphWeightMap = Record<string, number>;

/**
 * Target morph weights for each contract viseme value (0=rest, 1=AA, 2=EH, 3=EE, 4=OH, 5=OO,
 * 6=MBP, 7=FV, 8=CONS). Includes both Oculus (`viseme_*`) and ARKit (`jawOpen`, `mouth*`) names
 * so any standard .glb avatar animates smoothly out of the box.
 */
export const VISEME_MORPH_TARGETS: Record<VisemeValue, MorphWeightMap> = {
  0: {
    viseme_sil: 1,
    jawOpen: 0,
    mouthFunnel: 0,
    mouthPucker: 0,
    mouthClose: 0,
  },
  1: {
    // AA (open vowel: "ah", "ma")
    viseme_aa: 0.9,
    jawOpen: 0.68,
    mouthFunnel: 0.12,
  },
  2: {
    // EH (mid open: "eh", "bed")
    viseme_E: 0.85,
    jawOpen: 0.42,
    mouthStretchLeft: 0.25,
    mouthStretchRight: 0.25,
  },
  3: {
    // EE (wide smile vowel: "ee", "ni")
    viseme_I: 0.85,
    jawOpen: 0.22,
    mouthSmileLeft: 0.4,
    mouthSmileRight: 0.4,
    mouthStretchLeft: 0.35,
    mouthStretchRight: 0.35,
  },
  4: {
    // OH (rounded open: "oh", "hola")
    viseme_O: 0.9,
    jawOpen: 0.5,
    mouthFunnel: 0.65,
    mouthPucker: 0.25,
  },
  5: {
    // OO (tight round: "oo", "tu")
    viseme_U: 0.9,
    jawOpen: 0.24,
    mouthFunnel: 0.45,
    mouthPucker: 0.78,
  },
  6: {
    // MBP (closed lips: "m", "b", "p")
    viseme_PP: 0.9,
    jawOpen: 0.02,
    mouthClose: 0.85,
    mouthPressLeft: 0.55,
    mouthPressRight: 0.55,
  },
  7: {
    // FV (lower lip tucked: "f", "v")
    viseme_FF: 0.85,
    jawOpen: 0.14,
    mouthRollLower: 0.65,
    mouthShrugUpper: 0.25,
  },
  8: {
    // CONS (alveolar/sibilant consonants: "t", "d", "s", "n")
    viseme_SS: 0.7,
    viseme_DD: 0.45,
    jawOpen: 0.2,
    mouthSmileLeft: 0.15,
    mouthSmileRight: 0.15,
  },
};

export const MOOD_MORPH_TARGETS: Record<Mood, MorphWeightMap> = {
  neutral: {},
  warm: {
    mouthSmileLeft: 0.35,
    mouthSmileRight: 0.35,
    cheekSquintLeft: 0.18,
    cheekSquintRight: 0.18,
  },
  happy: {
    mouthSmileLeft: 0.65,
    mouthSmileRight: 0.65,
    cheekSquintLeft: 0.4,
    cheekSquintRight: 0.4,
    browInnerUp: 0.15,
  },
  proud: {
    mouthSmileLeft: 0.55,
    mouthSmileRight: 0.55,
    browOuterUpLeft: 0.25,
    browOuterUpRight: 0.25,
  },
  curious: {
    browInnerUp: 0.45,
    browOuterUpRight: 0.35,
    eyeWideLeft: 0.2,
    eyeWideRight: 0.2,
  },
  surprised: {
    browInnerUp: 0.7,
    browOuterUpLeft: 0.5,
    browOuterUpRight: 0.5,
    eyeWideLeft: 0.55,
    eyeWideRight: 0.55,
    jawOpen: 0.25,
  },
  concerned: {
    browInnerUp: 0.55,
    browDownLeft: 0.3,
    browDownRight: 0.3,
    mouthFrownLeft: 0.3,
    mouthFrownRight: 0.3,
  },
  playful: {
    mouthSmileLeft: 0.6,
    mouthSmileRight: 0.45,
    browOuterUpLeft: 0.35,
    eyeSquintLeft: 0.25,
  },
};

/**
 * Combines the active viseme, mood (scaled by intensity 0..100), and eye blink (0..1) into a
 * single target morph-weight dictionary clamped to [0, 1].
 */
export function composeFaceMorphs(params: {
  viseme: VisemeValue;
  mood: Mood;
  moodIntensity: number;
  blink: number;
}): MorphWeightMap {
  const out: MorphWeightMap = {};
  const intensity = Math.max(0, Math.min(1, params.moodIntensity / 100));

  const moodMap = MOOD_MORPH_TARGETS[params.mood] ?? {};
  for (const [k, v] of Object.entries(moodMap)) {
    out[k] = Math.min(1, (out[k] ?? 0) + v * intensity);
  }

  const visemeMap = VISEME_MORPH_TARGETS[params.viseme] ?? {};
  for (const [k, v] of Object.entries(visemeMap)) {
    // Viseme mouth shapes take priority over passive smile/frown when speaking
    out[k] = Math.max(out[k] ?? 0, v);
  }

  if (params.blink > 0) {
    const b = Math.max(0, Math.min(1, params.blink));
    out.eyeBlinkLeft = b;
    out.eyeBlinkRight = b;
    out.eyesClosed = b;
  }

  return out;
}

/** Frame-rate independent exponential smoothing for 3D morph targets and bone rotations. */
export function damp(current: number, target: number, lambda: number, dtSeconds: number): number {
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return current;
  return current + (target - current) * (1 - Math.exp(-lambda * dtSeconds));
}

/** Mouth opening & width parameters for the built-in stylized 3D teacher rig. */
export function stylizedMouthShape(viseme: VisemeValue): { openY: number; widthX: number; roundZ: number } {
  switch (viseme) {
    case 0:
      return { openY: 0.08, widthX: 1.0, roundZ: 0.0 };
    case 1:
      return { openY: 1.0, widthX: 0.95, roundZ: 0.2 };
    case 2:
      return { openY: 0.65, widthX: 1.15, roundZ: 0.05 };
    case 3:
      return { openY: 0.35, widthX: 1.32, roundZ: 0.0 };
    case 4:
      return { openY: 0.85, widthX: 0.68, roundZ: 0.6 };
    case 5:
      return { openY: 0.45, widthX: 0.52, roundZ: 0.85 };
    case 6:
      return { openY: 0.04, widthX: 0.92, roundZ: 0.1 };
    case 7:
      return { openY: 0.22, widthX: 1.05, roundZ: 0.15 };
    case 8:
      return { openY: 0.32, widthX: 1.08, roundZ: 0.08 };
  }
}
