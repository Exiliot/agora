import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('argon2id password wrapper', () => {
  it('should produce an argon2id hash string', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('should produce different hashes for the same plaintext (unique salts)', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toBe(b);
  });

  it('should verify a correct password', async () => {
    const hash = await hashPassword('letmein-please');
    expect(await verifyPassword('letmein-please', hash)).toBe(true);
  });

  it('should reject a wrong password', async () => {
    const hash = await hashPassword('letmein-please');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('should return false on malformed hash instead of throwing', async () => {
    expect(await verifyPassword('anything', 'not-an-argon2-hash')).toBe(false);
  });

  it('should encode OWASP 2026 parameters m=65536 t=3 p=4 in the hash', async () => {
    const hash = await hashPassword('params-check');
    expect(hash).toMatch(/\$m=65536,t=3,p=4\$/);
  });
});
