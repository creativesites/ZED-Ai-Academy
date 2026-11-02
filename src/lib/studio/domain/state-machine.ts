/**
 * Live session lifecycle. Pure functions only: the database enforces the same
 * table inside transition_live_session() (see the studio migration), so these
 * rules and that SQL must change together.
 */
export const SESSION_STATUSES = [
  "draft",
  "scheduled",
  "live",
  "ended",
  "cancelled",
  "failed",
] as const;

export type SessionStatus = (typeof SESSION_STATUSES)[number];

const TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
  draft: ["scheduled", "cancelled"],
  scheduled: ["live", "cancelled", "failed"],
  live: ["ended", "failed"],
  failed: ["scheduled", "cancelled"],
  ended: [],
  cancelled: [],
};

export function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Returns the target status to store. Re-applying the current state is a no-op
 * (idempotent), so double-clicks and retries are safe. Anything else not in the
 * table throws.
 */
export function nextStatus(from: SessionStatus, to: SessionStatus): SessionStatus {
  if (from === to) return from;
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
  return to;
}

// No TypeScript parameter properties here: `node --test` strips types only.
export class InvalidTransitionError extends Error {
  readonly from: SessionStatus;
  readonly to: SessionStatus;

  constructor(from: SessionStatus, to: SessionStatus) {
    super(`Cannot move a live session from "${from}" to "${to}".`);
    this.name = "InvalidTransitionError";
    this.from = from;
    this.to = to;
  }
}
