import type { TutorEvent } from "./events.ts";
import type { TutorReportContent } from "./report-model.ts";

// The four public showcase scenarios, in code (no database). Each has a persona, the beats and target
// items the live demo API uses as prompt context, and a scripted turn sequence for the zero-cost
// "Watch the demo" mode. Pure data: relative imports only, no React, so node:test can check it.

export const DEMO_SCENARIO_KEYS = ["zh-tea-house", "es-cafe", "fr-boulangerie", "health-intake"] as const;
export type DemoScenarioKey = (typeof DEMO_SCENARIO_KEYS)[number];

export const DEMO_SCENES = ["Scene_TeaHouse", "Scene_Cafe", "Scene_Rooftop", "Scene_Clinic"] as const;
export type DemoScene = (typeof DEMO_SCENES)[number];

/** Keys of the Rive cast in design/rive/presets.json, resolved to looks in the client. */
export type DemoPresetKey = "lin" | "sofia" | "camille" | "tendai";

export type DemoBeat = { id: string; goal: string; targetItems?: string[] };

export type DemoTargetItem = { text: string; pron?: string; meaning?: string };

export type DemoPersona = {
  id: string;
  name: string;
  displayName: string;
  languages: string[];
  preset: DemoPresetKey;
  /** Gemini prebuilt voice for TTS. */
  voiceName: string;
  personalityPrompt: string;
};

export type ScriptedDemo = {
  /** What the simulated learner said before each entry in `turns`. null for the opening. */
  learnerLines: (string | null)[];
  /** The teacher's events for each turn: the opening, then one entry per learner line. The last one ends the session. */
  turns: TutorEvent[][];
};

export type DemoScenario = {
  key: DemoScenarioKey;
  title: string;
  /** One line for the picker card. */
  blurb: string;
  goal: string;
  level: string;
  language: "zh" | "es" | "fr" | "en";
  skillPack: "language-zh" | "language-es" | "language-fr" | "general-tutor";
  maxMinutes: number;
  allowedModes: ("voice" | "text")[];
  scene: DemoScene;
  persona: DemoPersona;
  beats: DemoBeat[];
  targetItems: DemoTargetItem[];
  /** Extra role instructions for the prompt (used for the training simulation). */
  roleNotes?: string;
  /** Two colours for the picker thumbnail, from the scene's dusk palette. */
  thumb: { from: string; to: string };
  scripted: ScriptedDemo;
  /** The report shown at the end of the scripted demo. */
  scriptedReport: TutorReportContent;
};

export const DEMO_MAX_MINUTES = 6;

const LIN: DemoPersona = {
  id: "lin-laoshi",
  name: "Lín Lǎoshī",
  displayName: "Lín Lǎoshī",
  languages: ["zh", "en"],
  preset: "lin",
  voiceName: "Kore",
  personalityPrompt:
    "You are Lín Lǎoshī, a patient, warm Mandarin teacher who runs a quiet tea house. You are precise about tones, encouraging, and never rush the learner.",
};

const SOFIA: DemoPersona = {
  id: "sofia",
  name: "Sofía",
  displayName: "Sofía",
  languages: ["es", "en"],
  preset: "sofia",
  voiceName: "Aoede",
  personalityPrompt:
    "You are Sofía, a cheerful barista in Seville who teaches Spanish through everyday café talk. You are warm, a little playful, and patient.",
};

const CAMILLE: DemoPersona = {
  id: "camille",
  name: "Camille",
  displayName: "Camille",
  languages: ["fr", "en"],
  preset: "camille",
  voiceName: "Leda",
  personalityPrompt:
    "You are Camille, a friendly baker in Paris who teaches French through shop conversations. You are warm, a little playful, and patient.",
};

const TENDAI: DemoPersona = {
  id: "nurse-tendai",
  name: "Nurse Tendai",
  displayName: "Nurse Tendai",
  languages: ["en"],
  preset: "tendai",
  voiceName: "Charon",
  personalityPrompt:
    "You are Nurse Tendai, an experienced nurse who runs English-for-healthcare training simulations. In this scene you play the patient, Mr Mwansa, and stay in character.",
};

