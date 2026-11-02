import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildJaasClaims, newRoomName, normalizePrivateKey, sanitizeRoomSegment } from "./claims.ts";

const user = { id: "user_1", name: "Test User" };

describe("buildJaasClaims", () => {
  it("binds the token to one exact room", () => {
    const claims = buildJaasClaims("app", { room: "room-a", user, moderator: false });
    assert.equal(claims.room, "room-a");
    assert.equal(claims.sub, "app");
  });

  it("refuses wildcard or empty rooms", () => {
    assert.throws(() => buildJaasClaims("app", { room: "*", user, moderator: true }));
    assert.throws(() => buildJaasClaims("app", { room: "room-*", user, moderator: true }));
    assert.throws(() => buildJaasClaims("app", { room: "", user, moderator: true }));
  });

  it("gives learners no moderator rights or host features", () => {
    const claims = buildJaasClaims("app", { room: "r", user, moderator: false });
    assert.equal(claims.context.user.moderator, "false");
    assert.equal(claims.context.features.recording, "false");
    assert.equal(claims.context.features.livestreaming, "false");
    assert.equal(claims.context.features.transcription, "false");
    assert.equal(claims.context.features["outbound-call"], "false");
  });

  it("gives hosts recording but never outbound calling", () => {
    const claims = buildJaasClaims("app", { room: "r", user, moderator: true });
    assert.equal(claims.context.user.moderator, "true");
    assert.equal(claims.context.features.recording, "true");
    assert.equal(claims.context.features["outbound-call"], "false");
    assert.equal(claims.context.features["sip-outbound-call"], "false");
  });

  it("is short-lived by default", () => {
    const claims = buildJaasClaims("app", { room: "r", user, moderator: false }, 1_000);
    assert.equal(claims.exp - 1_000, 15 * 60);
    assert.ok(claims.nbf < 1_000);
  });
});

describe("normalizePrivateKey", () => {
  const pem = "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----";
  it("accepts a raw PEM", () => assert.equal(normalizePrivateKey(pem), pem));
  it("accepts escaped newlines", () => assert.equal(normalizePrivateKey(pem.replace(/\n/g, "\\n")), pem));
  it("accepts a quoted value with escaped newlines", () =>
    assert.equal(normalizePrivateKey(`"${pem.replace(/\n/g, "\\n")}"`), pem));
  it("accepts base64", () => assert.equal(normalizePrivateKey(Buffer.from(pem).toString("base64")), pem));
});

describe("room names", () => {
  it("are tenant-prefixed and unguessable", () => {
    const a = newRoomName("classroom-My Academy!");
    const b = newRoomName("classroom-My Academy!");
    assert.match(a, /^classroom-my-academy-[0-9a-f-]{36}$/);
    assert.notEqual(a, b);
  });

  it("sanitizes free-text segments", () => {
    assert.equal(sanitizeRoomSegment("  Zoom 123 456 / *  "), "zoom-123-456");
    assert.equal(sanitizeRoomSegment("***"), "");
  });
});
