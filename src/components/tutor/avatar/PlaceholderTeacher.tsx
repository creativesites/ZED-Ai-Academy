"use client";

// Placeholder teacher: a React port of the speaking-room prototype's SVG character. It implements
// AvatarDriver so the Rive teacher can replace it without changing any caller. Animation runs in one
// requestAnimationFrame loop that writes SVG attributes through cached element refs; React re-renders
// only when props change.

import { forwardRef, useEffect, useId, useImperativeHandle, useRef } from "react";
import type { CSSProperties } from "react";
import type { Gesture, HairStyle, Mood, OutfitStyle, Prop, ToneShape, VisemeValue } from "@/lib/tutor/contract.generated";
import { toneBoxPath, toneBoxPoint } from "@/lib/tutor/tone-path";
import { DEFAULT_PERSONA_LOOK } from "./types";
import type { AvatarDriver, AvatarEvent, AvatarProps, PersonaLook } from "./types";
import {
  FINGERS,
  FORE_LEN,
  SHOULDER,
  TRACE_BOX_SVG,
  VISEME_MOUTH,
  REST_POSE,
  basePose,
  blendMood,
  clonePose,
  handExtension,
  mouthGeometry,
  planGesture,
  solveArm,
} from "./poses";
import type { GesturePlan, HandShape, Motion, MouthShape, MoodVals, Pose, PosePatch, Side } from "./poses";

const MOUTH_D0 = "M-12 0Q0 2 12 0Q0 4 -12 0Z";
const MOUTH_LINE0 = "M-12 0Q0 2 12 0";
const TORSO_D = "M94 352 C100 322 132 308 166 303 L234 303 C268 308 300 322 306 352 L322 510 L78 510 Z";
const MOOD_KEYS = ["smile", "brow", "browTilt", "cheek"] as const;
const MOUTH_KEYS = ["o", "w", "r", "teeth", "tongue"] as const;

type ActiveGesture = { name: Gesture; plan: GesturePlan; t: number; nextMark: number; toneShape?: ToneShape };

