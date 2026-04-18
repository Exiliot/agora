import { describe, it, expect, beforeEach } from 'vitest';
import { userFocusRegistry } from './user-focus.js';

describe('userFocusRegistry', () => {
  beforeEach(() => userFocusRegistry._clearAll());

  it('returns undefined when no focus set', () => {
    expect(userFocusRegistry.get('u1')).toBeUndefined();
  });

  it('stores and retrieves a focus record', () => {
    userFocusRegistry.set('u1', 'dm', 'd1');
    expect(userFocusRegistry.get('u1')).toEqual({ subjectType: 'dm', subjectId: 'd1' });
  });

  it('clear removes the record', () => {
    userFocusRegistry.set('u1', 'room', 'r1');
    userFocusRegistry.clear('u1');
    expect(userFocusRegistry.get('u1')).toBeUndefined();
  });

  it('matches returns true when subject matches', () => {
    userFocusRegistry.set('u1', 'dm', 'd1');
    expect(userFocusRegistry.matches('u1', 'dm', 'd1')).toBe(true);
    expect(userFocusRegistry.matches('u1', 'dm', 'd2')).toBe(false);
    expect(userFocusRegistry.matches('u2', 'dm', 'd1')).toBe(false);
  });

  it('setting a new focus replaces the previous one', () => {
    userFocusRegistry.set('u1', 'dm', 'd1');
    userFocusRegistry.set('u1', 'room', 'r1');
    expect(userFocusRegistry.get('u1')).toEqual({ subjectType: 'room', subjectId: 'r1' });
  });
});
