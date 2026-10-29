/**
 * Pure JaaS (8x8 Jitsi as a Service) JWT helpers. No I/O and no secrets, so
 * they are unit-tested directly (claims.test.ts). Signing lives in token.ts.
 */

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

/**
 * Accepts the PEM either as-is, with escaped "\n" sequences (common in
 * dashboard env editors such as Vercel's), or base64-encoded.
 */
export function normalizePrivateKey(raw: string): string {
  const trimmed = raw.trim().replace(/^"|"$/g, "");
  if (trimmed.includes("-----BEGIN")) return trimmed.replace(/\\r/g, "").replace(/\\n/g, "\n");
  return Buffer.from(trimmed, "base64").toString("utf8").trim();
}

/** Build the JaaS claims for one exact room. */
export function buildJaasClaims(appId: string, opts: JaasTokenOptions, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!opts.room || opts.room.includes("*")) throw new Error("A specific room is required.");
  const ttl = opts.ttlSeconds ?? 15 * 60;
  // Recording, streaming and transcription are host-only; dial-out is off for everyone.
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

/** Make an arbitrary string safe to use as (part of) a Jitsi room name. */
export function sanitizeRoomSegment(value: string, maxLength = 64): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLength);
}

/** Unguessable room name scoped to a tenant. */
export function newRoomName(prefix: string): string {
  return `${sanitizeRoomSegment(prefix, 40)}-${crypto.randomUUID()}`;
}
