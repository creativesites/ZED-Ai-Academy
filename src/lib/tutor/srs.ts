// Pure SM-2 spaced-repetition scheduler for learner_vocab cards.
// No React, no DB, no server imports so node --test and client/server code can share it.

export type ReviewQuality = "again" | "hard" | "good" | "easy";

export type SrsCardState = {
  intervalDays: number;
  ease: number;
  reps: number;
  lapses: number;
  dueAt: string;
};

export type SrsReviewResult = SrsCardState & {
  nextLabel: string;
};

const MIN_EASE = 1.3;
const MAX_EASE = 3.2;
const DAY_MS = 24 * 60 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Applies one SM-2 review to a card and returns its next schedule.
 * - "again": resets reps to 0, increments lapses, schedules 10 minutes from now (intervalDays = 0).
 * - "hard":  keeps progress with a shorter interval and slightly lower ease.
 * - "good":  standard SM-2 step (1d -> 6d -> interval * ease).
 * - "easy":  boosted interval and higher ease.
 */
export function reviewCard(
  card: Pick<SrsCardState, "intervalDays" | "ease" | "reps" | "lapses">,
  quality: ReviewQuality,
  now: Date = new Date(),
): SrsReviewResult {
  const baseEase = Number.isFinite(card.ease) && card.ease > 0 ? clamp(card.ease, MIN_EASE, MAX_EASE) : 2.5;
  const baseInterval = Number.isFinite(card.intervalDays) && card.intervalDays >= 0 ? card.intervalDays : 0;
  const baseReps = Math.max(0, Math.floor(card.reps || 0));
  const baseLapses = Math.max(0, Math.floor(card.lapses || 0));

  let intervalDays = baseInterval;
  let ease = baseEase;
  let reps = baseReps;
  let lapses = baseLapses;
  let dueMs = now.getTime();

  switch (quality) {
    case "again":
      reps = 0;
      lapses = baseLapses + 1;
      intervalDays = 0;
      ease = round2(clamp(baseEase - 0.2, MIN_EASE, MAX_EASE));
      dueMs = now.getTime() + TEN_MINUTES_MS;
      break;

    case "hard":
      reps = baseReps === 0 ? 1 : baseReps + 1;
      intervalDays = baseReps === 0 ? 0.5 : Math.max(1, round2(baseInterval * 1.2));
      ease = round2(clamp(baseEase - 0.15, MIN_EASE, MAX_EASE));
      dueMs = now.getTime() + intervalDays * DAY_MS;
      break;

    case "good":
      reps = baseReps + 1;
      if (baseReps === 0) intervalDays = 1;
      else if (baseReps === 1) intervalDays = 6;
      else intervalDays = Math.max(1, Math.round(baseInterval * baseEase));
      ease = round2(clamp(baseEase, MIN_EASE, MAX_EASE));
      dueMs = now.getTime() + intervalDays * DAY_MS;
      break;

    case "easy":
      reps = baseReps + 1;
      if (baseReps === 0) intervalDays = 4;
      else if (baseReps === 1) intervalDays = 10;
      else intervalDays = Math.max(2, Math.round(baseInterval * baseEase * 1.3));
      ease = round2(clamp(baseEase + 0.15, MIN_EASE, MAX_EASE));
      dueMs = now.getTime() + intervalDays * DAY_MS;
      break;
  }

  return {
    intervalDays,
    ease,
    reps,
    lapses,
    dueAt: new Date(dueMs).toISOString(),
    nextLabel: formatInterval(intervalDays),
  };
}

export function isCardDue(dueAt: string, now: Date = new Date()): boolean {
  const ts = Date.parse(dueAt);
  if (!Number.isFinite(ts)) return true;
  return ts <= now.getTime();
}

export function formatInterval(days: number): string {
  if (days <= 0) return "10m";
  if (days < 1) return `${Math.max(1, Math.round(days * 24))}h`;
  if (days < 14) return `${Math.round(days)}d`;
  if (days < 60) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}

export type DeckSummary = {
  total: number;
  dueNow: number;
  mastered: number;
  learning: number;
};

/** Counts deck progress: mastered = interval >= 14 days and reps >= 2. */
export function summarizeDeck(
  cards: ReadonlyArray<Pick<SrsCardState, "dueAt" | "intervalDays" | "reps">>,
  now: Date = new Date(),
): DeckSummary {
  let dueNow = 0;
  let mastered = 0;
  for (const c of cards) {
    if (isCardDue(c.dueAt, now)) dueNow += 1;
    if (c.intervalDays >= 14 && c.reps >= 2) mastered += 1;
  }
  return {
    total: cards.length,
    dueNow,
    mastered,
    learning: cards.length - mastered,
  };
}
