import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import jwt from "jsonwebtoken";
import { buildJaasClaims, newRoomName, normalizePrivateKey, signJaasToken } from "@/lib/jitsi/token";

const user = { id: "user_1", name: "Test User" };

describe("buildJaasClaims", () => {
  it("binds the token to one exact room", () => {
    const claims = buildJaasClaims("app", { room: "room-a", user, moderator: false });
    expect(claims.room).toBe("room-a");
  });

  it("refuses wildcard or empty rooms", () => {
    expect(() => buildJaasClaims("app", { room: "*", user, moderator: true })).toThrow();
    expect(() => buildJaasClaims("app", { room: "", user, moderator: true })).toThrow();
  });

  it("gives learners no moderator rights or host features", () => {
    const claims = buildJaasClaims("app", { room: "r", user, moderator: false });
    expect(claims.context.user.moderator).toBe("false");
    expect(claims.context.features.recording).toBe("false");
    expect(claims.context.features.livestreaming).toBe("false");
    expect(claims.context.features["outbound-call"]).toBe("false");
  });

  it("gives hosts recording but never outbound calling", () => {
    const claims = buildJaasClaims("app", { room: "r", user, moderator: true });
    expect(claims.context.user.moderator).toBe("true");
    expect(claims.context.features.recording).toBe("true");
    expect(claims.context.features["outbound-call"]).toBe("false");
  });

  it("is short-lived by default", () => {
    const claims = buildJaasClaims("app", { room: "r", user, moderator: false }, 1_000);
    expect(claims.exp - 1_000).toBe(15 * 60);
    expect(claims.nbf).toBeLessThan(1_000);
  });
});

describe("normalizePrivateKey", () => {
  const pem = "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----";
  it("accepts a raw PEM", () => expect(normalizePrivateKey(pem)).toBe(pem));
  it("accepts escaped newlines", () => expect(normalizePrivateKey(pem.replace(/\n/g, "\\n"))).toBe(pem));
  it("accepts base64", () => expect(normalizePrivateKey(Buffer.from(pem).toString("base64"))).toBe(pem));
});

describe("newRoomName", () => {
  it("is tenant-prefixed and unguessable", () => {
    const a = newRoomName("classroom-My Academy!");
    const b = newRoomName("classroom-My Academy!");
    expect(a).toMatch(/^classroom-my-academy--[0-9a-f-]{36}$/);
    expect(a).not.toBe(b);
  });
});

describe("signJaasToken", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const saved = { ...process.env };

  beforeAll(() => {
    process.env.JAAS_APP_ID = "vpaas-magic-cookie-test";
    process.env.JAAS_KEY_ID = "vpaas-magic-cookie-test/kid1";
    process.env.JAAS_PRIVATE_KEY = Buffer.from(
      privateKey.export({ type: "pkcs8", format: "pem" }).toString()
    ).toString("base64");
  });
  afterAll(() => {
    process.env = saved;
  });

  it("signs RS256 with the configured key id", () => {
    const token = signJaasToken({ room: "r1", user, moderator: false });
    const decoded = jwt.verify(token, publicKey.export({ type: "spki", format: "pem" }).toString(), {
      algorithms: ["RS256"],
      complete: true,
    });
    expect(decoded.header.kid).toBe("vpaas-magic-cookie-test/kid1");
    expect((decoded.payload as { sub: string; room: string }).sub).toBe("vpaas-magic-cookie-test");
    expect((decoded.payload as { room: string }).room).toBe("r1");
  });

  it("fails clearly when not configured", () => {
    delete process.env.JAAS_PRIVATE_KEY;
    expect(() => signJaasToken({ room: "r1", user, moderator: false })).toThrow(/not configured/);
  });
});
