import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  generateInviteCode,
  inviteExpiresAt,
  inviteStatus,
  inviteUrl,
  isInviteUsable,
  normalizeInviteCode,
  parseExpiryChoice,
  parseMaxUses,
  pickNextClass,
  type ScheduleFacts,
} from "./invites.ts";

describe("invite code alphabet", () => {
  it("has no ambiguous characters and is URL-safe", () => {
    for (const ch of "0O1IL") assert.equal(INVITE_CODE_ALPHABET.includes(ch), false, ch);
    assert.match(INVITE_CODE_ALPHABET, /^[A-Z2-9]+$/);
    assert.equal(new Set(INVITE_CODE_ALPHABET).size, INVITE_CODE_ALPHABET.length);
    assert.equal(encodeURIComponent(INVITE_CODE_ALPHABET), INVITE_CODE_ALPHABET);
  });
});

describe("generateInviteCode", () => {
  it("makes 8-character codes from the alphabet with crypto.randomInt", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const code = generateInviteCode(randomInt);
      assert.equal(code.length, INVITE_CODE_LENGTH);
      for (const ch of code) assert.ok(INVITE_CODE_ALPHABET.includes(ch), ch);
      assert.equal(normalizeInviteCode(code), code);
      seen.add(code);
    }
    assert.ok(seen.size > 495, "codes should practically never repeat");
  });

  it("uses every position of the alphabet", () => {
    let i = 0;
    const code = generateInviteCode(() => i++ % INVITE_CODE_ALPHABET.length);
    assert.equal(code, INVITE_CODE_ALPHABET.slice(0, INVITE_CODE_LENGTH));
  });
});

describe("normalizeInviteCode", () => {
  it("accepts lower case and whitespace, rejects the rest", () => {
    assert.equal(normalizeInviteCode(" abcd2345 "), "ABCD2345");
    for (const bad of [null, undefined, "", "ABCD234", "ABCD23456", "ABCD0345", "ABCD-345", "ABCDL345"]) {
      assert.equal(normalizeInviteCode(bad), null, String(bad));
    }
  });
});

describe("inviteStatus", () => {
  const now = new Date("2026-11-02T10:00:00Z");
  const base = { revoked_at: null, expires_at: null, max_uses: null, uses: 0 };

  it("is active by default and with uses left", () => {
    assert.equal(inviteStatus(base, now), "active");
    assert.equal(inviteStatus({ ...base, max_uses: 5, uses: 4 }, now), "active");
    assert.equal(inviteStatus({ ...base, expires_at: "2026-11-03T00:00:00Z" }, now), "active");
    assert.equal(isInviteUsable(base, now), true);
  });

  it("detects revoked, expired and used up", () => {
    assert.equal(inviteStatus({ ...base, revoked_at: "2026-11-01T00:00:00Z" }, now), "revoked");
    assert.equal(inviteStatus({ ...base, expires_at: "2026-11-02T10:00:00Z" }, now), "expired");
    assert.equal(inviteStatus({ ...base, max_uses: 3, uses: 3 }, now), "used_up");
    assert.equal(isInviteUsable({ ...base, max_uses: 1, uses: 1 }, now), false);
  });

  it("reports revoked before expired before used up", () => {
    const all = { revoked_at: "2026-11-01T00:00:00Z", expires_at: "2026-11-01T00:00:00Z", max_uses: 1, uses: 1 };
    assert.equal(inviteStatus(all, now), "revoked");
    assert.equal(inviteStatus({ ...all, revoked_at: null }, now), "expired");
  });
});

describe("form helpers", () => {
  const now = new Date("2026-11-02T10:00:00Z");

  it("computes expiry from the sheet choice", () => {
    assert.equal(inviteExpiresAt("never", now), null);
    assert.equal(inviteExpiresAt("7d", now), "2026-11-09T10:00:00.000Z");
    assert.equal(inviteExpiresAt("30d", now), "2026-12-02T10:00:00.000Z");
    assert.equal(parseExpiryChoice("bogus"), "never");
  });

  it("parses max uses", () => {
    assert.equal(parseMaxUses(""), null);
    assert.equal(parseMaxUses("0"), null);
    assert.equal(parseMaxUses("-2"), null);
    assert.equal(parseMaxUses("2.5"), null);
    assert.equal(parseMaxUses("40"), 40);
  });

  it("builds the link on the current host", () => {
    assert.equal(inviteUrl("https://ict.zedai.academy/", "ABCD2345"), "https://ict.zedai.academy/i/ABCD2345");
  });
});

describe("pickNextClass", () => {
  // Monday 2 Nov 2026, 10:00 UTC = 12:00 in Lusaka.
  const now = new Date("2026-11-02T10:00:00Z");
  const s = (over: Partial<ScheduleFacts>): ScheduleFacts => ({
    id: "x",
    title: "Class",
    is_recurring: false,
    day_of_week: null,
    start_time_only: null,
    starts_at: null,
    group_id: null,
    ...over,
  });

  it("returns null with nothing upcoming", () => {
    assert.equal(pickNextClass([], now), null);
    assert.equal(pickNextClass([s({ starts_at: "2026-11-01T10:00:00Z" })], now), null);
  });

  it("converts weekly classes from Lusaka time and rolls past ones to next week", () => {
    // Monday 18:00 Lusaka = 16:00 UTC today.
    const later = pickNextClass([s({ is_recurring: true, day_of_week: 1, start_time_only: "18:00:00" })], now);
    assert.equal(later?.startsAt, "2026-11-02T16:00:00.000Z");
    // Monday 09:00 Lusaka already passed: next Monday.
    const past = pickNextClass([s({ is_recurring: true, day_of_week: 1, start_time_only: "09:00" })], now);
    assert.equal(past?.startsAt, "2026-11-09T07:00:00.000Z");
    // Sunday (7).
    const sunday = pickNextClass([s({ is_recurring: true, day_of_week: 7, start_time_only: "10:00" })], now);
    assert.equal(sunday?.startsAt, "2026-11-08T08:00:00.000Z");
  });

  it("picks the soonest of one-off and weekly classes", () => {
    const next = pickNextClass(
      [
        s({ id: "weekly", is_recurring: true, day_of_week: 3, start_time_only: "18:00" }),
        s({ id: "oneoff", starts_at: "2026-11-03T08:00:00Z" }),
      ],
      now
    );
    assert.equal(next?.id, "oneoff");
  });

  it("ignores other groups' classes when a group is given", () => {
    const schedules = [
      s({ id: "other", starts_at: "2026-11-03T08:00:00Z", group_id: "g2" }),
      s({ id: "mine", starts_at: "2026-11-04T08:00:00Z", group_id: "g1" }),
      s({ id: "all", starts_at: "2026-11-05T08:00:00Z" }),
    ];
    assert.equal(pickNextClass(schedules, now, { groupId: "g1" })?.id, "mine");
    assert.equal(pickNextClass(schedules, now, { groupId: null })?.id, "all");
    assert.equal(pickNextClass(schedules, now)?.id, "other");
  });
});