const ZH_TEA_HOUSE: DemoScenario = {
  key: "zh-tea-house",
  title: "Ordering tea at a tea house",
  blurb: "Greet, order two cups of tea politely, and practise third-tone sandhi.",
  goal: "Greet the server politely and order two cups of tea with 请.",
  level: "HSK 1",
  language: "zh",
  skillPack: "language-zh",
  maxMinutes: DEMO_MAX_MINUTES,
  allowedModes: ["voice", "text"],
  scene: "Scene_TeaHouse",
  persona: LIN,
  beats: [
    { id: "greet", goal: "Greet the teacher with 你好.", targetItems: ["你好"] },
    { id: "order", goal: "Order two cups of tea politely with 请 and 两杯.", targetItems: ["请", "茶", "两杯"] },
    { id: "thank", goal: "Say thank you with 谢谢 and close the order.", targetItems: ["谢谢"] },
  ],
  targetItems: [
    { text: "你好", pron: "nǐ hǎo", meaning: "hello" },
    { text: "请", pron: "qǐng", meaning: "please" },
    { text: "茶", pron: "chá", meaning: "tea" },
    { text: "两杯", pron: "liǎng bēi", meaning: "two cups" },
    { text: "谢谢", pron: "xièxie", meaning: "thank you" },
  ],
  thumb: { from: "#4a2f5e", to: "#ff9e6d" },
  scripted: {
    learnerLines: [
      null,
      "nǐ hǎo",
      "请给我一杯茶。",
      "请给我两杯茶，谢谢。",
    ],
    turns: [
      [
        { type: "gesture", name: "wave" },
        { type: "mood", mood: "warm", intensity: 80 },
        {
          type: "say",
          text: "欢迎来到茶馆！我是林老师。",
          romanization: "Huānyíng lái dào cháguǎn! Wǒ shì Lín lǎoshī.",
          translation: "Welcome to the tea house! I am Teacher Lín.",
        },
        { type: "show_card", item: { text: "你好", pron: "nǐ hǎo", meaning: "hello" } },
        { type: "trace_tone", tones: ["t3", "t3"], labels: ["nǐ", "hǎo"] },
        { type: "say", text: "跟我说：你好。", romanization: "Gēn wǒ shuō: nǐ hǎo.", translation: "Say after me: hello." },
        { type: "listen", expect: "你好", hint: "nǐ hǎo" },
      ],
      [
        { type: "gesture", name: "nod" },
        { type: "mood", mood: "happy" },
        {
          type: "say",
          text: "很好！你的声调很清楚。",
          romanization: "Hěn hǎo! Nǐ de shēngdiào hěn qīngchu.",
          translation: "Very good! Your tones are clear.",
        },
        { type: "trace_tone", tones: ["t2", "t3"], labels: ["ní", "hǎo"] },
        { type: "say", text: "说快的时候，两个三声会变成：ní hǎo。", translation: "Said quickly, two third tones become ní hǎo." },
        {
          type: "say",
          text: "现在点茶。请说：请给我两杯茶。",
          romanization: "Xiànzài diǎn chá. Qǐng shuō: qǐng gěi wǒ liǎng bēi chá.",
          translation: "Now order tea. Say: please give me two cups of tea.",
        },
        { type: "show_card", item: { text: "两杯", pron: "liǎng bēi", meaning: "two cups" } },
        { type: "listen", expect: "请给我两杯茶", hint: "qǐng gěi wǒ liǎng bēi chá" },
      ],
      [
        { type: "gesture", name: "oops" },
        { type: "mood", mood: "curious" },
        { type: "note_mistake", said: "一杯茶", correct: "两杯茶", category: "vocabulary" },
        {
          type: "say",
          text: "差一点！你和朋友两个人，要说两杯。",
          romanization: "Chà yīdiǎn! Nǐ hé péngyou liǎng ge rén, yào shuō liǎng bēi.",
          translation: "Almost! You and a friend, so say two cups.",
        },
        { type: "show_text", text: "请给我两杯茶", highlight: ["两杯"] },
        { type: "listen", expect: "请给我两杯茶", hint: "Use 两杯, not 一杯." },
      ],
      [
        { type: "gesture", name: "celebrate" },
        { type: "mood", mood: "proud" },
        {
          type: "say",
          text: "太好了！两杯茶，谢谢。",
          romanization: "Tài hǎo le! Liǎng bēi chá, xièxie.",
          translation: "Excellent! Two cups of tea, thank you.",
        },
        { type: "show_card", item: { text: "谢谢", pron: "xièxie", meaning: "thank you" } },
        { type: "advance_scene", beat: "thank" },
        {
          type: "end_session",
          summary:
            "You greeted, ordered two cups of tea and said thank you. Next, practise the third-tone change in 你好.",
        },
      ],
    ],
  },
  scriptedReport: {
    scores: { fluency: 62, accuracy: 70, vocabulary: 75, pronunciation: 68, task: 90 },
    strengths: [
      "You greeted with 你好 and kept the tones clear.",
      "You used 请 to make the order polite.",
    ],
    mistakes: [
      { said: "一杯茶", correct: "两杯茶", category: "vocabulary", note: "Two cups is 两杯 (liǎng bēi)." },
      { said: "nǐ hǎo", correct: "ní hǎo", category: "tone", note: "Two third tones: the first becomes a second tone in speech." },
    ],
    nextStep: "Order again at a counter, using 两杯 and ending with 谢谢.",
  },
};

