import type { Gesture, Mood, ToneShape, VisemeValue } from "@/lib/tutor/contract.generated";
import { TONE_TRACE } from "@/lib/tutor/contract.generated";
import { toneBoxPoint, type Box } from "@/lib/tutor/tone-path";

// Pure pose maths for the placeholder teacher: 2-bone IK, gesture plans, hand shapes, mouth and mood
// presets. No React, no DOM. Coordinates are SVG units of the placeholder's viewBox.

export type Side = "L" | "R"; // L = screen left, R = screen right (the character's left hand)
export type ArmPose = { x: number; y: number; w: number; b: number; s: number }; // wrist target, wrist deg, bend sign, scale
export type HandShape = "open" | "point" | "thumb" | "fist" | "cup" | 1 | 2 | 3 | 4 | 5;
export type Pose = {
  L: ArmPose;
  R: ArmPose;
  hands: Record<Side, HandShape>;
  tilt: number;
  lean: number;
  bob: number;
  lookX: number; // eye units, roughly -3.2..3.2
  lookY: number;
};
export type PosePatch = {
  L?: ArmPose;
  R?: ArmPose;
  hands?: Partial<Record<Side, HandShape>>;
  tilt?: number;
  lean?: number;
  bob?: number;
  lookX?: number;
  lookY?: number;
  mood?: Mood;
  /** Skip easing for arms this frame (used while the finger traces a contour). */
  snap?: boolean;
  trace?: { tone: ToneShape; u: number };
};
export type Motion = { amp: number; bounce: number };
export type Mark = { at: number; type: "gesturePeak" | "traceStart" | "traceEnd" };
export type GesturePlan = {
  /** Seconds. */
  duration: number;
  marks: Mark[];
  pose: (t: number, m: Motion) => PosePatch;
  /** Mood to hold while the gesture runs, separate from the persistent mood. */
  mood?: Mood;
};

export const SHOULDER: Record<Side, { x: number; y: number }> = {
  L: { x: 128, y: 334 },
  R: { x: 272, y: 334 },
};
export const FORE_LEN = 88;
export const UPPER_LEN = 100;

/** Where the screen-left hand points for point_card (the card sits to the left of the teacher). */
export const CARD_TARGET_SVG = { x: -12, y: 250 } as const;
/** Screen-right box the tone contours are drawn in. */
export const TRACE_BOX_SVG: Box = { x: 302, y: 190, w: 80, h: 100 };

const TRACE_APPROACH_S = 0.38;
const TRACE_HOLD_S = 0.25;

export const FINGERS = [
  { x: -11, y: 20, h: 19 },
  { x: -4.6, y: 22, h: 21 },
  { x: 1.8, y: 22, h: 20 },
  { x: 8, y: 19, h: 16 },
] as const;

export const REST_POSE: Pose = {
  L: { x: 113, y: 514, w: 0, b: 1, s: 1 },
  R: { x: 287, y: 514, w: 0, b: 1, s: 1 },
  hands: { L: "open", R: "open" },
  tilt: 0,
  lean: 0,
  bob: 0,
  lookX: 0,
  lookY: 0,
};

export function clonePose(p: Pose): Pose {
  return {
    L: { ...p.L },
    R: { ...p.R },
    hands: { ...p.hands },
    tilt: p.tilt,
    lean: p.lean,
    bob: p.bob,
    lookX: p.lookX,
    lookY: p.lookY,
  };
}

export const arm = (x: number, y: number, w = 0, b = 1, s = 1): ArmPose => ({ x, y, w, b, s });

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Shoulder-to-wrist solve. Returns [upper angle, forearm angle] in radians, as the placeholder's
 * SVG transforms expect. `side` mirrors the x axis for R.
 */
