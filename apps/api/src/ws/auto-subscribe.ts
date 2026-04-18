/**
 * On WS `hello`, subscribe the connection to every room the user is a member of
 * and every DM they participate in. Without this, `message.new` fan-outs for
 * those conversations don't reach the client.
 */

import { eq, or } from 'drizzle-orm';
import { db } from '../db/client.js';
import { roomMembers, dmConversations } from '../db/schema.js';
import { connectionLifecycle } from './lifecycle.js';
import { subscribeConnection } from './connection-manager.js';
import { dmTopic, roomTopic } from '../bus/topics.js';

connectionLifecycle.on('hello', (conn) => {
  // Skip the DB roundtrip only if this connection already has room/DM
  // subscriptions. The ws plugin pre-subscribes every conn to its userTopic
  // at socket open, so a naive `subscriptions.size > 0` check would always
  // match and we'd never subscribe to any rooms – no `message.new` fan-out
  // would ever reach the user on their first hello.
  const hasConversationSub = Array.from(conn.subscriptions.keys()).some(
    (topic) => topic.startsWith('room:') || topic.startsWith('dm:'),
  );
  if (hasConversationSub) return;

  void (async () => {
    const [rooms, dms] = await Promise.all([
      db.select({ roomId: roomMembers.roomId }).from(roomMembers).where(eq(roomMembers.userId, conn.userId)),
      db
        .select({ id: dmConversations.id })
        .from(dmConversations)
        .where(or(eq(dmConversations.userAId, conn.userId), eq(dmConversations.userBId, conn.userId))),
    ]);
    for (const row of rooms) subscribeConnection(conn, roomTopic(row.roomId));
    for (const row of dms) subscribeConnection(conn, dmTopic(row.id));
  })().catch((err) => {
    // eslint-disable-next-line no-console
    console.warn('[ws auto-subscribe] failed', err);
  });
});
