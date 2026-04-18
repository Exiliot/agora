import { describe, it, expect } from 'vitest';
import { notificationKind, notificationView, clientFocusEvent, notificationCreatedEvent } from './index.js';

describe('notification schemas', () => {
  it('accepts every defined kind', () => {
    for (const kind of ['dm.new_message', 'room.mentioned', 'friend.request', 'room.invitation'] as const) {
      expect(notificationKind.safeParse(kind).success).toBe(true);
    }
  });

  it('rejects unknown kind', () => {
    expect(notificationKind.safeParse('totally.made.up').success).toBe(false);
  });

  it('validates a notification view', () => {
    const sample = {
      id: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000002',
      kind: 'dm.new_message',
      subjectType: 'dm',
      subjectId: '00000000-0000-0000-0000-000000000003',
      actor: { id: '00000000-0000-0000-0000-000000000004', username: 'wefflerer' },
      payload: { snippet: 'hi', senderUsername: 'wefflerer' },
      aggregateCount: 3,
      readAt: null,
      createdAt: '2026-04-19T00:00:00.000Z',
      updatedAt: '2026-04-19T00:00:01.000Z',
    };
    expect(notificationView.safeParse(sample).success).toBe(true);
  });

  it('parses client.focus with null subject', () => {
    const r = clientFocusEvent.safeParse({
      type: 'client.focus',
      payload: { subjectType: null, subjectId: null },
    });
    expect(r.success).toBe(true);
  });

  it('parses notification.created carrying a row', () => {
    const r = notificationCreatedEvent.safeParse({
      type: 'notification.created',
      payload: {
        id: '00000000-0000-0000-0000-000000000001',
        userId: '00000000-0000-0000-0000-000000000002',
        kind: 'friend.request',
        subjectType: 'user',
        subjectId: '00000000-0000-0000-0000-000000000004',
        actor: { id: '00000000-0000-0000-0000-000000000004', username: 'wfx' },
        payload: {},
        aggregateCount: 1,
        readAt: null,
        createdAt: '2026-04-19T00:00:00.000Z',
        updatedAt: '2026-04-19T00:00:00.000Z',
      },
    });
    expect(r.success).toBe(true);
  });
});
