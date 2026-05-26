export const COURSE_DOMAIN_PRESETS = [
  {
    id: "ai-professional",
    label: "AI & Digital Skills",
    description: "Prompting, automation, analytics, and workplace AI adoption.",
    suggestedCategory: "AI for Business",
  },
  {
    id: "technical-vocational",
    label: "Technical & Vocational",
    description: "Hands-on procedures, diagnostics, operations, and applied job skills.",
    suggestedCategory: "Technical & Vocational",
  },
  {
    id: "mining-safety",
    label: "Mining Safety",
    description: "Safety routines, hazard recognition, compliance, and field readiness.",
    suggestedCategory: "Mining Safety",
  },
  {
    id: "primary-school",
    label: "Primary School",
    description: "Foundational literacy, numeracy, science, and age-appropriate activities.",
    suggestedCategory: "Primary School",
  },
  {
    id: "secondary-school",
    label: "Secondary School",
    description: "Structured lessons, exam prep, deeper concepts, and classroom discussion.",
    suggestedCategory: "Secondary School",
  },
] as const;

export type CourseDomainPresetId = (typeof COURSE_DOMAIN_PRESETS)[number]["id"];

export function getCourseDomainPreset(id: string | null | undefined) {
  return COURSE_DOMAIN_PRESETS.find((preset) => preset.id === id) ?? COURSE_DOMAIN_PRESETS[0];
}
