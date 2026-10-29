import "server-only";

// Server-only entry point for JaaS tokens. The implementation lives in
// claims.ts (pure) and sign.ts (env + signing) so it can be unit-tested with
// `node --test`; importing it through this module keeps it out of client bundles.
export { buildJaasClaims, newRoomName, normalizePrivateKey, sanitizeRoomSegment } from "./claims.ts";
export type { JaasTokenOptions, JaasUser } from "./claims.ts";
export { getJaasAppId, signJaasToken } from "./sign.ts";
