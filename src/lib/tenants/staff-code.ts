import { randomInt, timingSafeEqual } from "node:crypto";

/**
 * A stored staff code is usable only if it is at least 6 characters and not a
 * placeholder like "0000"/"000000". Weak or missing codes disable staff join
 * until an admin regenerates the code.
 */
export function isUsableStaffCode(stored: string | null | undefined): boolean {
  const s = (stored ?? "").trim();
  return s.length >= 6 && !/^0+$/.test(s);
}

/** Constant-time check of a submitted staff code against the academy's stored code. */
export function staffCodeMatches(
  stored: string | null | undefined,
  submitted: string | null | undefined
): boolean {
  if (!isUsableStaffCode(stored)) return false;
  const a = Buffer.from((stored ?? "").trim());
  const b = Buffer.from((submitted ?? "").trim());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** A new random 8-digit staff code (cryptographically random; 100M possibilities). */
export function generateStaffCode(): string {
  return String(randomInt(10_000_000, 100_000_000));
}