type Rig = {
  onEvent?: (e: AvatarEvent) => void;
  reduced: boolean;
  clock: number; // seconds
  gesture: ActiveGesture | null;
  cur: Pose; // eased pose
  applied: Record<Side, HandShape | null>;
  speaking: boolean;
  listening: boolean;
  thinking: boolean;
  voice: number;
  look: { x: number; y: number }; // eye units, set by lookAt
  mood: Mood;
  moodIntensity: number;
  moodNow: MoodVals;
  mouthTarget: MouthShape;
  mouthNow: MouthShape;
  blink: { next: number; start: number | null };
  sacc: { x: number; y: number; tx: number; ty: number; next: number };
  trail: { on: boolean; tone: ToneShape | null; pts: Array<[number, number]>; fadeStart: number | null };
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const deg = (r: number) => (r * 180) / Math.PI;
const approach = (current: number, target: number, k: number) => current + (target - current) * k;

function createRig(): Rig {
  return {
    reduced: false,
    clock: 0,
    gesture: null,
    cur: clonePose(REST_POSE),
    applied: { L: null, R: null },
    speaking: false,
    listening: false,
    thinking: false,
    voice: 0,
    look: { x: 0, y: 0 },
    mood: "warm",
    moodIntensity: 70,
    moodNow: blendMood("warm", 0.7),
    mouthTarget: VISEME_MOUTH[0],
    mouthNow: { ...VISEME_MOUTH[0] },
    blink: { next: 1.8, start: null },
    sacc: { x: 0, y: 0, tx: 0, ty: 0, next: 1.2 },
    trail: { on: false, tone: null, pts: [], fadeStart: null },
  };
}

function createDriver(rig: Rig): AvatarDriver {
  return {
    playGesture(name: Gesture, opts?: { toneShape?: ToneShape; countTo?: number }) {
      const prev = rig.gesture;
      if (prev) {
        rig.gesture = null;
        rig.onEvent?.({ type: "gestureEnd", gesture: prev.name });
      }
      const toneShape = name === "trace_tone" ? (opts?.toneShape ?? "t1") : undefined;
      const plan = planGesture(name, { toneShape, countTo: opts?.countTo });
      rig.gesture = { name, plan, t: 0, nextMark: 0, toneShape };
      rig.onEvent?.({ type: "gestureStart", gesture: name, toneShape });
    },
    setMood(mood: Mood, intensity = 70) {
      rig.mood = mood;
      rig.moodIntensity = clamp(intensity, 0, 100);
    },
    setViseme(v: VisemeValue) {
      const idx = clamp(Math.round(v), 0, 8) as VisemeValue;
      rig.mouthTarget = VISEME_MOUTH[idx];
    },
    setSpeaking(on: boolean) {
      rig.speaking = on;
      if (!on) rig.mouthTarget = VISEME_MOUTH[0];
    },
    setListening(on: boolean, voiceLevel?: number) {
      rig.listening = on;
      if (voiceLevel !== undefined) rig.voice = clamp(voiceLevel, 0, 100);
    },
    setThinking(on: boolean) {
      rig.thinking = on;
    },
    lookAt(x: number, y: number) {
      rig.look = { x: clamp(x, -100, 100) * 0.032, y: clamp(y, -100, 100) * 0.024 };
    },
  };
}

function put(els: Map<string, SVGElement>, key: string, attr: string, value: string) {
  const el = els.get(key);
  if (el) el.setAttribute(attr, value);
}

const FINGER_FOLDED_Y = 23;
const FINGER_FOLDED_H = 9;

function applyHand(els: Map<string, SVGElement>, side: Side, shape: HandShape) {
  const ext = handExtension(shape);
  FINGERS.forEach((f, i) => {
    put(els, `${side}.f${i}`, "y", String(ext[i] ? f.y : FINGER_FOLDED_Y));
    put(els, `${side}.f${i}`, "height", String(ext[i] ? f.h : FINGER_FOLDED_H));
  });
  const thumb = `${side}.th`;
  if (shape === "thumb") {
    // Thumbs-up: the thumb runs on past the fist, in line with the forearm.
    put(els, thumb, "transform", "");
    put(els, thumb, "x", "-12");
    put(els, thumb, "y", "10");
    put(els, thumb, "width", "6.5");
    put(els, thumb, "height", "28");
  } else {
    put(els, thumb, "transform", "rotate(32 -14 12)");
    put(els, thumb, "x", "-17");
    put(els, thumb, "width", "6");
    put(els, thumb, "y", ext[4] ? "4" : "10");
    put(els, thumb, "height", ext[4] ? "16" : "8");
  }
}

function easeArm(c: { x: number; y: number; w: number; b: number; s: number }, g: typeof c, k: number) {
  c.x = approach(c.x, g.x, k);
  c.y = approach(c.y, g.y, k);
  c.w = approach(c.w, g.w, k);
  c.b = approach(c.b, g.b, k);
  c.s = approach(c.s, g.s, k);
}

function pathFrom(pts: Array<[number, number]>): string {
  if (pts.length < 2) return "";
  return pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
}

/** One frame: advance the gesture, blend layers, ease toward targets and write attributes. */
function tick(rig: Rig, els: Map<string, SVGElement>, dt: number): void {
  rig.clock += dt;
  const t = rig.clock;
  const motion: Motion = { amp: rig.reduced ? 0.5 : 1, bounce: rig.reduced ? 0 : 1 };

  // Gesture layer: fire marks, end when done, otherwise take its pose patch.
  let patch: PosePatch | null = null;
  const g = rig.gesture;
  if (g) {
    g.t += dt;
    while (g.nextMark < g.plan.marks.length && g.t >= g.plan.marks[g.nextMark].at) {
      const mk = g.plan.marks[g.nextMark];
      g.nextMark += 1;
      rig.onEvent?.(
        mk.type === "gesturePeak"
          ? { type: "gesturePeak", gesture: g.name }
          : { type: mk.type, gesture: g.name, toneShape: g.toneShape },
      );
    }
    if (g.t >= g.plan.duration) {
      rig.gesture = null;
      rig.onEvent?.({ type: "gestureEnd", gesture: g.name });
    } else {
      patch = g.plan.pose(g.t, motion);
    }
  }

  // Base layer (speaking, listening, thinking) with the gesture patch merged on top.
  const base = basePose({
    speaking: rig.speaking,
    listening: rig.listening,
    thinking: rig.thinking,
    voice: rig.voice,
    t,
    m: motion,
  });
  base.lookX += rig.look.x;
  base.lookY += rig.look.y;
  base.lean += rig.look.x * 1.5;
  const target: Pose = {
    L: patch?.L ?? base.L,
    R: patch?.R ?? base.R,
    hands: { L: patch?.hands?.L ?? base.hands.L, R: patch?.hands?.R ?? base.hands.R },
    tilt: patch?.tilt ?? base.tilt,
    lean: patch?.lean ?? base.lean,
    bob: patch?.bob ?? base.bob,
    lookX: patch?.lookX ?? base.lookX,
    lookY: patch?.lookY ?? base.lookY,
  };

  // Easing. Snap the arm while the finger traces, so the trail stays on the fingertip.
  const kArm = patch?.snap ? 1 : 1 - Math.exp(-dt * 10);
  const kHead = 1 - Math.exp(-dt * 8);
  const c = rig.cur;
  easeArm(c.L, target.L, kArm);
  easeArm(c.R, target.R, kArm);
  c.tilt = approach(c.tilt, target.tilt, kHead);
  c.lean = approach(c.lean, target.lean, kHead);
  c.bob = approach(c.bob, target.bob, kHead);
  c.lookX = approach(c.lookX, target.lookX, kHead);
  c.lookY = approach(c.lookY, target.lookY, kHead);
  c.hands = target.hands;

  // Mood: persistent mood at its intensity, or a gesture's mood at a fixed strength.
  const moodKey = patch?.mood ?? rig.mood;
  const moodT = blendMood(moodKey, patch?.mood ? 0.85 : rig.moodIntensity / 100);
  const kMood = 1 - Math.exp(-dt * 6);
  for (const key of MOOD_KEYS) rig.moodNow[key] = approach(rig.moodNow[key], moodT[key], kMood);
  const mo = rig.moodNow;

  // Mouth: fast approach so visemes read as ~40 ms transitions.
  const kMouth = 1 - Math.exp(-dt * 30);
  for (const key of MOUTH_KEYS) rig.mouthNow[key] = approach(rig.mouthNow[key], rig.mouthTarget[key], kMouth);
  const mn = rig.mouthNow;

  // Blink and saccades: no timers, all driven by the frame clock.
  if (rig.blink.start === null && t >= rig.blink.next) {
    rig.blink.start = t;
    rig.blink.next = t + 2.2 + Math.random() * 3.6;
  }
  let lid = 1;
  if (rig.blink.start !== null) {
    const p = (t - rig.blink.start) / 0.16;
    if (p >= 1) rig.blink.start = null;
    else lid = Math.max(0.08, 1 - Math.sin(Math.PI * p));
  }
  const sc = rig.sacc;
  if (t >= sc.next) {
    sc.tx = (Math.random() - 0.5) * 2.4;
    sc.ty = (Math.random() - 0.5) * 1.4;
    sc.next = t + 0.9 + Math.random() * 2.4;
  }
  const kSacc = 1 - Math.exp(-dt * 12);
  sc.x = approach(sc.x, sc.tx, kSacc);
  sc.y = approach(sc.y, sc.ty, kSacc);

  const breath = Math.sin(t * 1.6) * 1.4 * (rig.reduced ? 0.5 : 1);

  // Arms: 2-bone IK, then transforms and hand shapes.
  for (const side of ["L", "R"] as const) {
    const a = c[side];
    const bend = Math.abs(a.b) < 0.15 ? Math.sign(a.b || 1) * 0.15 : a.b;
    const [a1, a2] = solveArm(side, a.x, a.y, bend, a.s);
    const shoulder = SHOULDER[side];
    put(
      els,
      `${side}.arm`,
      "transform",
      `translate(${shoulder.x} ${(shoulder.y + breath).toFixed(2)}) scale(${side === "R" ? -1 : 1} 1) rotate(${deg(a1).toFixed(2)})`,
    );
    put(els, `${side}.upper`, "height", String(100 * a.s + 16));
    put(els, `${side}.fore`, "transform", `translate(0 ${100 * a.s}) rotate(${deg(a2).toFixed(2)})`);
    put(els, `${side}.hand`, "transform", `translate(0 ${FORE_LEN - 6}) rotate(${a.w.toFixed(2)})`);
    if (rig.applied[side] !== c.hands[side]) {
      applyHand(els, side, c.hands[side]);
      rig.applied[side] = c.hands[side];
    }
  }

  // Head, torso, eyes, brows, cheeks, mouth.
  put(
    els,
    "head",
    "transform",
    `translate(${(200 + c.lean * 0.5).toFixed(2)} ${(210 + c.bob + breath * 0.6 + c.lean * 0.3).toFixed(2)}) rotate(${c.tilt.toFixed(2)})`,
  );
  put(els, "torso", "transform", `translate(0 ${(breath * 0.5).toFixed(2)})`);
  for (const eye of ["eyeL", "eyeR"]) {
    put(els, `${eye}.lid`, "transform", `scale(1 ${lid.toFixed(3)})`);
    put(els, `${eye}.iris`, "transform", `translate(${(c.lookX + sc.x * 0.5).toFixed(2)} ${(c.lookY + sc.y * 0.5).toFixed(2)})`);
  }
  put(els, "browL", "transform", `translate(0 ${(mo.brow - mo.browTilt * 0.4).toFixed(2)}) rotate(${(-mo.browTilt).toFixed(2)} -22 -20)`);
  put(els, "browR", "transform", `translate(0 ${(mo.brow + mo.browTilt * 0.4).toFixed(2)}) rotate(${(mo.browTilt * 0.3).toFixed(2)} 22 -20)`);
  put(els, "cheekL", "opacity", mo.cheek.toFixed(3));
  put(els, "cheekR", "opacity", mo.cheek.toFixed(3));

  const mg = mouthGeometry(mn.o, mn.w, mn.r, mo.smile);
  put(els, "mouthPath", "d", mg.d);
  put(els, "mouthClip", "d", mg.d);
  put(els, "lip", "d", mg.line);
  put(els, "teeth", "x", (-mg.hw * 0.7).toFixed(2));
  put(els, "teeth", "width", (mg.hw * 1.4).toFixed(2));
  put(els, "teeth", "y", (mg.up - 2.5).toFixed(2));
  put(els, "teeth", "opacity", mn.teeth.toFixed(2));
  put(els, "tongue", "cy", (mg.lo - mg.h * 0.25).toFixed(2));
  put(els, "tongue", "rx", (mg.hw * 0.55).toFixed(2));
  put(els, "tongue", "ry", Math.max(1, mg.h * 0.3).toFixed(2));
  put(els, "tongue", "opacity", mn.tongue.toFixed(2));

  // Tone trail: follows the contract contour while a trace is active, then fades.
  const tr = rig.trail;
  if (patch?.trace) {
    if (!tr.on || tr.tone !== patch.trace.tone) {
      tr.on = true;
      tr.tone = patch.trace.tone;
      tr.pts = [];
      tr.fadeStart = null;
      put(els, "guide", "d", toneBoxPath(patch.trace.tone, TRACE_BOX_SVG));
    }
    const p = toneBoxPoint(patch.trace.tone, patch.trace.u, TRACE_BOX_SVG);
    if (tr.pts.length < 400) tr.pts.push([p.x, p.y]);
  } else if (tr.on) {
    tr.on = false;
    tr.fadeStart = t;
  }
  const fade = tr.fadeStart === null ? 0 : clamp(1 - (t - tr.fadeStart - 1.8) / 0.6, 0, 1);
  const visible = tr.on ? 1 : fade;
  put(els, "trail", "d", pathFrom(tr.pts));
  put(els, "trail", "opacity", visible.toFixed(3));
  put(els, "guide", "opacity", (0.28 * visible).toFixed(3));
}

function personaVars(look: PersonaLook): CSSProperties {
  return {
    "--skin": look.skinColor,
    "--skin-shade": look.skinShadeColor,
    "--hair": look.hairColor,
    "--hair-hi": `color-mix(in srgb, ${look.hairColor} 70%, #ffffff)`,
    "--outfit": look.outfitPrimary,
    "--outfit-dark": `color-mix(in srgb, ${look.outfitPrimary} 70%, #000000)`,
    "--blouse": look.outfitSecondary,
    "--glow": look.accentColor,
    "--glow-2": "#ff7a8a",
    "--lip": "#b9545f",
  } as CSSProperties;
}

function Eye({ side, x }: { side: Side; x: number }) {
  return (
    <g data-k={`eye${side}`} transform={`translate(${x} 4)`}>
      <g data-k={`eye${side}.lid`}>
        <ellipse rx="9.5" ry="10.5" fill="#fffaf5" />
        <g data-k={`eye${side}.iris`}>
          <circle r="6.8" fill="#4a2c22" />
          <circle r="3.6" fill="#140c0a" />
          <circle cx="-2.2" cy="-2.4" r="1.9" fill="#fff" />
        </g>
      </g>
      <path d="M-11 -6 Q0 -14 11 -6" fill="none" style={{ stroke: "var(--hair)" }} strokeWidth="2.6" strokeLinecap="round" />
    </g>
  );
}

function Arm({ side, uid }: { side: Side; uid: string }) {
  return (
    <g data-k={`${side}.arm`}>
      <rect data-k={`${side}.upper`} x="-16" y="-10" width="32" height="116" rx="16" fill={`url(#${uid}-outfitG)`} />
      <g data-k={`${side}.fore`}>
        <rect x="-14" y="-8" width="28" height="90" rx="14" fill={`url(#${uid}-outfitG)`} />
        <rect x="-14.5" y="76" width="29" height="8" rx="4" style={{ fill: "var(--outfit-dark)" }} />
        <g data-k={`${side}.hand`}>
          <ellipse cx="0" cy="14" rx="13" ry="15" style={{ fill: "var(--skin)" }} />
          {FINGERS.map((f, i) => (
            <rect
              key={i}
              data-k={`${side}.f${i}`}
              x={f.x}
              y={f.y}
              width="5.5"
              height={f.h}
              rx="2.75"
              style={{ fill: "var(--skin)" }}
            />
          ))}
          <rect
            data-k={`${side}.th`}
            x="-17"
            y="4"
            width="6"
            height="16"
            rx="3"
            style={{ fill: "var(--skin)" }}
            transform="rotate(32 -14 12)"
          />
        </g>
      </g>
    </g>
  );
}

function HairBack({ uid, style }: { uid: string; style: HairStyle }) {
  const fill = { fill: `url(#${uid}-hairG)` } as CSSProperties;
  const hairSolid = { fill: "var(--hair)" } as CSSProperties;
  switch (style) {
    case "short":
      return <path d="M-62 -20 C-66 -80 -36 -96 0 -96 C36 -96 66 -80 62 -20 L58 -6 L-58 -6 Z" style={fill} />;
    case "bun":
      return (
        <g>
          <path d="M-60 -18 C-64 -74 -36 -92 0 -92 C36 -92 64 -74 60 -18 L60 0 L-60 0 Z" style={fill} />
          <circle cx="0" cy="-100" r="20" style={hairSolid} />
        </g>
      );
    case "curly":
      return (
        <g style={hairSolid}>
          {[
            [-66, -30, 22],
            [-56, -70, 24],
            [-20, -92, 24],
            [20, -92, 24],
            [56, -70, 24],
            [66, -30, 22],
            [-70, 10, 18],
            [70, 10, 18],
          ].map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} />
          ))}
        </g>
      );
    case "braids":
      return (
        <g>
          <path d="M-62 -20 C-66 -80 -36 -96 0 -96 C36 -96 66 -80 62 -20 L58 -6 L-58 -6 Z" style={fill} />
          <path d="M-52 -4 C-62 22 -48 48 -54 84" fill="none" style={{ stroke: "var(--hair)" }} strokeWidth="11" strokeLinecap="round" />
          <path d="M52 -4 C62 22 48 48 54 84" fill="none" style={{ stroke: "var(--hair)" }} strokeWidth="11" strokeLinecap="round" />
        </g>
      );
    case "bob":
    default:
      return (
        <path
          d="M-72 -18 C-80 -84 -40 -104 0 -104 C40 -104 80 -84 72 -18 L76 44 C62 56 50 52 46 42 L-46 42 C-50 52 -62 56 -76 44 Z"
          style={fill}
        />
      );
  }
}

