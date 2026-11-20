import type { TutorScenarioView } from "./tutor-session-block.ts";

// Which teacher a course's learners meet in the lesson dock: the persona of the course's first AI
// Teacher moment, so the dock and the moments are the same character. Without one, the platform default.

export type CourseTeacher = {
  name: string;
  /** Persona look from ai_personas.rive_variant. Undefined: the dock uses the default preset's look. */
  look: NonNullable<TutorScenarioView["persona"]>["look"];
  /** True when no course persona was found and the platform default is used. */
  isDefault: boolean;
};

/** Platform default teacher for subjects without their own: Tinashe, the general business and AI teacher. */
export const DEFAULT_TEACHER_NAME = "Tinashe";

export function courseTeacher(scenarios: Iterable<TutorScenarioView>): CourseTeacher {
  for (const s of scenarios) {
    if (s.persona) {
      return { name: s.persona.displayName ?? s.persona.name, look: s.persona.look, isDefault: false };
    }
  }
  return { name: DEFAULT_TEACHER_NAME, look: undefined, isDefault: true };
}

/** A teacher name safe to place in a prompt: letters, spaces and . ' - only, at most 40 characters. */
export function safeTeacherName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return /^[\p{L}\p{M} .'-]{1,40}$/u.test(name) ? name : null;
}
