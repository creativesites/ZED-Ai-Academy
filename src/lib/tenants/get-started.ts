/**
 * The admin hub's first-run "Get started" checklist. Pure: completion is computed
 * from counts the page already loads, so it is unit-tested directly.
 */

/** companies.primary_color's database default: an untouched academy still has it. */
export const DEFAULT_BRAND_COLOR = "#fd5523";

export type GetStartedFacts = {
  logoUrl: string | null | undefined;
  primaryColor: string | null | undefined;
  courseCount: number;
  publishedCourseCount: number;
  learnerCount: number;
};

export type GetStartedStepId = "branding" | "course" | "publish" | "invite";

export type GetStartedStep = { id: GetStartedStepId; done: boolean };

export function hasCustomBranding(facts: Pick<GetStartedFacts, "logoUrl" | "primaryColor">): boolean {
  if (facts.logoUrl && facts.logoUrl.trim()) return true;
  const color = facts.primaryColor?.trim().toLowerCase();
  return Boolean(color && color !== DEFAULT_BRAND_COLOR);
}

export function getStartedSteps(facts: GetStartedFacts): GetStartedStep[] {
  return [
    { id: "branding", done: hasCustomBranding(facts) },
    { id: "course", done: facts.courseCount > 0 },
    { id: "publish", done: facts.publishedCourseCount > 0 },
    { id: "invite", done: facts.learnerCount > 0 },
  ];
}

/** Shown right after the academy is created, and until the first course is published. */
export function shouldShowGetStarted(opts: { welcome: boolean; publishedCourseCount: number }): boolean {
  return opts.welcome || opts.publishedCourseCount === 0;
}

export function whatsappShareUrl(message: string, link: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${message} ${link}`.trim())}`;
}
