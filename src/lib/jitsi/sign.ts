import jwt from "jsonwebtoken";
import { buildJaasClaims, normalizePrivateKey, type JaasTokenOptions } from "./claims.ts";

/**
 * JaaS configuration comes only from the environment. The private key must
 * never be committed to the repository or read from disk.
 *   JAAS_APP_ID      vpaas-magic-cookie-…
 *   JAAS_KEY_ID      vpaas-magic-cookie-…/abc123
 *   JAAS_PRIVATE_KEY PEM (literal "\n" escapes are fine) or base64 of the PEM
 *
 * App code imports this through "@/lib/jitsi/token", which is server-only.
 */
export function getJaasAppId(): string {
  const appId = process.env.JAAS_APP_ID;
  if (!appId) throw new Error("Video classroom is not configured (JAAS_APP_ID missing).");
  return appId;
}

function getSigningConfig() {
  const appId = getJaasAppId();
  const keyId = process.env.JAAS_KEY_ID;
  const rawKey = process.env.JAAS_PRIVATE_KEY;
  if (!keyId || !rawKey) {
    throw new Error("Video classroom is not configured (JAAS_KEY_ID / JAAS_PRIVATE_KEY missing).");
  }
  return { appId, keyId, privateKey: normalizePrivateKey(rawKey) };
}

export function signJaasToken(opts: JaasTokenOptions): string {
  const { appId, keyId, privateKey } = getSigningConfig();
  return jwt.sign(buildJaasClaims(appId, opts), privateKey, {
    algorithm: "RS256",
    header: { kid: keyId, typ: "JWT", alg: "RS256" },
  });
}
