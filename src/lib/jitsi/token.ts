import "server-only";

import jwt from "jsonwebtoken";

export type JaasUser = {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
};

export type JaasTokenOptions = {
  /** Exact room name (without the app id prefix). Never "*". */
  room: string;
  user: JaasUser;
  moderator: boolean;
  /** Token lifetime. Short by default; a rejoin simply requests a new one. */
  ttlSeconds?: number;
};

export function getJaasAppId(): string {
  const appId = process.env.JAAS_APP_ID;
  if (!appId) throw new Error("Video classroom is not configured (JAAS_APP_ID missing).");
  return appId;
}

/**
 * Accepts the PEM either as-is, with escaped "\n" sequences (common in
 * dashboard env editors), or base64-encoded.
 */
export function normalizePrivateKey(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes("-----BEGIN")) return trimmed.replace(/\\n/g, "\n");
  return Buffer.from(trimmed, "base64").toString("utf8").trim();
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

/** Build the JaaS claims. Exported separately so it can be unit-tested without a key. */
export function buildJaasClaims(appId: string, opts: JaasTokenOptions, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!opts.room || opts.room === "*") throw new Error("A specific room is required.");
  const ttl = opts.ttlSeconds ?? 15 * 60;
  const hostOnly = opts.moderator ? "true" : "false";
  return {
    aud: "jitsi",
    iss: "chat",
    sub: appId,
    room: opts.room,
    nbf: nowSeconds - 10,
    exp: nowSeconds + ttl,
    context: {
      user: {
        id: opts.user.id,
        name: opts.user.name,
        email: opts.user.email ?? "",
        avatar: opts.user.avatar ?? "",
        moderator: opts.moderator ? "true" : "false",
      },
      features: {
        recording: hostOnly,
        livestreaming: hostOnly,
        transcription: hostOnly,
        "outbound-call": "false",
        "sip-outbound-call": "false",
      },
    },
  };
}

export function signJaasToken(opts: JaasTokenOptions): string {
  const { appId, keyId, privateKey } = getSigningConfig();
  return jwt.sign(buildJaasClaims(appId, opts), privateKey, {
    algorithm: "RS256",
    header: { kid: keyId, typ: "JWT", alg: "RS256" },
  });
}

/** Unguessable room name scoped to a tenant. */
export function newRoomName(prefix: string): string {
  const safe = prefix.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40);
  return `${safe}-${crypto.randomUUID()}`;
}