export function solveArm(side: Side, tx: number, ty: number, bend: number, sc: number): [number, number] {
  const s = SHOULDER[side];
  const upper = UPPER_LEN * sc;
  let dx = tx - s.x;
  if (side === "R") dx = -dx;
  const dy = ty - s.y;
  let d = Math.hypot(dx, dy);
  d = Math.min(Math.max(d, Math.abs(upper - FORE_LEN) + 2), upper + FORE_LEN - 0.5);
  const th = Math.atan2(-dx, dy);
  const alpha = Math.acos(clamp((upper * upper + d * d - FORE_LEN * FORE_LEN) / (2 * upper * d), -1, 1));
  const beta = Math.acos(clamp((upper * upper + FORE_LEN * FORE_LEN - d * d) / (2 * upper * FORE_LEN), -1, 1));
  return [th + bend * alpha, -bend * (Math.PI - beta)];
}

/** Fingertip position for given joint angles (radians) and wrist rotation (radians). */
export function fingertipPos(side: Side, a1: number, a2: number, a3: number, sc: number): { x: number; y: number } {
  const s = SHOULDER[side];
  const m = side === "R" ? -1 : 1;
  const upper = UPPER_LEN * sc;
  const ex = -Math.sin(a1) * upper;
  const ey = Math.cos(a1) * upper;
  const hx = ex - Math.sin(a1 + a2) * (FORE_LEN - 6);
  const hy = ey + Math.cos(a1 + a2) * (FORE_LEN - 6);
  const tipA = a1 + a2 + a3;
  const fx = hx - Math.sin(tipA) * 40;
  const fy = hy + Math.cos(tipA) * 40;
  return { x: s.x + m * fx, y: s.y + fy };
}

/**
 * Wrist target that puts the fingertip on `point`. Iterates because the fingertip sits a fixed
 * distance beyond the wrist; it converges in a few steps for reachable points.
 */
export function wristFor(side: Side, point: { x: number; y: number }, w: number, bend: number, sc = 1): ArmPose {
  let wx = point.x;
  let wy = point.y;
  for (let i = 0; i < 4; i++) {
    const [a1, a2] = solveArm(side, wx, wy, bend, sc);
    const tip = fingertipPos(side, a1, a2, (w * Math.PI) / 180, sc);
    wx += point.x - tip.x;
    wy += point.y - tip.y;
  }
  return arm(wx, wy, w, bend, sc);
}

export function mouthGeometry(o: number, w: number, r: number, smile: number) {
  const hw = 12 + 8 * w - 6 * r;
  const h = 1.2 + 17 * o;
  const c = -smile * 4;
  const up = -1 - h * 0.2 - smile * 1 - r * h * 0.15;
  const lo = 1 + h + smile * 2;
  return {
    d: `M${-hw} ${c}Q0 ${2 * up - c} ${hw} ${c}Q0 ${2 * lo - c} ${-hw} ${c}Z`,
    line: `M${-hw} ${c}Q0 ${2 * up - c} ${hw} ${c}`,
    hw,
    h,
    up,
    lo,
  };
}

export type MouthShape = { o: number; w: number; r: number; teeth: number; tongue: number };

/** The 9 contract visemes as mouth parameters. */
export const VISEME_MOUTH: Record<VisemeValue, MouthShape> = {
  0: { o: 0, w: 0.4, r: 0, teeth: 0, tongue: 0 }, // rest
  1: { o: 0.85, w: 0.55, r: 0, teeth: 1, tongue: 1 }, // AA
  2: { o: 0.45, w: 0.85, r: 0, teeth: 1, tongue: 0.6 }, // EH
  3: { o: 0.28, w: 1, r: 0, teeth: 1, tongue: 0 }, // EE
  4: { o: 0.65, w: 0.2, r: 0.8, teeth: 0.6, tongue: 0.4 }, // OH
  5: { o: 0.3, w: 0.1, r: 1, teeth: 0, tongue: 0 }, // OO
  6: { o: 0, w: 0.35, r: 0.1, teeth: 0, tongue: 0 }, // MBP
  7: { o: 0.12, w: 0.6, r: 0, teeth: 1, tongue: 0 }, // FV: upper teeth on lower lip
  8: { o: 0.22, w: 0.6, r: 0, teeth: 0.6, tongue: 0 }, // CONS
};

