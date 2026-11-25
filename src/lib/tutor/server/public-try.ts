import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { DemoScenario, DemoScene } from "../demo-scenarios.ts";
import type { SceneArtboard } from "../rive-driver.ts";
import { personaLookFromVariant, sceneFromValue, type TutorPersonaLook } from "../tutor-session-block.ts";
import { DEFAULT_PRIMARY_COLOR } from "@/lib/brand";

export type PublicTryScenarioData = {
  scenario: DemoScenario;
  scene: SceneArtboard;
  look?: Partial<TutorPersonaLook>;
  academy: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    primaryColor: string | null;
  };
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeDemoLanguage(skillPack: string, personaLangs: string[]): "zh" | "es" | "fr" | "en" {
  const raw = skillPack.startsWith("language-") ? skillPack.slice("language-".length) : (personaLangs[0] || "en");
  if (raw === "zh" || raw === "es" || raw === "fr" || raw === "en") return raw;
  return "en";
}

function normalizeDemoSkillPack(skillPack: string): DemoScenario["skillPack"] {
  if (
    skillPack === "language-zh" ||
    skillPack === "language-es" ||
    skillPack === "language-fr" ||
    skillPack === "general-tutor"
  ) {
    return skillPack;
  }
  return "general-tutor";
}

function normalizeDemoScene(scene: SceneArtboard): DemoScene {
  if (
    scene === "Scene_TeaHouse" ||
    scene === "Scene_Cafe" ||
    scene === "Scene_Rooftop" ||
    scene === "Scene_Clinic"
  ) {
    return scene;
  }
  return "Scene_Clinic";
}

function extractVoiceName(voice: unknown): string {
  if (voice && typeof voice === "object") {
    const rec = voice as Record<string, unknown>;
    if (typeof rec.voiceName === "string" && rec.voiceName.trim()) {
      return rec.voiceName.trim();
    }
  }
  return "Kore";
}

function parseBeats(raw: unknown): Array<{ id: string; goal: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ id: string; goal: string }> = [];
  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i];
    if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      const goal = typeof rec.goal === "string" ? rec.goal.trim() : "";
      if (goal) {
        const id = typeof rec.id === "string" && rec.id.trim() ? rec.id.trim() : `step-${i + 1}`;
        out.push({ id, goal });
      }
    }
  }
  return out;
}

function parseTargetItems(raw: unknown): Array<{ text: string; pron?: string; meaning?: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ text: string; pron?: string; meaning?: string }> = [];
  for (const item of raw) {
    if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      const text = typeof rec.text === "string" ? rec.text.trim() : "";
      if (text) {
        out.push({
          text,
          pron: typeof rec.pron === "string" ? rec.pron : undefined,
          meaning: typeof rec.meaning === "string" ? rec.meaning : undefined,
        });
      }
    }
  }
  return out;
}

/**
 * Loads a published, publicly shareable scenario (`platform` or `tenant_library`) for `/try/[scenarioId]`.
 * Never exposes `draft` or private `course`-only scenarios.
 */
export async function loadPublicTryScenario(scenarioId: string): Promise<PublicTryScenarioData | null> {
  if (!UUID_RE.test(scenarioId)) return null;
  const supabase = createServiceClient();

  const { data: row } = await supabase
    .from("practice_scenarios")
    .select(
      "id, company_id, title, goal, skill_pack, level, max_minutes, status, visibility, persona_id, scene, beats, target_items",
    )
    .eq("id", scenarioId)
    .eq("status", "published")
    .in("visibility", ["platform", "tenant_library"])
    .maybeSingle();

  if (!row) return null;

  const [{ data: persona }, { data: company }] = await Promise.all([
    row.persona_id
      ? supabase
          .from("ai_personas")
          .select("id, name, display_name, languages, personality_prompt, voice, rive_variant")
          .eq("id", row.persona_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    row.company_id
      ? supabase
          .from("companies")
          .select("id, name, slug, logo_url, primary_color")
          .eq("id", row.company_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const personaLangs = Array.isArray(persona?.languages) && persona.languages.length > 0 ? persona.languages : ["en"];
  const lang = normalizeDemoLanguage(row.skill_pack, personaLangs);
  const actualScene = sceneFromValue(row.scene) ?? "Scene_Classroom";

  const scenario: DemoScenario = {
    key: row.id as DemoScenario["key"],
    title: row.title,
    blurb: row.goal,
    goal: row.goal,
    skillPack: normalizeDemoSkillPack(row.skill_pack),
    language: lang,
    level: row.level ?? "Interactive Mini-Lesson",
    maxMinutes: Math.min(5, Math.max(2, row.max_minutes ?? 4)),
    scene: normalizeDemoScene(actualScene),
    thumb: { from: "#EEF4FF", to: "#E6F8FE" },
    persona: {
      id: persona?.id ?? "default",
      preset: "tendai",
      name: persona?.name ?? "AI Teacher",
      displayName: persona?.display_name ?? persona?.name ?? "AI Teacher",
      languages: personaLangs,
      personalityPrompt:
        persona?.personality_prompt ??
        "Warm, clear, encouraging AI teacher guiding a short interactive mini-lesson.",
      voiceName: extractVoiceName(persona?.voice),
    },
    beats: parseBeats(row.beats),
    targetItems: parseTargetItems(row.target_items),
    roleNotes:
      "This is a public interactive AI Teacher session. Give the learner an engaging, memorable hands-on experience following the beats closely, using show_board (with equations, charts, diagrams, or compare visuals when helpful) and ask_choice so every turn has clear interactive controls.",
    allowedModes: ["voice", "text"],
    scripted: { learnerLines: [], turns: [] },
    scriptedReport: {
      scores: { task: 85 },
      strengths: ["Completed the interactive mini-lesson!"],
      mistakes: [],
      nextStep: "Join the academy to unlock full lessons and Study Deck review.",
    },
  };

  return {
    scenario,
    scene: actualScene,
    look: persona ? personaLookFromVariant(persona.rive_variant) : undefined,
    academy: {
      id: company?.id ?? "platform",
      name: company?.name ?? "CS Learn",
      slug: company?.slug ?? "",
      logoUrl: company?.logo_url ?? null,
      primaryColor: company?.primary_color ?? DEFAULT_PRIMARY_COLOR,
    },
  };
}
