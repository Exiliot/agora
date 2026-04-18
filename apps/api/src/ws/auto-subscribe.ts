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
  // Skip the DB roundtrip if this connection already holds subscriptions —
  // auto-subscribe is idempotent, but the two queries are not free and the
  // client may re-send `hello` on WS reconnect churn.
  if (conn.subscriptions.size > 0) return;

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