const ES_CAFE: DemoScenario = {
  key: "es-cafe",
  title: "Ordering a coffee in Seville",
  blurb: "Greet, order a coffee with milk, ask the price and pay.",
  goal: "Order a coffee with milk, ask how much it costs, and say thank you.",
  level: "A1",
  language: "es",
  skillPack: "language-es",
  maxMinutes: DEMO_MAX_MINUTES,
  allowedModes: ["voice", "text"],
  scene: "Scene_Cafe",
  persona: SOFIA,
  beats: [
    { id: "greet", goal: "Greet the barista with Hola.", targetItems: ["Hola"] },
    { id: "order", goal: "Order a coffee with milk, politely.", targetItems: ["Un café con leche, por favor"] },
    { id: "pay", goal: "Ask the price with ¿Cuánto cuesta? and pay.", targetItems: ["¿Cuánto cuesta?"] },
    { id: "thank", goal: "Say thank you and goodbye.", targetItems: ["Gracias"] },
  ],
  targetItems: [
    { text: "Hola", meaning: "hello" },
    { text: "Un café con leche, por favor", meaning: "A coffee with milk, please" },
    { text: "¿Cuánto cuesta?", meaning: "How much does it cost?" },
    { text: "Gracias", meaning: "thank you" },
  ],
  thumb: { from: "#1f3a5f", to: "#ffb867" },
  scripted: {
    learnerLines: [
      null,
      "Hola, un café con leche, por favor.",
      "Sí, con azúcar, por favor. ¿Cuánto cuesta la café?",
      "Aquí tiene. Gracias, adiós.",
    ],
    turns: [
      [
        { type: "gesture", name: "wave" },
        { type: "mood", mood: "warm" },
        { type: "say", text: "¡Hola! Bienvenido a mi café en Sevilla. Soy Sofía.", translation: "Hello! Welcome to my café in Seville. I'm Sofía." },
        { type: "show_card", item: { text: "Un café con leche, por favor", meaning: "A coffee with milk, please" } },
        { type: "say", text: "Pide un café con leche.", translation: "Order a coffee with milk." },
        { type: "listen", expect: "Un café con leche, por favor", hint: "Start with Hola, then order." },
      ],
      [
        { type: "gesture", name: "nod" },
        { type: "mood", mood: "happy" },
        { type: "say", text: "¡Muy bien! ¿Lo quieres con azúcar?", translation: "Very good! Would you like it with sugar?" },
        { type: "show_card", item: { text: "¿Cuánto cuesta?", meaning: "How much does it cost?" } },
        { type: "listen", expect: "¿Cuánto cuesta?", hint: "Ask the price." },
      ],
      [
        { type: "gesture", name: "think" },
        { type: "note_mistake", said: "la café", correct: "el café", category: "grammar" },
        { type: "say", text: "Casi. Es el café, masculino.", translation: "Almost. It's el café, masculine." },
        { type: "show_text", text: "2,50 €", highlight: ["2,50"] },
        { type: "say", text: "Son dos euros con cincuenta.", translation: "That's two euros fifty." },
        { type: "listen", expect: "Gracias", hint: "Pay and say thank you." },
      ],
      [
        { type: "gesture", name: "celebrate" },
        { type: "mood", mood: "proud" },
        { type: "say", text: "¡Gracias a ti! ¡Buen día!", translation: "Thank you! Have a good day!" },
        {
          type: "end_session",
          summary: "You ordered a coffee, asked the price and paid. Next, practise the gender of nouns such as el café.",
        },
      ],
    ],
  },
  scriptedReport: {
    scores: { fluency: 58, accuracy: 66, vocabulary: 70, task: 88 },
    strengths: ["You greeted the barista with Hola.", "Your coffee order was clear and polite."],
    mistakes: [{ said: "la café", correct: "el café", category: "grammar", note: "Café is masculine: el café." }],
    nextStep: "Practise asking for the bill with ¿Cuánto es?",
  },
};

