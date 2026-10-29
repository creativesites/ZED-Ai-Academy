import { randomBytes } from "node:crypto";

/**
 * Order references are typed into mobile money notes, so the alphabet leaves out the
 * look-alikes 0/O and 1/I. It must hold exactly 32 symbols so that a random byte masked
 * with 31 picks one without bias.
 */
export const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const REFERENCE_PREFIX = "ZAA-";
export const REFERENCE_LENGTH = 8;

export type RandomSource = (size: number) => Uint8Array;

export function generateOrderReference(random: RandomSource = randomBytes): string {
  const bytes = random(REFERENCE_LENGTH);
  let code = "";
  for (let i = 0; i < REFERENCE_LENGTH; i++) {
    code += REFERENCE_ALPHABET[bytes[i] & 31];
  }
  return `${REFERENCE_PREFIX}${code}`;
}

const REFERENCE_PATTERN = new RegExp(`^${REFERENCE_PREFIX}[${REFERENCE_ALPHABET}]{${REFERENCE_LENGTH}}$`);

export function isValidOrderReference(value: string): boolean {
  return REFERENCE_PATTERN.test(value);
}
