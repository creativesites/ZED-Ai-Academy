// GENERATED — do not edit; run npm run gen:tutor-contract
// Source: docs/rive/teacher.contract.json (contract version 1.0.1).

export const GESTURES = ["idle", "wave", "nod", "head_shake", "explain", "point_card", "point_left", "point_right", "thumbs_up", "clap", "think", "listen", "celebrate", "count", "shrug", "beckon", "trace_tone", "oops"] as const;

export type Gesture = (typeof GESTURES)[number];

export const TONE_SHAPES = ["t1", "t2", "t3", "t4", "neutral", "rise", "fall"] as const;

export type ToneShape = (typeof TONE_SHAPES)[number];

export const MOODS = ["neutral", "warm", "happy", "proud", "curious", "surprised", "concerned", "playful"] as const;

export type Mood = (typeof MOODS)[number];

export const HAIR_STYLES = ["bob", "curly", "bun", "short", "braids"] as const;

export type HairStyle = (typeof HAIR_STYLES)[number];

export const OUTFIT_STYLES = ["cardigan", "blouse_stripe", "blazer", "scrubs"] as const;

export type OutfitStyle = (typeof OUTFIT_STYLES)[number];

export const PROPS = ["none", "tea_cup", "book", "menu", "croissant", "clipboard", "stethoscope"] as const;

export type Prop = (typeof PROPS)[number];

export const VISEMES = [
  {
    value: 0,
    name: "rest"
  },
  {
    value: 1,
    name: "AA"
  },
  {
    value: 2,
    name: "EH"
  },
  {
    value: 3,
    name: "EE"
  },
  {
    value: 4,
    name: "OH"
  },
  {
    value: 5,
    name: "OO"
  },
  {
    value: 6,
    name: "MBP"
  },
  {
    value: 7,
    name: "FV"
  },
  {
    value: 8,
    name: "CONS"
  }
] as const;

export type VisemeValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const TEACHER_VM_PROPS = {
  gesture: {
    type: "enum",
    enum: "Gesture",
    default: "idle"
  },
  playGesture: {
    type: "trigger"
  },
  toneShape: {
    type: "enum",
    enum: "ToneShape",
    default: "t1"
  },
  countTo: {
    type: "number",
    min: 1,
    max: 5,
    default: 3
  },
  mood: {
    type: "enum",
    enum: "Mood",
    default: "warm"
  },
  moodIntensity: {
    type: "number",
    min: 0,
    max: 100,
    default: 70
  },
  viseme: {
    type: "number",
    min: 0,
    max: 8,
    default: 0
  },
  speaking: {
    type: "boolean",
    default: false
  },
  listening: {
    type: "boolean",
    default: false
  },
  thinking: {
    type: "boolean",
    default: false
  },
  voiceLevel: {
    type: "number",
    min: 0,
    max: 100,
    default: 0
  },
  lookX: {
    type: "number",
    min: -100,
    max: 100,
    default: 0
  },
  lookY: {
    type: "number",
    min: -100,
    max: 100,
    default: 0
  },
  reducedMotion: {
    type: "boolean",
    default: false
  },
  skinColor: {
    type: "color",
    default: "#E8B48F"
  },
  skinShadeColor: {
    type: "color",
    default: "#C98D6A"
  },
  hairColor: {
    type: "color",
    default: "#2A2230"
  },
  outfitPrimary: {
    type: "color",
    default: "#2FA37F"
  },
  outfitSecondary: {
    type: "color",
    default: "#FFF4E2"
  },
  accentColor: {
    type: "color",
    default: "#FFB547"
  },
  hairStyle: {
    type: "enum",
    enum: "HairStyle",
    default: "bob"
  },
  outfitStyle: {
    type: "enum",
    enum: "OutfitStyle",
    default: "cardigan"
  },
  prop: {
    type: "enum",
    enum: "Prop",
    default: "none"
  }
} as const;

export const SCENE_VM_PROPS = {
  timeOfDay: {
    type: "number",
    min: 0,
    max: 100,
    default: 70
  },
  parallaxX: {
    type: "number",
    min: -100,
    max: 100,
    default: 0
  },
  parallaxY: {
    type: "number",
    min: -100,
    max: 100,
    default: 0
  },
  celebrate: {
    type: "trigger"
  },
  ambience: {
    type: "boolean",
    default: true
  },
  reducedMotion: {
    type: "boolean",
    default: false
  }
} as const;

export const RIVE_EVENTS = ["gestureStart", "gesturePeak", "gestureEnd", "traceStart", "traceEnd"] as const;

export const ARTBOARDS = {
  Teacher: {
    size: [1200, 1500],
    stateMachine: "TeacherSM",
    viewModel: "TeacherVM"
  },
  TeacherBust: {
    size: [512, 512],
    stateMachine: "BustSM",
    viewModel: "TeacherVM"
  },
  Scene_TeaHouse: {
    size: [2400, 1500],
    stateMachine: "SceneSM",
    viewModel: "SceneVM"
  },
  Scene_Cafe: {
    size: [2400, 1500],
    stateMachine: "SceneSM",
    viewModel: "SceneVM"
  },
  Scene_Rooftop: {
    size: [2400, 1500],
    stateMachine: "SceneSM",
    viewModel: "SceneVM"
  },
  Scene_Clinic: {
    size: [2400, 1500],
    stateMachine: "SceneSM",
    viewModel: "SceneVM"
  }
} as const;

export const TONE_TRACE = {
  traceBox: [760, 360, 1120, 720],
  durationMs: {
    t1: 900,
    t2: 900,
    t3: 1100,
    t4: 800,
    neutral: 400,
    rise: 1300,
    fall: 1100
  },
  paths: {
    t1: [
      [0, 0.03],
      [1, 0.03]
    ],
    t2: [
      [0, 0.5],
      [0.5, 0.36],
      [1, 0.03]
    ],
    t3: [
      [0, 0.75],
      [0.45, 0.97],
      [1, 0.25]
    ],
    t4: [
      [0, 0.03],
      [1, 0.97]
    ],
    neutral: [
      [0.4, 0.75],
      [0.6, 0.78]
    ],
    rise: [
      [0, 0.62],
      [0.6, 0.58],
      [1, 0.08]
    ],
    fall: [
      [0, 0.2],
      [0.5, 0.35],
      [1, 0.9]
    ]
  }
} as const;

export const ANCHORS = {
  cardTarget: [180, 640],
  headCenter: [600, 545],
  mouthCenter: [600, 690]
} as const;

export const CONTRACT_VERSION = "1.0.1" as const;