export type MoodVals = { smile: number; brow: number; browTilt: number; cheek: number };
export const MOOD_PRESETS: Record<Mood, MoodVals> = {
  neutral: { smile: 0.2, brow: 0, browTilt: 0, cheek: 0.18 },
  warm: { smile: 0.5, brow: -1, browTilt: 0, cheek: 0.3 },
  happy: { smile: 0.95, brow: -2, browTilt: 0, cheek: 0.42 },
  proud: { smile: 0.55, brow: -3, browTilt: 0, cheek: 0.3 },
  curious: { smile: 0.35, brow: -4, browTilt: 4, cheek: 0.22 },
  surprised: { smile: 0.1, brow: -8, browTilt: 0, cheek: 0.25 },
  concerned: { smile: -0.35, brow: -2, browTilt: -5, cheek: 0.12 },
  playful: { smile: 0.75, brow: -3, browTilt: 2, cheek: 0.38 },
};

/** Mood blended toward neutral by intensity (0 = neutral, 1 = full preset). */
export function blendMood(mood: Mood, intensity01: number): MoodVals {
  const p = MOOD_PRESETS[mood];
  const n = MOOD_PRESETS.neutral;
  const k = clamp(intensity01, 0, 1);
  return {
    smile: n.smile + (p.smile - n.smile) * k,
    brow: n.brow + (p.brow - n.brow) * k,
    browTilt: n.browTilt + (p.browTilt - n.browTilt) * k,
    cheek: n.cheek + (p.cheek - n.cheek) * k,
  };
}

/** Which fingers are extended, index order: f0..f3 (left to right in palm space), then thumb. */
export function handExtension(shape: HandShape): [boolean, boolean, boolean, boolean, boolean] {
  switch (shape) {
    case "open":
      return [true, true, true, true, true];
    case "cup":
      return [true, true, true, true, false];
    case "point":
      return [false, true, false, false, false];
    case "thumb":
      return [false, false, false, false, true];
    case "fist":
      return [false, false, false, false, false];
    default: {
      // Counting: index, middle, ring, pinky, then thumb for five.
      const n = clamp(shape, 1, 5);
      const order = [1, 2, 0, 3];
      const ext: [boolean, boolean, boolean, boolean, boolean] = [false, false, false, false, false];
      for (let k = 0; k < Math.min(n, 4); k++) ext[order[k]] = true;
      if (n >= 5) ext[4] = true;
      return ext;
    }
  }
}

const idlePatch = (): PosePatch => ({});
const peak = (at: number): Mark => ({ at, type: "gesturePeak" });

/** Base layer: what the teacher does when no gesture is running. */
export function basePose(s: {
  speaking: boolean;
  listening: boolean;
  thinking: boolean;
  voice: number;
  t: number;
  m: Motion;
}): Pose {
  const p = clonePose(REST_POSE);
  if (s.speaking) {
    // Talk beats: small hand and head accents, never a full gesture.
    p.R.y += Math.sin(s.t * 3.7) * 3 * s.m.amp;
    p.tilt += Math.sin(s.t * 2.3) * 1.2 * s.m.amp;
  }
  if (s.listening) {
    p.L = arm(132, 226, 150, -1);
    p.hands.L = "cup";
    p.tilt = 8;
    p.lean = 6;
    p.lookY = 0.5;
    // Soft nods scaled by the learner's voice level.
    p.bob = Math.max(0, Math.sin(s.t * 3.2)) * (1.5 + (s.voice / 100) * 4) * s.m.amp;
  }
  if (s.thinking) {
    p.R = arm(226, 282, -8, 1, 0.45);
    p.hands.R = "point";
    p.tilt = -6;
    p.lookX = -2.5;
    p.lookY = -3;
  }
  return p;
}