function HairFront({ uid, style }: { uid: string; style: HairStyle }) {
  const fill = { fill: `url(#${uid}-hairG)` } as CSSProperties;
  if (style === "bob" || style === "curly") {
    return (
      <path
        d="M-62 -26 C-62 -80 -22 -94 8 -90 C42 -87 66 -64 62 -24 C54 -44 40 -54 24 -58 C30 -48 30 -40 26 -34 C14 -50 -4 -58 -22 -56 C-40 -52 -52 -42 -62 -26 Z"
        style={fill}
      />
    );
  }
  return (
    <path
      d="M-56 -30 C-54 -70 -20 -82 8 -80 C40 -78 58 -56 56 -30 C44 -46 28 -56 6 -58 C-16 -60 -40 -48 -56 -30 Z"
      style={fill}
    />
  );
}

function OutfitDetails({ uid, style }: { uid: string; style: OutfitStyle }) {
  const blouse = { fill: "var(--blouse)" } as CSSProperties;
  const dark = { fill: "var(--outfit-dark)" } as CSSProperties;
  const stroke = { stroke: "var(--outfit-dark)" } as CSSProperties;
  switch (style) {
    case "blouse_stripe":
      return (
        <g>
          <path d="M170 303 L200 372 L230 303 Z" style={blouse} />
          <g clipPath={`url(#${uid}-torso)`}>
            {[340, 368, 396, 424, 452].map((y) => (
              <line key={y} x1="60" x2="340" y1={y} y2={y} strokeWidth="5" opacity=".45" style={stroke} />
            ))}
          </g>
        </g>
      );
    case "blazer":
      return (
        <g>
          <path d="M160 303 L198 392 L168 432 L136 326 Z" style={dark} />
          <path d="M240 303 L202 392 L232 432 L264 326 Z" style={dark} />
          <path d="M170 303 L200 372 L230 303 Z" style={blouse} />
          <circle cx="200" cy="420" r="3" style={{ fill: "var(--glow)" }} />
        </g>
      );
    case "scrubs":
      return (
        <g>
          <path d="M184 303 L200 326 L216 303 Z" style={blouse} />
          <rect x="226" y="396" width="34" height="28" rx="4" style={dark} />
        </g>
      );
    case "cardigan":
    default:
      return (
        <g>
          <path d="M170 303 L200 372 L230 303 Z" style={blouse} />
          <path d="M166 303 C176 318 186 340 200 372 C214 340 224 318 234 303" fill="none" style={stroke} strokeWidth="3" />
          <path d="M178 303 C186 322 194 338 200 350 C206 338 214 322 222 303" fill="none" style={{ stroke: "var(--glow)" }} strokeWidth="1.6" opacity=".9" />
          <circle cx="200" cy="352" r="3.6" style={{ fill: "var(--glow)" }} />
          <circle cx="200" cy="420" r="3" style={dark} />
          <circle cx="200" cy="462" r="3" style={dark} />
        </g>
      );
  }
}

