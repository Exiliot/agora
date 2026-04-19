import { describe, it, expect, beforeEach } from 'vitest';
import { lookupDedupe, rememberDedupe, _resetDedupe } from './send-dedupe.js';

describe('send-dedupe', () => {
  beforeEach(() => _resetDedupe());

  it('returns undefined when nothing has been remembered', () => {
    expect(lookupDedupe('u1', '00000000-0000-0000-0000-000000000001')).toBeUndefined();
  });

  it('returns the remembered messageId within the TTL', () => {
    rememberDedupe('u1', '00000000-0000-0000-0000-000000000001', 'msg-1');
    expect(lookupDedupe('u1', '00000000-0000-0000-0000-000000000001')).toBe('msg-1');
  });

  it('separates entries by authorId', () => {
    rememberDedupe('u1', '00000000-0000-0000-0000-000000000001', 'msg-1');
    expect(lookupDedupe('u2', '00000000-0000-0000-0000-000000000001')).toBeUndefined();
  });
});
