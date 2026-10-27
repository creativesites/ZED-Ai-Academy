import { GESTURES, RIVE_EVENTS, TONE_SHAPES } from "./contract.generated.ts";
import type { FaceStyle, Gesture, HairStyle, Mood, OutfitStyle, Prop, ToneShape, VisemeValue } from "./contract.generated.ts";

// Pure mapping from AvatarDriver calls to TeacherVM writes, plus the scene controller, the Rive event
// normaliser and the FPS guard. Nothing here imports the Rive runtime, so it runs under `npm run test:tutor`.
// The component layer (components/tutor/avatar/RiveTeacher.tsx) supplies a VmPort backed by the runtime.

export type RGB = [number, number, number];

/** The writes the controllers need from a view model instance. Names are contract names. */
export interface VmPort {
  setEnum(name: string, value: string): void;
  setNumber(name: string, value: number): void;
  setBoolean(name: string, value: boolean): void;
  setColor(name: string, rgb: RGB): void;
  fireTrigger(name: string): void;
}

/** Parses "#rgb" or "#rrggbb" (the # is optional). Returns null for anything else. */
export function parseHexColor(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const digits = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  const n = parseInt(digits, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Colour, costume and face fields of TeacherVM. Colours are hex strings. */
export type TeacherLook = {
  skinColor: string;
  skinShadeColor: string;
  hairColor: string;
  outfitPrimary: string;
  outfitSecondary: string;
  accentColor: string;
  hairStyle: HairStyle;
  outfitStyle: OutfitStyle;
  prop: Prop;
  faceStyle: FaceStyle;
};

const COLOR_KEYS: ReadonlyArray<keyof TeacherLook> = [
  "skinColor",
  "skinShadeColor",
  "hairColor",
  "outfitPrimary",
  "outfitSecondary",
  "accentColor",
];
const ENUM_LOOK_KEYS: ReadonlyArray<keyof TeacherLook> = ["hairStyle", "outfitStyle", "prop", "faceStyle"];

export type TeacherState = {
  gesture: Gesture;
  toneShape: ToneShape;
  countTo: number;
  mood: Mood;
  moodIntensity: number;
  viseme: VisemeValue;
  speaking: boolean;
  listening: boolean;
  thinking: boolean;
  voiceLevel: number;
  lookX: number;
  lookY: number;
  reducedMotion: boolean;
};

const DEFAULT_STATE: TeacherState = {
  gesture: "idle",
  toneShape: "t1",
  countTo: 3,
  mood: "warm",
  moodIntensity: 70,
  viseme: 0,
  speaking: false,
  listening: false,
  thinking: false,
  voiceLevel: 0,
  lookX: 0,
  lookY: 0,
  reducedMotion: false,
};

const DEFAULT_LOOK: TeacherLook = {
  skinColor: "#E8B48F",
  skinShadeColor: "#C98D6A",
  hairColor: "#2A2230",
  outfitPrimary: "#2FA37F",
  outfitSecondary: "#FFF4E2",
  accentColor: "#FFB547",
  hairStyle: "bob",
  outfitStyle: "cardigan",
  prop: "none",
  faceStyle: "lin",
};

/**
 * Maps AvatarDriver calls onto TeacherVM. The state is kept here, so calls made before the Rive file
 * has loaded are not lost: attach() writes the whole state and fires a gesture requested in the meantime.
 */
export class TeacherVmController {
  private port: VmPort | null = null;
  private state: TeacherState = { ...DEFAULT_STATE };
  private look: TeacherLook = { ...DEFAULT_LOOK };
  private triggerPending = false;

  get attached(): boolean {
    return this.port !== null;
  }

  snapshot(): { state: TeacherState; look: TeacherLook } {
    return { state: { ...this.state }, look: { ...this.look } };
  }

  attach(port: VmPort): void {
    this.port = port;
    const s = this.state;
    port.setEnum("gesture", s.gesture);
    port.setEnum("toneShape", s.toneShape);
    port.setNumber("countTo", s.countTo);
    port.setEnum("mood", s.mood);
    port.setNumber("moodIntensity", s.moodIntensity);
    port.setNumber("viseme", s.viseme);
    port.setBoolean("speaking", s.speaking);
    port.setBoolean("listening", s.listening);
    port.setBoolean("thinking", s.thinking);
    port.setNumber("voiceLevel", s.voiceLevel);
    port.setNumber("lookX", s.lookX);
    port.setNumber("lookY", s.lookY);
    port.setBoolean("reducedMotion", s.reducedMotion);
    this.writeLook([...COLOR_KEYS, ...ENUM_LOOK_KEYS]);
    if (this.triggerPending) {
      this.triggerPending = false;
      port.fireTrigger("playGesture");
    }
  }

  detach(): void {
    this.port = null;
  }

  // AvatarDriver. Arrow properties, so the handle keeps working when a caller detaches a method.

  playGesture = (name: Gesture, opts?: { toneShape?: ToneShape; countTo?: number }): void => {
    const s = this.state;
    s.gesture = name;
    if (name === "trace_tone" || opts?.toneShape !== undefined) s.toneShape = opts?.toneShape ?? "t1";
    if (name === "count" || opts?.countTo !== undefined) s.countTo = Math.round(clamp(opts?.countTo ?? 3, 1, 5));
    if (!this.port) {
      this.triggerPending = true;
      return;
    }
    this.port.setEnum("gesture", s.gesture);
    this.port.setEnum("toneShape", s.toneShape);
    this.port.setNumber("countTo", s.countTo);
    this.port.fireTrigger("playGesture");
  };

  setMood = (mood: Mood, intensity = 70): void => {
    this.state.mood = mood;
    this.state.moodIntensity = Math.round(clamp(intensity, 0, 100));
    this.port?.setEnum("mood", mood);
    this.port?.setNumber("moodIntensity", this.state.moodIntensity);
  };

  setViseme = (v: VisemeValue): void => {
    this.state.viseme = Math.round(clamp(v, 0, 8)) as VisemeValue;
    this.port?.setNumber("viseme", this.state.viseme);
  };

  setSpeaking = (on: boolean): void => {
    this.state.speaking = on;
    this.port?.setBoolean("speaking", on);
    if (!on) {
      // Same as the placeholder: a voice that stops closes the mouth.
      this.state.viseme = 0;
      this.port?.setNumber("viseme", 0);
    }
  };

  setListening = (on: boolean, voiceLevel?: number): void => {
    this.state.listening = on;
    this.port?.setBoolean("listening", on);
    if (voiceLevel !== undefined) {
      this.state.voiceLevel = Math.round(clamp(voiceLevel, 0, 100));
      this.port?.setNumber("voiceLevel", this.state.voiceLevel);
    }
  };

  setThinking = (on: boolean): void => {
    this.state.thinking = on;
    this.port?.setBoolean("thinking", on);
  };

  lookAt = (x: number, y: number): void => {
    this.state.lookX = Math.round(clamp(x, -100, 100));
    this.state.lookY = Math.round(clamp(y, -100, 100));
    this.port?.setNumber("lookX", this.state.lookX);
    this.port?.setNumber("lookY", this.state.lookY);
  };

  // Not part of AvatarDriver: set from props by the component.

  setReducedMotion = (on: boolean): void => {
    this.state.reducedMotion = on;
    this.port?.setBoolean("reducedMotion", on);
  };

  /** Sets persona fields. An invalid colour is ignored and the previous value stays. */
  setLook = (patch: Partial<TeacherLook>): void => {
    const changed: Array<keyof TeacherLook> = [];
    for (const key of Object.keys(patch) as Array<keyof TeacherLook>) {
      const value = patch[key];
      if (value === undefined) continue;
      if (COLOR_KEYS.includes(key)) {
        if (typeof value !== "string" || parseHexColor(value) === null) continue;
      }
      (this.look as unknown as Record<string, unknown>)[key] = value;
      changed.push(key);
    }
    this.writeLook(changed);
  };

  private writeLook(keys: ReadonlyArray<keyof TeacherLook>): void {
    if (!this.port) return;
    for (const key of keys) {
      if (COLOR_KEYS.includes(key)) {
        const rgb = parseHexColor(this.look[key] as string);
        if (rgb) this.port.setColor(key, rgb);
      } else if (ENUM_LOOK_KEYS.includes(key)) {
        this.port.setEnum(key, this.look[key] as string);
      }
    }
  }
}

// Scene controller ----------------------------------------------------------------------------

export const SCENE_ARTBOARDS = ["Scene_TeaHouse", "Scene_Cafe", "Scene_Rooftop", "Scene_Clinic"] as const;
export type SceneArtboard = (typeof SCENE_ARTBOARDS)[number];

export type SceneOptions = {
  timeOfDay: number;
  parallaxX: number;
  parallaxY: number;
  /** The caller's wish. The effective flag also needs reducedMotion off and no low-performance flag. */
  ambience: boolean;
  reducedMotion: boolean;
  lowPerformance: boolean;
};

const DEFAULT_SCENE: SceneOptions = {
  timeOfDay: 70,
  parallaxX: 0,
  parallaxY: 0,
  ambience: true,
  reducedMotion: false,
  lowPerformance: false,
};

/** Effective ambience: wanted by the caller, motion not reduced, and the page is not struggling. */
export function ambienceOn(o: Pick<SceneOptions, "ambience" | "reducedMotion" | "lowPerformance">): boolean {
  return o.ambience && !o.reducedMotion && !o.lowPerformance;
}

export class SceneVmController {
  private port: VmPort | null = null;
  private opts: SceneOptions = { ...DEFAULT_SCENE };
  private celebratePending = false;

  get attached(): boolean {
    return this.port !== null;
  }

  snapshot(): SceneOptions {
    return { ...this.opts };
  }

  attach(port: VmPort): void {
    this.port = port;
    this.writeAll();
    if (this.celebratePending) {
      this.celebratePending = false;
      port.fireTrigger("celebrate");
    }
  }

  detach(): void {
    this.port = null;
  }

  setOptions = (patch: Partial<SceneOptions>): void => {
    const next: SceneOptions = { ...this.opts };
    if (patch.timeOfDay !== undefined) next.timeOfDay = Math.round(clamp(patch.timeOfDay, 0, 100));
    if (patch.parallaxX !== undefined) next.parallaxX = Math.round(clamp(patch.parallaxX, -100, 100));
    if (patch.parallaxY !== undefined) next.parallaxY = Math.round(clamp(patch.parallaxY, -100, 100));
    if (patch.ambience !== undefined) next.ambience = patch.ambience;
    if (patch.reducedMotion !== undefined) next.reducedMotion = patch.reducedMotion;
    if (patch.lowPerformance !== undefined) next.lowPerformance = patch.lowPerformance;
    // Reduced motion also holds the parallax still.
    if (next.reducedMotion) {
      next.parallaxX = 0;
      next.parallaxY = 0;
    }
    this.opts = next;
    this.writeAll();
  };

  celebrate = (): void => {
    if (!this.port) {
      this.celebratePending = true;
      return;
    }
    this.port.fireTrigger("celebrate");
  };

  private writeAll(): void {
    if (!this.port) return;
    const o = this.opts;
    this.port.setNumber("timeOfDay", o.timeOfDay);
    this.port.setNumber("parallaxX", o.parallaxX);
    this.port.setNumber("parallaxY", o.parallaxY);
    this.port.setBoolean("ambience", ambienceOn(o));
    this.port.setBoolean("reducedMotion", o.reducedMotion);
  }
}

// Events --------------------------------------------------------------------------------------

export type NormalisedAvatarEvent = {
  type: (typeof RIVE_EVENTS)[number];
  gesture?: Gesture;
  toneShape?: ToneShape;
};

/**
 * Turns a Rive event (name plus properties) into an AvatarEvent. Unknown names are dropped, and so are
 * unknown property values, so the EventPlayer never receives a gesture it cannot match.
 */
export function toAvatarEvent(name: string, properties?: Record<string, unknown>): NormalisedAvatarEvent | null {
  if (!(RIVE_EVENTS as readonly string[]).includes(name)) return null;
  const out: NormalisedAvatarEvent = { type: name as NormalisedAvatarEvent["type"] };
  const gesture = properties?.gesture;
  const toneShape = properties?.toneShape;
  if (typeof gesture === "string" && (GESTURES as readonly string[]).includes(gesture)) out.gesture = gesture as Gesture;
  if (typeof toneShape === "string" && (TONE_SHAPES as readonly string[]).includes(toneShape)) {
    out.toneShape = toneShape as ToneShape;
  }
  return out;
}

// FPS guard -----------------------------------------------------------------------------------

export type FpsGuardOptions = {
  thresholdFps?: number;
  warmupMs?: number;
  windowMs?: number;
  /** Consecutive windows under the threshold before onLowPerformance fires. The warm-up is the first window. */
  lowWindowsToTrigger?: number;
  onWindow?: (fps: number) => void;
  onLowPerformance?: () => void;
};

/**
 * Counts animation frames in windows: a 3 s warm-up, then 2 s windows. onLowPerformance fires once,
 * when two windows in a row are under the threshold (45 fps). The first second after reset() is
 * skipped, because page load and the first scene decode stall frames and are not steady-state cost.
 * Call reset() when measuring should start again, for example after the tab was hidden.
 */
export class FpsGuard {
  private readonly opts: FpsGuardOptions;
  private readonly threshold: number;
  private readonly warmupMs: number;
  private readonly windowMs: number;
  private readonly lowNeeded: number;
  private readonly settleMs: number;
  private windowStart: number | null = null;
  private frames = 0;
  private currentWindow: number;
  private lowRun = 0;
  private fired = false;

  constructor(opts: FpsGuardOptions & { settleMs?: number } = {}) {
    this.opts = opts;
    this.threshold = opts.thresholdFps ?? 45;
    this.warmupMs = opts.warmupMs ?? 3000;
    this.windowMs = opts.windowMs ?? 2000;
    this.lowNeeded = opts.lowWindowsToTrigger ?? 2;
    this.settleMs = opts.settleMs ?? 1000;
    this.currentWindow = this.warmupMs;
  }

  get triggered(): boolean {
    return this.fired;
  }

  reset(now: number): void {
    this.windowStart = now + this.settleMs;
    this.frames = 0;
    this.currentWindow = this.warmupMs;
    this.lowRun = 0;
  }

  /** Call once per animation frame with the frame timestamp in ms. */
  frame(now: number): void {
    if (this.windowStart === null) {
      this.reset(now);
      return;
    }
    // Frames inside the settle period are not counted.
    if (now < this.windowStart) return;
    this.frames += 1;
    const elapsed = now - this.windowStart;
    if (elapsed < this.currentWindow) return;

    const fps = (this.frames * 1000) / elapsed;
    this.opts.onWindow?.(fps);
    if (!this.fired) {
      if (fps < this.threshold) {
        this.lowRun += 1;
        if (this.lowRun >= this.lowNeeded) {
          this.fired = true;
          this.opts.onLowPerformance?.();
        }
      } else {
        this.lowRun = 0;
      }
    }
    this.windowStart = now;
    this.frames = 0;
    this.currentWindow = this.windowMs;
  }
}