function PropLayer({ prop }: { prop: Prop }) {
  switch (prop) {
    case "tea_cup":
      return (
        <g>
          <ellipse cx="0" cy="18" rx="16" ry="4" style={{ fill: "var(--blouse)" }} />
          <path d="M-9 4 H9 V12 Q9 18 0 18 Q-9 18 -9 12 Z" style={{ fill: "var(--blouse)" }} />
          <path d="M9 7 Q16 7 16 11 Q16 14 9 14" fill="none" style={{ stroke: "var(--blouse)" }} strokeWidth="2.5" />
        </g>
      );
    case "book":
      return (
        <g>
          <rect x="-12" y="-16" width="24" height="30" rx="2" style={{ fill: "var(--glow-2)" }} />
          <line x1="-7" x2="7" y1="-5" y2="-5" style={{ stroke: "var(--blouse)" }} strokeWidth="1.5" />
        </g>
      );
    case "menu":
      return (
        <g>
          <rect x="-12" y="-18" width="24" height="32" rx="2" style={{ fill: "var(--blouse)" }} />
          <line x1="-7" x2="7" y1="-8" y2="-8" style={{ stroke: "var(--outfit-dark)" }} strokeWidth="1.5" />
          <line x1="-7" x2="7" y1="0" y2="0" style={{ stroke: "var(--outfit-dark)" }} strokeWidth="1.5" />
        </g>
      );
    case "croissant":
      return <path d="M-16 6 Q-10 -12 0 -4 Q10 -12 16 6 Q6 4 0 10 Q-6 4 -16 6 Z" style={{ fill: "var(--glow)" }} />;
    case "clipboard":
      return (
        <g>
          <rect x="-11" y="-16" width="22" height="30" rx="2" style={{ fill: "var(--blouse)" }} />
          <rect x="-5" y="-19" width="10" height="5" style={{ fill: "var(--outfit)" }} />
        </g>
      );
    case "stethoscope":
      return (
        <g>
          <path d="M-8 -14 Q-14 8 0 12 Q14 8 8 -14" fill="none" style={{ stroke: "var(--hair)" }} strokeWidth="2.5" />
          <circle cx="0" cy="16" r="4" style={{ fill: "var(--glow)" }} />
        </g>
      );
    case "none":
    default:
      return null;
  }
}

