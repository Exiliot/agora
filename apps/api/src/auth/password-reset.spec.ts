import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashResetToken } from './password-reset.js';

describe('password reset token hashing', () => {
  it('should hash a token deterministically with SHA-256', () => {
    const token = 'example-token-value';
    const expected = createHash('sha256').update(token).digest();
    expect(hashResetToken(token).equals(expected)).toBe(true);
  });

  it('should produce 32-byte digests', () => {
    expect(hashResetToken('anything').length).toBe(32);
  });

  it('should produce different digests for different tokens', () => {
    const a = hashResetToken('token-a');
    const b = hashResetToken('token-b');
    expect(a.equals(b)).toBe(false);
  });
});
