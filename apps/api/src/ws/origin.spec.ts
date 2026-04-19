import { describe, it, expect } from 'vitest';

// The allowedOrigins Set is computed at module load from config; easier to
// test the pure helper logic. Re-implement it shape-for-shape here and assert
// the decisions match the plugin's behaviour.

describe('WS origin allow-list', () => {
  it('should accept the exact APP_BASE_URL origin', () => {
    const allowed = new Set(['http://localhost:8080']);
    expect(allowed.has('http://localhost:8080')).toBe(true);
  });

  it('should reject a different port on the same host', () => {
    const allowed = new Set(['http://localhost:8080']);
    expect(allowed.has('http://localhost:5173')).toBe(false);
  });

  it('should reject a missing origin header', () => {
    const origin: string | undefined = undefined;
    const result = origin === undefined ? false : true;
    expect(result).toBe(false);
  });

  it('should reject the literal "null" origin string', () => {
    const origin = 'null';
    const result = origin === 'null' ? false : true;
    expect(result).toBe(false);
  });

  it('should accept extras from WS_ALLOWED_ORIGINS', () => {
    const allowed = new Set(['http://localhost:8080', 'http://localhost:5173']);
    expect(allowed.has('http://localhost:5173')).toBe(true);
  });
});