const FR_BOULANGERIE: DemoScenario = {
  key: "fr-boulangerie",
  title: "Buying bread in a Paris bakery",
  blurb: "Greet the baker, ask for a baguette and a croissant, then pay and say goodbye.",
  goal: "Greet the baker, ask for a baguette and a croissant, and say goodbye.",
  level: "A1",
  language: "fr",
  skillPack: "language-fr",
  maxMinutes: DEMO_MAX_MINUTES,
  allowedModes: ["voice", "text"],
  scene: "Scene_Rooftop",
  persona: CAMILLE,
  beats: [
    { id: "greet", goal: "Greet the baker with Bonjour.", targetItems: ["Bonjour"] },
    { id: "order", goal: "Ask for a baguette, s'il vous plaît.", targetItems: ["Je voudrais une baguette, s'il vous plaît"] },
    { id: "extra", goal: "Add a croissant with its article.", targetItems: ["Un croissant"] },
    { id: "close", goal: "Pay and say goodbye with Merci and Au revoir.", targetItems: ["Merci", "Au revoir"] },
  ],
  targetItems: [
    { text: "Bonjour", meaning: "hello" },
    { text: "Je voudrais une baguette, s'il vous plaît", meaning: "I would like a baguette, please" },
    { text: "Un croissant", meaning: "a croissant" },
    { text: "Merci", meaning: "thank you" },
    { text: "Au revoir", meaning: "goodbye" },
  ],
  thumb: { from: "#2b2d6e", to: "#f0705a" },
  scripted: {
    learnerLines: [
      null,
      "Bonjour. Je voudrais une baguette, s'il vous plaît.",
      "Croissant, s'il vous plaît.",
      "Voilà. Merci, au revoir !",
    ],
    turns: [
      [
        { type: "gesture", name: "wave" },
        { type: "mood", mood: "warm" },
        { type: "say", text: "Bonjour ! Bienvenue à ma boulangerie. Je m'appelle Camille.", translation: "Hello! Welcome to my bakery. My name is Camille." },
        {
          type: "show_card",
          item: {
            text: "Je voudrais une baguette, s'il vous plaît.",
            pron: "zhuh voo-DRAY oon ba-GET, seel voo PLAY",
            meaning: "I would like a baguette, please",
          },
        },
        {
          type: "listen",
          expect: "Bonjour. Je voudrais une baguette, s'il vous plaît.",
          hint: "Greet first, then ask for the bread.",
        },
      ],
      [
        { type: "gesture", name: "nod" },
        { type: "mood", mood: "happy" },
        { type: "say", text: "Très bien ! Voilà votre baguette. Et avec ça ?", translation: "Very good! Here is your baguette. Anything else?" },
        { type: "show_card", item: { text: "Un croissant", pron: "uh(n) kwah-SAHN", meaning: "a croissant" } },
        { type: "listen", expect: "Un croissant, s'il vous plaît.", hint: "Add the article: un croissant." },
      ],
      [
        { type: "gesture", name: "point_card" },
        { type: "note_mistake", said: "Croissant", correct: "Un croissant", category: "grammar" },
        {
          type: "say",
          text: "Un croissant, oui ! Toujours avec l'article : un croissant.",
          translation: "A croissant, yes! Always with the article: un croissant.",
        },
        { type: "show_text", text: "3,50 €", highlight: ["3,50"] },
        { type: "say", text: "Ça fait trois euros cinquante.", translation: "That comes to three euros fifty." },
        { type: "listen", expect: "Voilà. Merci, au revoir.", hint: "Pay and say thank you." },
      ],
      [
        { type: "gesture", name: "thumbs_up" },
        { type: "mood", mood: "proud" },
        { type: "say", text: "Parfait ! Bonne journée, et au revoir !", translation: "Perfect! Have a good day, and goodbye!" },
        {
          type: "end_session",
          summary:
            "You greeted, asked for a baguette and a croissant, paid and said goodbye. Next, practise liaisons such as les amis.",
        },
      ],
    ],
  },
  scriptedReport: {
    scores: { fluency: 60, accuracy: 72, vocabulary: 74, task: 92 },
    strengths: ["You used s'il vous plaît correctly.", "You greeted the baker warmly with Bonjour."],
    mistakes: [{ said: "Croissant", correct: "Un croissant", category: "grammar", note: "French nouns come with an article." }],
    nextStep: "Practise saying goodbye and thank you in a shop, with the right register.",
  },
};

