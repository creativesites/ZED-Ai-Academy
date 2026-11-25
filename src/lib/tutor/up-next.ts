import type { DailyPlanItem } from "./mastery/sprint.ts";
import { academyHref } from "./academy-href.ts";

// "Up next with <Teacher>" (UX spec §3, P1-09): one primary action and at most two secondary links, chosen
// from what the learner already has in flight. Pure: the server loader gathers the inputs.
//
// Priority for the primary action (live classes are owned by the classroom card, not this one):
//   1. Due revision (weak objectives)            -> revision sprint
//   2. Teacher assignment due within 48 h/overdue -> assigned session
//   3. Unfinished teaching session (< 48 h)       -> continue it
//   4. Next lesson (prefers one with a teacher moment, see buildDailyPlan)
//   5. Other open assignments
//   6. Cards due for review
//   7. Suggested flow in an enrolled course
// (UX §3 item 5, "failed quiz objectives not yet revisited", has no data source yet: quiz evidence is Phase 2.)

export type UpNextKind = "revision" | "assignment" | "resume" | "lesson" | "cards" | "flow";

export type UpNextAction = {
  id: string;
  kind: UpNextKind;
  /** Button / link text, e.g. "Start 5-min revision". */
  label: string;
  /** What it is about, e.g. the objective, lesson or session title. */
  detail: string;
  href: string;
  durationMinutes?: number;
};

export type UpNextSession = {
  sessionId: string;
  /** Null for revision sprints, which cannot be resumed from a link. */
  scenarioId: string | null;
  title: string;
  startedAt: string;
};

export type UpNextAssignment = {
  assignmentId: string;
  scenarioId: string;
  title: string;
  dueAt: string | null;
  completed: boolean;
  maxMinutes?: number | null;
};

export type UpNextInput = {
  /** The learner's academy (null: platform). Every href is built with academyHref. */
  academySlug: string | null;
  teacherName: string;
  /** Daily plan items (buildDailyPlan). Hrefs may be platform paths; they are re-scoped here. */
  planItems: ReadonlyArray<DailyPlanItem>;
  activeSessions?: ReadonlyArray<UpNextSession>;
  assignments?: ReadonlyArray<UpNextAssignment>;
  dueCards?: number;
  now: Date;
};

export type UpNext = {
  primary: UpNextAction | null;
  /** At most two, never the same kind as the primary or each other. */
  secondary: UpNextAction[];
  /** The teacher's one-line prompt above the button. */
  line: string;
};

const RESUME_WINDOW_MS = 48 * 60 * 60 * 1000;
const ASSIGNMENT_SOON_MS = 48 * 60 * 60 * 1000;
export const MAX_SECONDARY = 2;

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

function practicePath(scenarioId: string): string {
  return `/practice/${encodeURIComponent(scenarioId)}`;
}

export function pickUpNext(input: UpNextInput): UpNext {
  const scope = (path: string) => academyHref(input.academySlug, path);
  const nowMs = input.now.getTime();
  const ranked: Array<{ rank: number; action: UpNextAction }> = [];

  for (const item of input.planItems) {
    if (item.kind === "revision_sprint") {
      const focus = item.objectiveTexts[0] ?? item.subtitle;
      ranked.push({
        rank: 1,
        action: {
          id: item.id,
          kind: "revision",
          label: `Start ${item.durationMinutes}-min revision`,
          detail: focus,
          href: scope(item.href),
          durationMinutes: item.durationMinutes,
        },
      });
    } else if (item.kind === "unfinished_lesson") {
      ranked.push({
        rank: 4,
        action: {
          id: item.id,
          kind: "lesson",
          label: "Continue lesson",
          detail: item.title,
          href: scope(item.href),
          durationMinutes: item.durationMinutes,
        },
      });
    } else if (item.kind === "untried_flow") {
      ranked.push({
        rank: 7,
        action: {
          id: item.id,
          kind: "flow",
          label: "Try a teaching session",
          detail: item.title,
          href: scope(item.href),
          durationMinutes: item.durationMinutes,
        },
      });
    }
  }

  const openAssignments = (input.assignments ?? [])
    .filter((a) => !a.completed && a.scenarioId)
    .map((a) => ({ a, due: parseTime(a.dueAt) }))
    .sort((x, y) => (x.due ?? Number.POSITIVE_INFINITY) - (y.due ?? Number.POSITIVE_INFINITY));
  for (const { a, due } of openAssignments) {
    const soon = due !== null && due - nowMs <= ASSIGNMENT_SOON_MS;
    ranked.push({
      rank: soon ? 2 : 5,
      action: {
        id: `assignment-${a.assignmentId}`,
        kind: "assignment",
        label: due !== null && due < nowMs ? "Do overdue assignment" : "Start assignment",
        detail: a.title,
        // Same link as the Teacher home's assignment list: the session page finds the assignment itself.
        href: scope(practicePath(a.scenarioId)),
        durationMinutes: a.maxMinutes ?? undefined,
      },
    });
  }

  const resumable = (input.activeSessions ?? [])
    .filter((s) => {
      const started = parseTime(s.startedAt);
      return s.scenarioId && started !== null && started <= nowMs && nowMs - started < RESUME_WINDOW_MS;
    })
    .sort((x, y) => (parseTime(y.startedAt) ?? 0) - (parseTime(x.startedAt) ?? 0));
  const latest = resumable[0];
  if (latest?.scenarioId) {
    ranked.push({
      rank: 3,
      action: {
        id: `resume-${latest.sessionId}`,
        kind: "resume",
        label: "Return to session",
        detail: latest.title,
        href: scope(practicePath(latest.scenarioId)),
      },
    });
  }

  const dueCards = Math.max(0, Math.floor(input.dueCards ?? 0));
  if (dueCards > 0) {
    ranked.push({
      rank: 6,
      action: {
        id: "cards-due",
        kind: "cards",
        label: `${dueCards} ${dueCards === 1 ? "card" : "cards"} due`,
        detail: "Review your cards",
        href: scope("/practice/deck"),
      },
    });
  }

  // Stable: equal ranks keep insertion order (plan order, then due date order).
  const ordered = ranked
    .map((r, i) => ({ ...r, i }))
    .sort((x, y) => x.rank - y.rank || x.i - y.i)
    .map((r) => r.action);

  const primary = ordered[0] ?? null;
  const secondary: UpNextAction[] = [];
  const usedKinds = new Set<UpNextKind>(primary ? [primary.kind] : []);
  const usedHrefs = new Set<string>(primary ? [primary.href] : []);
  for (const action of ordered.slice(1)) {
    if (secondary.length >= MAX_SECONDARY) break;
    if (usedKinds.has(action.kind) || usedHrefs.has(action.href)) continue;
    usedKinds.add(action.kind);
    usedHrefs.add(action.href);
    secondary.push(action);
  }

  return { primary, secondary, line: teacherLine(primary) };
}

/** A short, honest line for the primary action. No invented memories: those come from the memory brief later. */
export function teacherLine(primary: UpNextAction | null): string {
  if (!primary) return "Ready when you are.";
  switch (primary.kind) {
    case "revision":
      return `Let's make "${primary.detail}" stick with a quick revision.`;
    case "assignment":
      return `Your teacher assigned "${primary.detail}". Shall we do it now?`;
    case "resume":
      return `You started "${primary.detail}" but did not finish. Want to go back to it?`;
    case "lesson":
      return `Next up: "${primary.detail}".`;
    case "cards":
      return "A few cards are ready for review.";
    case "flow":
    default:
      return "Ready when you are.";
  }
}