/** Builds the plan for one gesture. Durations and peaks follow the Rive brief (§6.1). */
export function planGesture(name: Gesture, opts: { toneShape?: ToneShape; countTo?: number } = {}): GesturePlan {
  switch (name) {
    case "idle":
      return { duration: 0, marks: [], pose: idlePatch };

    case "wave":
      return {
        duration: 1.6,
        marks: [peak(0.9)],
        pose: (t, m) => ({
          R: arm(350 + Math.sin(t * 11) * 12 * m.amp, 236, -10 + Math.sin(t * 11) * 14 * m.amp, -1),
          tilt: 4,
          lookX: 0,
        }),
      };

    case "nod":
      return {
        duration: 0.9,
        marks: [peak(0.225)],
        pose: (t, m) => ({
          bob: 5 * m.amp * (0.5 - 0.5 * Math.cos((4 * Math.PI * t) / 0.9)),
          tilt: Math.sin((4 * Math.PI * t) / 0.9) * 1.5 * m.amp,
          lookY: 1,
        }),
      };

    case "head_shake":
      return {
        duration: 1.0,
        marks: [peak(0.5)],
        pose: (t, m) => ({
          lean: Math.sin(2 * Math.PI * 1.5 * t) * 6 * m.amp,
          tilt: -2,
          mood: "warm",
        }),
      };

    case "explain":
      return {
        duration: 2.4,
        marks: [peak(0.6)],
        pose: (t, m) => ({
          L: arm(158, 392 + Math.sin(4 * t) * 10 * m.amp, -40 + Math.sin(4 * t) * 10 * m.amp),
          R: arm(242, 392 + Math.sin(4 * t + 1.6) * 10 * m.amp, -40 + Math.sin(4 * t + 1.6) * 10 * m.amp),
          tilt: Math.sin(2 * t) * 2 * m.amp,
        }),
      };

    case "point_card": {
      const target = wristFor("L", CARD_TARGET_SVG, 0, 1);
      return {
        duration: 2.0,
        marks: [peak(0.7)],
        pose: () => ({
          L: target,
          hands: { L: "point" },
          lookX: -3,
          tilt: -3,
          lean: -2,
          mood: "curious",
        }),
      };
    }

    case "point_left":
      return {
        duration: 1.4,
        marks: [peak(0.8)],
        pose: () => ({ L: arm(-40, 300, 0, 1), hands: { L: "open" }, lookX: -3, tilt: -2 }),
      };

    case "point_right":
      return {
        duration: 1.4,
        marks: [peak(0.8)],
        pose: () => ({ R: arm(380, 300, 0, 1), hands: { R: "open" }, lookX: 3, tilt: 2 }),
      };

    case "thumbs_up":
      return {
        duration: 1.4,
        marks: [peak(0.7)],
        pose: (t, m) => ({
          R: arm(300, 300 + Math.sin(7 * t) * 3 * m.bounce, 4, -1),
          hands: { R: "thumb" },
          tilt: 3,
          mood: "happy",
        }),
      };

    case "clap":
      return {
        duration: 1.2,
        marks: [peak(0.2)],
        pose: (t) => {
          const together = 0.5 - 0.5 * Math.cos((2 * Math.PI * 3 * t) / 1.2);
          return {
            L: arm(140 + 54 * together, 372, 0, 1),
            R: arm(260 - 54 * together, 372, 0, 1),
            hands: { L: "open", R: "open" },
            mood: "happy",
          };
        },
      };

    case "think":
      return {
        duration: 2.2,
        marks: [],
        pose: () => ({
          R: arm(226, 282, -8, 1, 0.45),
          hands: { R: "point" },
          tilt: -6,
          lookX: -2.5,
          lookY: -3,
          mood: "curious",
        }),
      };

    case "listen":
      return {
        duration: 2.4,
        marks: [peak(0.6)],
        pose: (t, m) => ({
          L: arm(132, 226, 150, -1),
          hands: { L: "cup" },
          tilt: 8,
          lean: 6,
          lookY: 0.5,
          bob: Math.max(0, Math.sin(3.2 * t)) * 3 * m.amp,
          mood: "warm",
        }),
      };

    case "celebrate":
      return {
        duration: 2.0,
        marks: [peak(0.2)],
        pose: (t, m) => ({
          L: arm(62, 206 + Math.sin(8 * t) * 8 * m.bounce, 6, -1),
          R: arm(338, 206 + Math.sin(8 * t) * 8 * m.bounce, 6, -1),
          hands: { L: "open", R: "open" },
          bob: -Math.abs(Math.sin(8 * t)) * 6 * m.bounce,
          lookY: -1,
          mood: "happy",
        }),
      };

    case "count": {
      const n = clamp(Math.round(opts.countTo ?? 3), 1, 5);
      const marks: Mark[] = [];
      for (let i = 0; i < n; i++) marks.push(peak(i * 0.5));
      return {
        duration: n * 0.5 + 0.8,
        marks,
        pose: (t) => {
          const shown = clamp(Math.floor(t / 0.5) + 1, 1, n) as 1 | 2 | 3 | 4 | 5;
          return {
            R: arm(318, 250, -10, -1),
            hands: { R: shown },
            tilt: 4,
            mood: "happy",
          };
        },
      };
    }

    case "shrug":
      return {
        duration: 1.2,
        marks: [peak(0.6)],
        pose: (t, m) => {
          const s = Math.sin(Math.PI * clamp(t / 1.2, 0, 1));
          return {
            L: arm(113, 514 - 80 * s, -30 * s, 1),
            R: arm(287, 514 - 80 * s, 30 * s, 1),
            bob: -4 * s * m.amp,
            mood: "curious",
          };
        },
      };

    case "beckon":
      return {
        duration: 1.3,
        marks: [],
        pose: (t, m) => ({
          R: arm(320 - 20 * Math.abs(Math.sin(2 * Math.PI * 1.5 * t)), 262, Math.sin(10 * t) * 16 * m.amp, -1),
          hands: { R: "open" },
          mood: "warm",
        }),
      };

    case "trace_tone": {
      const tone: ToneShape = opts.toneShape ?? "t1";
      const durS = TONE_TRACE.durationMs[tone] / 1000;
      const start = TRACE_APPROACH_S;
      const end = start + durS;
      const startPoint = toneBoxPoint(tone, 0, TRACE_BOX_SVG);
      const startTarget = wristFor("R", startPoint, -14, -1);
      return {
        duration: end + TRACE_HOLD_S,
        marks: [
          { at: start, type: "traceStart" },
          { at: end, type: "traceEnd" },
        ],
        pose: (t) => {
          if (t < start) {
            return { R: startTarget, hands: { R: "point" }, tilt: 3, lookX: 2.5 };
          }
          if (t < end) {
            const u = (t - start) / durS;
            const p = toneBoxPoint(tone, u, TRACE_BOX_SVG);
            return {
              R: wristFor("R", p, -14, -1),
              hands: { R: "point" },
              tilt: 3,
              lookX: 2.5,
              snap: true,
              trace: { tone, u },
            };
          }
          return { R: startTarget, hands: { R: "point" }, tilt: 3, lookX: 2.5 };
        },
      };
    }

    case "oops":
      return {
        duration: 1.4,
        marks: [peak(0.7)],
        pose: (t, m) => ({
          R: arm(232, 252, -10, 1),
          hands: { R: "open" },
          bob: t > 0.9 ? Math.abs(Math.sin((t - 0.9) * 14)) * 3 * m.bounce : 0,
          mood: t < 0.9 ? "surprised" : "playful",
        }),
      };

    default:
      return { duration: 0, marks: [], pose: idlePatch };
  }
}
