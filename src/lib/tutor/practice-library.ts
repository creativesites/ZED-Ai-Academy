import type { Mode, SkillPack } from "./scenario.ts";

// Shapes and grouping for the Practice Room library. Pure, no React, no DB.

export type PracticeLibraryItem = {
  id: string;
  title: string;
  goal: string;
  skillPack: SkillPack;
  level: string | null;
  maxMinutes: number;
  allowedModes: Mode[];
  visibility: "tenant_library" | "platform";
  personaName: string | null;
};

export type LanguageGroup = {
  key: string;
  label: string;
  items: PracticeLibraryItem[];
};

const SKILL_PACK_LABEL: Record<SkillPack, string> = {
  "language-zh": "Mandarin Chinese",
  "language-es": "Spanish",
  "language-fr": "French",
  "health-sim": "Health conversations",
  "general-tutor": "General",
};

/** Human label for a skill pack. Unknown packs show their raw key rather than failing. */
export function skillPackLabel(skillPack: string): string {
  return (SKILL_PACK_LABEL as Record<string, string>)[skillPack] ?? skillPack;
}

const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

/** Sort rank for a level: CEFR bands in order, then anything else, then no level at all. */
export function levelRank(level: string | null): number {
  if (!level) return 100;
  const i = CEFR_ORDER.indexOf(level.trim().toUpperCase());
  return i >= 0 ? i : 50;
}

/**
 * Groups scenarios by skill pack (language), in a stable order, and sorts each group by level and
 * then title. Groups with no scenarios are left out.
 */
export function groupByLanguage(items: readonly PracticeLibraryItem[]): LanguageGroup[] {
  const byKey = new Map<string, LanguageGroup>();
  for (const item of items) {
    const existing = byKey.get(item.skillPack);
    if (existing) {
      existing.items.push(item);
    } else {
      byKey.set(item.skillPack, { key: item.skillPack, label: skillPackLabel(item.skillPack), items: [item] });
    }
  }
  const groups = [...byKey.values()];
  for (const group of groups) {
    group.items.sort((a, b) => levelRank(a.level) - levelRank(b.level) || a.title.localeCompare(b.title));
  }
  return groups.sort((a, b) => a.label.localeCompare(b.label));
}

/** Whether a scenario's session can start with voice or text (live is not offered yet). */
export function startableModes(allowed: readonly Mode[]): Array<Exclude<Mode, "live">> {
  return allowed.filter((mode): mode is Exclude<Mode, "live"> => mode !== "live");
}
