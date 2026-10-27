import type {
  FaceStyle,
  Gesture,
  HairStyle,
  Mood,
  OutfitStyle,
  Prop,
  ToneShape,
  VisemeValue,
} from "@/lib/tutor/contract.generated";
import { TEACHER_VM_PROPS } from "@/lib/tutor/contract.generated";

/**
 * The interface every teacher renderer implements: the SVG placeholder now, the Rive teacher later.
 * The rest of the app only talks to this, so swapping renderers never touches callers.
 */
export interface AvatarDriver {
  playGesture(name: Gesture, opts?: { toneShape?: ToneShape; countTo?: number }): void;
  setMood(mood: Mood, intensity?: number): void;
  setViseme(v: VisemeValue): void;
  setSpeaking(on: boolean): void;
  setListening(on: boolean, voiceLevel?: number): void;
  setThinking(on: boolean): void;
  lookAt(x: number, y: number): void; // -100..100 like the contract
}

export type AvatarEvent = {
  type: "gestureStart" | "gesturePeak" | "gestureEnd" | "traceStart" | "traceEnd";
  gesture?: Gesture;
  toneShape?: ToneShape;
};

/** Colour, costume and face fields of TeacherVM, with defaults taken from the contract. */
export type PersonaLook = {
  skinColor: string;
  skinShadeColor: string;
  hairColor: string;
  outfitPrimary: string;
  outfitSecondary: string;
  accentColor: string;
  hairStyle: HairStyle;
  outfitStyle: OutfitStyle;
  prop: Prop;
  /** Contract 1.1.0. The placeholder ignores it; the Rive teacher uses it. */
  faceStyle: FaceStyle;
};

export const DEFAULT_PERSONA_LOOK: PersonaLook = {
  skinColor: TEACHER_VM_PROPS.skinColor.default,
  skinShadeColor: TEACHER_VM_PROPS.skinShadeColor.default,
  hairColor: TEACHER_VM_PROPS.hairColor.default,
  outfitPrimary: TEACHER_VM_PROPS.outfitPrimary.default,
  outfitSecondary: TEACHER_VM_PROPS.outfitSecondary.default,
  accentColor: TEACHER_VM_PROPS.accentColor.default,
  hairStyle: TEACHER_VM_PROPS.hairStyle.default,
  outfitStyle: TEACHER_VM_PROPS.outfitStyle.default,
  prop: TEACHER_VM_PROPS.prop.default,
  faceStyle: TEACHER_VM_PROPS.faceStyle.default,
};

export type AvatarProps = {
  persona?: Partial<PersonaLook>;
  reducedMotion?: boolean;
  onEvent?: (e: AvatarEvent) => void;
  className?: string;
};
