import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import jwt from "jsonwebtoken";
import { signJaasToken } from "./sign.ts";

const user = { id: "user_1", name: "Test User" };

describe("signJaasToken", () => {
  // A throwaway key generated for this test only.
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const saved = { ...process.env };

  before(() => {
    process.env.JAAS_APP_ID = "vpaas-magic-cookie-test";
    process.env.JAAS_KEY_ID = "vpaas-magic-cookie-test/kid1";
  });
  after(() => {
    process.env = saved;
  });

  it("signs RS256 with the configured key id (base64 key)", () => {
    process.env.JAAS_PRIVATE_KEY = Buffer.from(privatePem).toString("base64");
    const token = signJaasToken({ room: "r1", user, moderator: false });
    const decoded = jwt.verify(token, publicPem, { algorithms: ["RS256"], complete: true });
    assert.equal(decoded.header.kid, "vpaas-magic-cookie-test/kid1");
    const payload = decoded.payload as { sub: string; room: string };
    assert.equal(payload.sub, "vpaas-magic-cookie-test");
    assert.equal(payload.room, "r1");
  });

  it("accepts a PEM with escaped newlines, as pasted into Vercel", () => {
    process.env.JAAS_PRIVATE_KEY = privatePem.trim().replace(/\n/g, "\\n");
    const token = signJaasToken({ room: "r2", user, moderator: true });
    const payload = jwt.verify(token, publicPem, { algorithms: ["RS256"] }) as { room: string };
    assert.equal(payload.room, "r2");
  });

  it("fails clearly when not configured", () => {
    delete process.env.JAAS_PRIVATE_KEY;
    assert.throws(() => signJaasToken({ room: "r1", user, moderator: false }), /not configured/);
  });
});
