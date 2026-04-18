/**
 * Argon2id wrapper. Parameters follow the OWASP 2026 baseline: m=65536 KiB,
 * t=3 iterations, p=4 lanes. See FR-AUTH-12 and requirements/01-auth.md.
 */

import argon2 from 'argon2';

const options = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

export const hashPassword = async (plain: string): Promise<string> => argon2.hash(plain, options);

export const verifyPassword = async (plain: string, hash: string): Promise<boolean> => {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
};