const HEALTH_INTAKE: DemoScenario = {
  key: "health-intake",
  title: "Taking a patient history",
  blurb: "You play the nurse. Nurse Tendai plays the patient and you take a short history.",
  goal: "Greet the patient, find the reason for the visit, ask about duration, allergies and medication.",
  level: "B1 healthcare English",
  language: "en",
  skillPack: "general-tutor",
  maxMinutes: DEMO_MAX_MINUTES,
  allowedModes: ["voice", "text"],
  scene: "Scene_Clinic",
  persona: TENDAI,
  beats: [
    { id: "greet", goal: "Greet the patient and ask the reason for the visit.", targetItems: ["What brings you in today?"] },
    { id: "history", goal: "Ask how long the symptoms have lasted.", targetItems: ["How long have you had these symptoms?"] },
    { id: "safety", goal: "Ask about allergies and medication.", targetItems: ["Do you have any allergies?", "Are you taking any medication?"] },
    { id: "close", goal: "Close politely and thank the patient.", targetItems: ["Thank you for your time."] },
  ],
  targetItems: [
    { text: "What brings you in today?", meaning: "Asks the reason for the visit" },
    { text: "How long have you had these symptoms?", meaning: "Asks about duration" },
    { text: "Do you have any allergies?", meaning: "Asks about allergies" },
    { text: "Are you taking any medication?", meaning: "Asks about medication" },
    { text: "Thank you for your time.", meaning: "Closes the history politely" },
  ],
  roleNotes:
    "This is a training simulation for healthcare English. The learner plays the nurse taking a patient's history. Tendai plays the patient, Mr Mwansa, who has had a sore throat and a fever for three days. Stay in character as the patient. Do not give medical advice or diagnoses. If the learner asks for medical advice, say the patient is not a doctor and return to taking the history.",
  thumb: { from: "#0f4c5c", to: "#1fa3a0" },
  scripted: {
    learnerLines: [
      null,
      "Good morning, Mr Mwansa. What brings you in today?",
      "How long you have fever?",
      "Do you have any allergies, or take any medication?",
    ],
    turns: [
      [
        { type: "show_text", text: "Training simulation: take a patient history" },
        { type: "mood", mood: "concerned", intensity: 60 },
        { type: "say", text: "Good morning. I'm Mr Mwansa. I'm not feeling well today." },
        { type: "show_card", item: { text: "What brings you in today?", meaning: "Asks the reason for the visit" } },
        { type: "listen", expect: "What brings you in today?", hint: "Greet the patient, then ask why they came in." },
      ],
      [
        { type: "gesture", name: "think" },
        { type: "mood", mood: "concerned" },
        { type: "say", text: "I have a sore throat and a fever. I feel very tired." },
        { type: "listen", expect: "How long have you had these symptoms?", hint: "Ask about the duration." },
      ],
      [
        { type: "gesture", name: "explain" },
        { type: "note_mistake", said: "How long you have fever?", correct: "How long have you had a fever?", category: "grammar" },
        { type: "say", text: "Since Monday, so about three days." },
        { type: "show_text", text: "Do you have any allergies?", highlight: ["allergies"] },
        { type: "listen", expect: "Do you have any allergies?", hint: "Ask about allergies before medication." },
      ],
      [
        { type: "gesture", name: "nod" },
        { type: "mood", mood: "warm" },
        { type: "say", text: "No known allergies. I take paracetamol now and then." },
        {
          type: "end_session",
          summary:
            "You took a short history: greeting, reason for the visit, duration, allergies and medication. This was a training simulation, not medical advice.",
        },
      ],
    ],
  },
  scriptedReport: {
    scores: { fluency: 64, accuracy: 70, vocabulary: 72, task: 85 },
    strengths: ["You asked the reason for the visit clearly.", "You covered allergies and medication before closing."],
    mistakes: [
      {
        said: "How long you have fever?",
        correct: "How long have you had a fever?",
        category: "grammar",
        note: "Use the present perfect for symptoms that continue: have you had.",
      },
    ],
    nextStep: "Practise a closing summary, for example: Let me explain what happens next.",
  },
};

export const DEMO_SCENARIOS: readonly DemoScenario[] = [ZH_TEA_HOUSE, ES_CAFE, FR_BOULANGERIE, HEALTH_INTAKE];

export function demoScenario(key: string): DemoScenario | undefined {
  return DEMO_SCENARIOS.find((s) => s.key === key);
}
