/**
 * Academy invite links (/i/{code}). Pure: no I/O and no imports, so it runs
 * under `node --experimental-strip-types` tests, on the server and in the
 * browser. Server-side reads and writes live in invites-server.ts.
 */

/** URL-safe and unambiguous: no 0/O, no 1/I/L. Upper case only, so codes read aloud or typed still match. */
export const INVITE_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const INVITE_CODE_LENGTH = 8;

const INVITE_CODE_RE = new RegExp(`^[${INVITE_CODE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`);

/**
 * A new invite code. Pass `crypto.randomInt` (node:crypto) on the server; it is
 * injected so this module stays import-free.
 */
export function generateInviteCode(randomInt: (max: number) => number): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

/** Normalize a code from a URL or typed by hand (trim, upper case). Null if it cannot be a code. */
export function normalizeInviteCode(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return INVITE_CODE_RE.test(code) ? code : null;
}

export type InviteState = {
  revoked_at: string | null;
  expires_at: string | null;
  max_uses: number | null;
  uses: number;
};

export type InviteStatus = "active" | "revoked" | "expired" | "used_up";

/** Whether a link can still be used. Revoked wins over expired, which wins over used up. */
export function inviteStatus(invite: InviteState, now: Date = new Date()): InviteStatus {
  if (invite.revoked_at) return "revoked";
  if (invite.expires_at) {
    const expires = new Date(invite.expires_at).getTime();
    if (!Number.isNaN(expires) && expires <= now.getTime()) return "expired";
  }
  if (invite.max_uses !== null && invite.max_uses !== undefined && invite.uses >= invite.max_uses) {
    return "used_up";
  }
  return "active";
}

export function isInviteUsable(invite: InviteState, now: Date = new Date()): boolean {
  return inviteStatus(invite, now) === "active";
}

export const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  active: "Active",
  revoked: "Revoked",
  expired: "Expired",
  used_up: "Used up",
};

export type InviteExpiryChoice = "never" | "7d" | "30d";

export function parseExpiryChoice(raw: unknown): InviteExpiryChoice {
  return raw === "7d" || raw === "30d" ? raw : "never";
}

/** expires_at for a choice in the "New invite link" sheet. */
export function inviteExpiresAt(choice: InviteExpiryChoice, now: Date = new Date()): string | null {
  if (choice === "never") return null;
  const days = choice === "7d" ? 7 : 30;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

/** max_uses from a form field: a positive whole number, or null (unlimited). */
export function parseMaxUses(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return Math.min(n, 100000);
}

/** The public link: /i/{code} on whatever host the admin is using. */
export function inviteUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/i/${code}`;
}

export function inviteShareMessage(academyName: string): string {
  return `You're invited to join ${academyName}. Tap the link to create your account and get into the classroom:`;
}

// ---------------------------------------------------------------------------
// Next live class shown on the invite page
// ---------------------------------------------------------------------------

export type ScheduleFacts = {
  id: string;
  title: string;
  is_recurring: boolean | null;
  /** 1 = Monday ... 7 = Sunday (as stored by the timetable). */
  day_of_week: number | null;
  /** "HH:MM" or "HH:MM:SS", academy-local time. */
  start_time_only: string | null;
  starts_at: string | null;
  group_id: string | null;
};

export type NextClass = {
  id: string;
  title: string;
  /** When it starts, as UTC ISO (recurring times converted from academy-local time). */
  startsAt: string;
  recurring: boolean;
};

/** Zambia (CAT) is UTC+2 all year, no daylight saving. */
export const ACADEMY_TZ_OFFSET_MINUTES = 120;

function nextRecurringStart(s: ScheduleFacts, now: Date, offsetMinutes: number): Date | null {
  if (!s.day_of_week || s.day_of_week < 1 || s.day_of_week > 7 || !s.start_time_only) return null;
  const match = s.start_time_only.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  // Work in academy-local wall-clock time by shifting "now".
  const local = new Date(now.getTime() + offsetMinutes * 60_000);
  const localDow = local.getUTCDay() === 0 ? 7 : local.getUTCDay();
  let diff = s.day_of_week - localDow;
  const candidate = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + diff, hours, minutes)
  );
  if (candidate.getTime() <= local.getTime()) {
    diff += 7;
    candidate.setUTCDate(candidate.getUTCDate() + 7);
  }
  return new Date(candidate.getTime() - offsetMinutes * 60_000);
}

/**
 * The soonest upcoming class: one-off classes in the future, and the next
 * occurrence of each weekly class. When `groupId` is given, classes for other
 * groups are ignored (classes for everyone, group_id null, always count).
 */
export function pickNextClass(
  schedules: ScheduleFacts[],
  now: Date = new Date(),
  opts: { groupId?: string | null; offsetMinutes?: number } = {}
): NextClass | null {
  const offset = opts.offsetMinutes ?? ACADEMY_TZ_OFFSET_MINUTES;
  let best: NextClass | null = null;
  for (const s of schedules) {
    if (s.group_id && opts.groupId !== undefined && s.group_id !== opts.groupId) continue;
    let start: Date | null = null;
    if (s.is_recurring) {
      start = nextRecurringStart(s, now, offset);
    } else if (s.starts_at) {
      const t = new Date(s.starts_at);
      if (!Number.isNaN(t.getTime()) && t.getTime() > now.getTime()) start = t;
    }
    if (!start) continue;
    if (!best || start.getTime() < new Date(best.startsAt).getTime()) {
      best = { id: s.id, title: s.title, startsAt: start.toISOString(), recurring: Boolean(s.is_recurring) };
    }
  }
  return best;
}