/**
 * The placeholder teacher. Pass a ref to drive it through AvatarDriver; `onEvent` receives gesture
 * and trace lifecycle events.
 */
export const PlaceholderTeacher = forwardRef<AvatarDriver, AvatarProps>(function PlaceholderTeacher(
  { persona, reducedMotion = false, onEvent, className },
  ref,
) {
  const rawId = useId();
  const uid = `pt${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const look: PersonaLook = { ...DEFAULT_PERSONA_LOOK, ...persona };
  // The rig is mutable animation state. It lives in a ref and is only touched from effects and handles.
  const rigRef = useRef<Rig>(createRig());
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const rig = rigRef.current;
    rig.onEvent = onEvent;
    rig.reduced = reducedMotion;
  });

  useImperativeHandle(ref, () => createDriver(rigRef.current), []);

  useEffect(() => {
    const rig = rigRef.current;
    const root = svgRef.current;
    if (!root) return;
    const els = new Map<string, SVGElement>();
    root.querySelectorAll<SVGElement>("[data-k]").forEach((el) => {
      const key = el.getAttribute("data-k");
      if (key) els.set(key, el);
    });
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = clamp((now - last) / 1000, 0, 0.05);
      last = now;
      tick(rig, els, dt);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const cssVars = personaVars(look);

  return (
    <svg
      ref={svgRef}
      viewBox="-40 -10 480 510"
      preserveAspectRatio="xMidYMax meet"
      role="img"
      aria-label="Animated AI teacher (placeholder)"
      className={className}
      style={cssVars}
    >
      <defs>
        <radialGradient id={`${uid}-rim`} cx="50%" cy="45%" r="55%">
          <stop offset="0" style={{ stopColor: "var(--glow)" }} stopOpacity=".55" />
          <stop offset=".55" style={{ stopColor: "var(--glow-2)" }} stopOpacity=".16" />
          <stop offset="1" style={{ stopColor: "var(--glow-2)" }} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-outfitG`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--outfit)" }} />
          <stop offset="1" style={{ stopColor: "var(--outfit-dark)" }} />
        </linearGradient>
        <linearGradient id={`${uid}-hairG`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--hair-hi)" }} />
          <stop offset=".6" style={{ stopColor: "var(--hair)" }} />
        </linearGradient>
        <radialGradient id={`${uid}-faceG`} cx="45%" cy="38%" r="70%">
          <stop offset=".55" style={{ stopColor: "var(--skin)" }} />
          <stop offset="1" style={{ stopColor: "var(--skin-shade)" }} />
        </radialGradient>
        <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id={`${uid}-mouthClip`}>
          <path data-k="mouthClip" d={MOUTH_D0} />
        </clipPath>
        <clipPath id={`${uid}-torso`}>
          <path d={TORSO_D} />
        </clipPath>
      </defs>

      <ellipse cx="200" cy="270" rx="230" ry="250" fill={`url(#${uid}-rim)`} />

      <g data-k="body">
        <g data-k="torso">
          <path d={TORSO_D} fill={`url(#${uid}-outfitG)`} />
          <OutfitDetails uid={uid} style={look.outfitStyle} />
        </g>
        <path d="M185 262 L185 306 Q200 318 215 306 L215 262 Z" style={{ fill: "var(--skin-shade)" }} />

        <g data-k="head" transform="translate(200 210)">
          <HairBack uid={uid} style={look.hairStyle} />
          <ellipse cx="-57" cy="4" rx="9" ry="14" style={{ fill: "var(--skin-shade)" }} />
          <ellipse cx="57" cy="4" rx="9" ry="14" style={{ fill: "var(--skin-shade)" }} />
          <circle cx="-58" cy="22" r="3.4" style={{ fill: "var(--glow)" }} />
          <circle cx="58" cy="22" r="3.4" style={{ fill: "var(--glow)" }} />
          <path
            d="M-56 -8 C-56 -60 -30 -78 0 -78 C30 -78 56 -60 56 -8 C56 32 34 66 0 70 C-34 66 -56 32 -56 -8 Z"
            fill={`url(#${uid}-faceG)`}
          />
          <circle data-k="cheekL" cx="-33" cy="26" r="10" style={{ fill: "var(--glow-2)" }} opacity=".22" />
          <circle data-k="cheekR" cx="33" cy="26" r="10" style={{ fill: "var(--glow-2)" }} opacity=".22" />
          <Eye side="L" x={-22} />
          <Eye side="R" x={22} />
          <path data-k="browL" d="M-34 -16 Q-22 -24 -10 -18" fill="none" style={{ stroke: "var(--hair)" }} strokeWidth="3.6" strokeLinecap="round" />
          <path data-k="browR" d="M10 -18 Q22 -24 34 -16" fill="none" style={{ stroke: "var(--hair)" }} strokeWidth="3.6" strokeLinecap="round" />
          <path d="M1 12 Q-4 25 2 28" fill="none" style={{ stroke: "var(--skin-shade)" }} strokeWidth="2.4" strokeLinecap="round" />
          <g transform="translate(0 44)">
            <path data-k="mouthPath" d={MOUTH_D0} fill="#5a1f2c" />
            <g clipPath={`url(#${uid}-mouthClip)`}>
              <rect data-k="teeth" x="-10" y="-8" width="20" height="5" fill="#fffaf2" opacity="0" />
              <ellipse data-k="tongue" cx="0" cy="6" rx="6" ry="3" fill="#e0727c" opacity="0" />
            </g>
            <path data-k="lip" d={MOUTH_LINE0} fill="none" style={{ stroke: "var(--lip)" }} strokeWidth="2.2" strokeLinecap="round" />
          </g>
          <HairFront uid={uid} style={look.hairStyle} />
        </g>

        <Arm side="L" uid={uid} />
        <Arm side="R" uid={uid} />
        <g transform="translate(70 404)">
          <PropLayer prop={look.prop} />
        </g>
      </g>

      <path data-k="guide" d="" fill="none" style={{ stroke: "var(--glow)" }} strokeWidth="1.6" strokeDasharray="2 6" strokeLinecap="round" opacity="0" />
      <path
        data-k="trail"
        d=""
        fill="none"
        style={{ stroke: "var(--glow)" }}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${uid}-glow)`}
        opacity="0"
      />
    </svg>
  );
});
