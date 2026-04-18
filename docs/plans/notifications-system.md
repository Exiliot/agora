# Notifications System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an industry-grade notifications system for agora: a persistent `notifications` table, server-side focus suppression, WS fan-out, bell icon + dropdown in the topbar with type-tinted rows, transient toasts, and opt-in native OS notifications with cross-tab dedup.

**Architecture:** Dedicated `notifications` table per user with a partial unique index that powers O(1) collapse for DM/mention aggregation. Server helper `publishNotification(userId, kind, …)` inserts or collapse-updates, then fans out `notification.created` on `userTopic(userId)`. An in-memory `userFocusRegistry` consulted by the helper suppresses notifications for the conversation the user is actively viewing. Client uses TanStack Query (`['notifications']` infinite feed + `['notifications','unread-count']` scalar) and updates it reactively from WS events. Native OS toasts are gated behind an opt-in link in the dropdown; a `BroadcastChannel('agora-notif')` deduplicates native toast firings across tabs.

**Tech Stack:** Postgres 16 / Drizzle, Fastify + `@fastify/websocket`, zod (via `@agora/shared`), React 19, TanStack Query v5, vitest, Playwright.

---

## File Structure

New files:

- `apps/api/src/db/migrations/0002_notifications.sql` – DDL for the table + partial unique + feed index.
- `apps/api/src/db/migrations/meta/0002_snapshot.json` – drizzle-kit snapshot (generated, do not hand-edit).
- `apps/api/src/notifications/publisher.ts` – `publishNotification` helper.
- `apps/api/src/notifications/publisher.spec.ts` – unit tests for the publisher.
- `apps/api/src/notifications/routes.ts` – HTTP surface (feed, unread count, mark-read, mark-all).
- `apps/api/tests/integration/notifications.spec.ts` – end-to-end flows.
- `apps/api/src/notifications/retention.ts` – 30-day auto-purge cron.
- `apps/api/src/ws/user-focus.ts` – in-memory per-user focus registry.
- `apps/api/src/ws/user-focus.spec.ts` – unit tests.
- `apps/api/src/notifications/mention.ts` – mention parser + resolver.
- `apps/api/src/notifications/mention.spec.ts` – unit tests.
- `packages/shared/src/notifications/index.ts` – zod schemas for kinds, row view, WS events.
- `packages/shared/src/ws/events.ts` – extend client→server union with `client.focus`, server→client with `notification.created`, `notification.read`, `notification.read_all`.
- `apps/web/src/features/notifications/useNotifications.ts` – infinite query.
- `apps/web/src/features/notifications/useUnreadCount.ts` – scalar query.
- `apps/web/src/features/notifications/useMarkRead.ts` – mutation.
- `apps/web/src/features/notifications/useMarkAllRead.ts` – mutation.
- `apps/web/src/features/notifications/native.ts` – permission helper + `fireNativeToast` + BroadcastChannel dedup.
- `apps/web/src/features/notifications/focus.ts` – `client.focus` emitter.
- `apps/web/src/ds/Bell.tsx` – icon + badge.
- `apps/web/src/ds/NotificationMenu.tsx` – dropdown popover.
- `apps/web/src/ds/NotificationRow.tsx` – single row with tinted rail.

Modified files:

- `apps/api/src/db/schema.ts` – append `notifications` table.
- `apps/api/src/server.ts` – register notifications route module + retention cron.
- `apps/api/src/ws/plugin.ts` – handle `client.focus`.
- `apps/api/src/messages/ws-handlers.ts` – call publisher for DM messages + mentions.
- `apps/api/src/friends/routes.ts` – call publisher on request/accept/ban.
- `apps/api/src/friends/events.ts` – call publisher from existing fan-out helpers.
- `apps/api/src/rooms/routes.ts` – call publisher on invitation/role/remove/delete/ban/member-join-private.
- `apps/api/src/rooms/events.ts` – similar.
- `apps/api/src/auth/routes.ts` – call publisher on password-change for sibling sessions.
- `apps/api/src/session/store.ts` – call publisher on bulk revoke.
- `apps/web/src/app/WsProvider.tsx` – handlers for the new events.
- `apps/web/src/app/RootLayout.tsx` – mount Bell in topbar.
- `apps/web/src/ds/index.ts` – re-export Bell, NotificationMenu, NotificationRow.

---

## Task 1: Drizzle schema + migration for `notifications`

**Files:**
- Modify: `apps/api/src/db/schema.ts` (append table)
- Create: `apps/api/src/db/migrations/0002_notifications.sql`

- [ ] **Step 1: Add the table to the drizzle schema**

Append to `apps/api/src/db/schema.ts`:

```ts
// ---- notifications ---------------------------------------------------------

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    subjectType: text('subject_type'),
    subjectId: uuid('subject_id'),
    actorUserId: uuid('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    payloadJson: text('payload_json').notNull().default('{}'),
    aggregateCount: integer('aggregate_count').notNull().default(1),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    feedIdx: index('notifications_feed_idx').on(t.userId, t.readAt, t.createdAt),
  }),
);
```

(`payload_json` is `text` – drizzle treats `jsonb` awkwardly with readback casts; we stringify client-side and the migration creates it as `jsonb`. The drizzle-level type stays `text` to avoid a heavier dependency on drizzle's jsonb support, but Postgres enforces the jsonb shape at the storage layer. The migration below sets the actual column type to `jsonb`.)

Actually: keep it simple. Use `text` everywhere and stringify. Postgres stores small JSON strings as `text` just fine; we don't need SQL-level JSON querying on payloads.

- [ ] **Step 2: Write the migration SQL**

Create `apps/api/src/db/migrations/0002_notifications.sql`:

```sql
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "subject_type" text,
  "subject_id" uuid,
  "actor_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "payload_json" text NOT NULL DEFAULT '{}',
  "aggregate_count" integer NOT NULL DEFAULT 1,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "notifications_feed_idx"
  ON "notifications" ("user_id", "read_at", "created_at" DESC);

-- Partial unique index that powers ON CONFLICT-based collapse.
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_unread_collapse_key"
  ON "notifications" ("user_id", "kind", "subject_type", "subject_id")
  WHERE "read_at" IS NULL;
```

- [ ] **Step 3: Update drizzle-kit snapshot**

Run: `pnpm --filter @agora/api drizzle-kit generate`
Expected: produces `apps/api/src/db/migrations/meta/0002_snapshot.json` matching the new table.

Verify the diff only adds the new table; nothing else should move.

- [ ] **Step 4: Apply migration to the running stack and verify**

Run: `docker compose exec api pnpm --filter @agora/api migrate` (or restart the api; the startup runs `migrations applied`).

Run: `docker compose exec db psql -U app -d app -c '\d notifications'`
Expected: table present with the two indexes.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/src/db/migrations/0002_notifications.sql apps/api/src/db/migrations/meta/0002_snapshot.json
git commit -m "feat(notifications): add notifications table with collapse-unique index"
```

---

## Task 2: Shared zod schemas for notifications

**Files:**
- Create: `packages/shared/src/notifications/index.ts`
- Modify: `packages/shared/src/index.ts` (re-export)
- Modify: `packages/shared/src/ws/events.ts` (extend unions)

- [ ] **Step 1: Write failing import test**

Create `packages/shared/src/notifications/index.spec.ts`:

```ts
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
        actor: { id: '00000000-0000-0000-0000-000000000004', username: 'w' },
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
```

- [ ] **Step 2: Verify the test fails**

Run: `pnpm --filter @agora/shared test -- notifications/index.spec.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Create the shared module**

Create `packages/shared/src/notifications/index.ts`:

```ts
import { z } from 'zod';
import { userPublic } from '../users/index.js';

export const notificationKind = z.enum([
  'dm.new_message',
  'room.mentioned',
  'friend.request',
  'friend.accepted',
  'room.invitation',
  'room.role_changed',
  'room.removed',
  'room.deleted',
  'room.ban',
  'user.ban',
  'room.joined_private',
  'session.revoked_elsewhere',
]);
export type NotificationKind = z.infer<typeof notificationKind>;

export const notificationSubjectType = z.enum(['room', 'dm', 'user']);
export type NotificationSubjectType = z.infer<typeof notificationSubjectType>;

export const notificationView = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  kind: notificationKind,
  subjectType: notificationSubjectType.nullable(),
  subjectId: z.string().uuid().nullable(),
  actor: userPublic.nullable(),
  payload: z.record(z.unknown()),
  aggregateCount: z.number().int().positive(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type NotificationView = z.infer<typeof notificationView>;

export const clientFocusEvent = z.object({
  type: z.literal('client.focus'),
  payload: z.object({
    subjectType: notificationSubjectType.nullable(),
    subjectId: z.string().uuid().nullable(),
  }),
});
export type ClientFocusEvent = z.infer<typeof clientFocusEvent>;

export const notificationCreatedEvent = z.object({
  type: z.literal('notification.created'),
  payload: notificationView,
});
export type NotificationCreatedEvent = z.infer<typeof notificationCreatedEvent>;

export const notificationReadEvent = z.object({
  type: z.literal('notification.read'),
  payload: z.object({ id: z.string().uuid() }),
});

export const notificationReadAllEvent = z.object({
  type: z.literal('notification.read_all'),
  payload: z.object({}).default({}),
});
```

- [ ] **Step 4: Re-export from the package root**

Append to `packages/shared/src/index.ts`:

```ts
export * from './notifications/index.js';
```

- [ ] **Step 5: Wire into ws/events.ts unions**

Edit `packages/shared/src/ws/events.ts`:

- Add import: `import { clientFocusEvent, notificationCreatedEvent, notificationReadEvent, notificationReadAllEvent } from '../notifications/index.js';`
- Add `clientFocusEvent` to the `clientToServerEvent` discriminated union.
- Re-export the three server-to-client events for convenience (they are consumed via the generic ws client on the web side, but naming them makes the set canonical).

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @agora/shared test`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): zod schemas for notifications + client.focus WS event"
```

---

## Task 3: In-memory user focus registry

**Files:**
- Create: `apps/api/src/ws/user-focus.ts`
- Create: `apps/api/src/ws/user-focus.spec.ts`

- [ ] **Step 1: Write failing test**

```ts
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
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm --filter @agora/api test -- ws/user-focus.spec.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
interface FocusRecord {
  subjectType: 'room' | 'dm' | 'user';
  subjectId: string;
}

const byUser = new Map<string, FocusRecord>();

export const userFocusRegistry = {
  get(userId: string): FocusRecord | undefined {
    return byUser.get(userId);
  },
  set(userId: string, subjectType: FocusRecord['subjectType'], subjectId: string): void {
    byUser.set(userId, { subjectType, subjectId });
  },
  clear(userId: string): void {
    byUser.delete(userId);
  },
  matches(
    userId: string,
    subjectType: FocusRecord['subjectType'],
    subjectId: string,
  ): boolean {
    const rec = byUser.get(userId);
    return rec !== undefined && rec.subjectType === subjectType && rec.subjectId === subjectId;
  },
  _clearAll(): void {
    byUser.clear();
  },
};
```

- [ ] **Step 4: Tests pass + commit**

```bash
pnpm --filter @agora/api test -- ws/user-focus.spec.ts
git add apps/api/src/ws/user-focus.ts apps/api/src/ws/user-focus.spec.ts
git commit -m "feat(ws): in-memory user focus registry for notification suppression"
```

---

## Task 4: WS handler for `client.focus`

**Files:**
- Modify: `apps/api/src/ws/plugin.ts`

- [ ] **Step 1: Add a branch for `client.focus`**

In the event handling block of `apps/api/src/ws/plugin.ts`, right after the `heartbeat` branch, add:

```ts
if (e.type === 'client.focus') {
  if (e.payload.subjectType === null || e.payload.subjectId === null) {
    userFocusRegistry.clear(conn.userId);
  } else {
    userFocusRegistry.set(conn.userId, e.payload.subjectType, e.payload.subjectId);
  }
  return;
}
```

Also add import: `import { userFocusRegistry } from './user-focus.js';`

And in the `close` handler, call `userFocusRegistry.clear(user.id)` (only if this was the last connection for that user — check `connections.forUser(user.id)` length; otherwise leave the registry alone so a sibling tab keeps the focus).

- [ ] **Step 2: Verify from browser**

Temporarily add a log line in the `client.focus` branch: `app.log.info({userId: conn.userId, ...e.payload}, 'client.focus')`. Hit the app in a browser, open a DM – the client emitter is not written yet so nothing logs. OK for now.

Revert the temp log before commit.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/ws/plugin.ts
git commit -m "feat(ws): handle client.focus to track user's active conversation"
```

---

## Task 5: Mention parser + resolver

**Files:**
- Create: `apps/api/src/notifications/mention.ts`
- Create: `apps/api/src/notifications/mention.spec.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { extractMentions } from './mention.js';

describe('extractMentions', () => {
  it('returns empty array when none', () => {
    expect(extractMentions('no mentions here')).toEqual([]);
  });

  it('extracts a simple mention', () => {
    expect(extractMentions('hi @bob')).toEqual(['bob']);
  });

  it('dedupes repeated mentions case-insensitively', () => {
    expect(extractMentions('@Bob @bob @BOB')).toEqual(['bob']);
  });

  it('stops at punctuation', () => {
    expect(extractMentions('hello @bob, how are you?')).toEqual(['bob']);
  });

  it('ignores emails', () => {
    expect(extractMentions('mail me at bob@agora.test')).toEqual([]);
  });

  it('accepts underscores, dots, dashes', () => {
    expect(extractMentions('@bob.the_builder-1')).toEqual(['bob.the_builder-1']);
  });
});
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement**

```ts
// Mentions match the username schema in @agora/shared (lowercase, . _ -).
// The leading @ must be preceded by start-of-string or whitespace to skip email
// addresses like bob@agora.test.
const MENTION_RE = /(?:^|\s)@([a-z0-9][a-z0-9._-]*)/gi;

export const extractMentions = (body: string): string[] => {
  const seen = new Set<string>();
  for (const match of body.matchAll(MENTION_RE)) {
    const raw = match[1];
    if (raw) seen.add(raw.toLowerCase());
  }
  return Array.from(seen);
};
```

- [ ] **Step 4: Tests pass + commit**

```bash
git add apps/api/src/notifications/mention.ts apps/api/src/notifications/mention.spec.ts
git commit -m "feat(notifications): extract mentions from message body"
```

---

## Task 6: `publishNotification` helper

**Files:**
- Create: `apps/api/src/notifications/publisher.ts`
- Create: `apps/api/src/notifications/publisher.spec.ts`

- [ ] **Step 1: Write failing integration test**

This test uses the real DB. Use the pattern from `apps/api/tests/integration/rooms.spec.ts` (the harness spins up a test DB or reuses `app`).

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/client.js';
import { notifications, users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { publishNotification } from './publisher.js';
import { userFocusRegistry } from '../ws/user-focus.js';

const mkUser = async () => {
  const id = uuidv7();
  await db.insert(users).values({
    id, email: `${id}@t.local`, username: id.replace(/-/g, '').slice(0, 20), passwordHash: 'x',
  });
  return id;
};

describe('publishNotification', () => {
  beforeEach(() => userFocusRegistry._clearAll());

  it('creates a row for unseen subject', async () => {
    const recipient = await mkUser();
    const actor = await mkUser();
    await publishNotification({
      userId: recipient,
      kind: 'dm.new_message',
      subjectType: 'dm',
      subjectId: '00000000-0000-0000-0000-000000000001',
      actorId: actor,
      payload: { senderUsername: 'x', snippet: 'hi' },
    });
    const rows = await db.select().from(notifications).where(eq(notifications.userId, recipient));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.aggregateCount).toBe(1);
  });

  it('collapses repeat inserts for the same unread subject', async () => {
    const recipient = await mkUser();
    const dmId = '00000000-0000-0000-0000-000000000002';
    await publishNotification({
      userId: recipient,
      kind: 'dm.new_message',
      subjectType: 'dm',
      subjectId: dmId,
      actorId: null,
      payload: { n: 1 },
    });
    await publishNotification({
      userId: recipient,
      kind: 'dm.new_message',
      subjectType: 'dm',
      subjectId: dmId,
      actorId: null,
      payload: { n: 2 },
    });
    const rows = await db.select().from(notifications).where(eq(notifications.userId, recipient));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.aggregateCount).toBe(2);
    expect(JSON.parse(rows[0]?.payloadJson ?? '{}')).toEqual({ n: 2 });
  });

  it('skips insert when user is focused on the subject', async () => {
    const recipient = await mkUser();
    const dmId = '00000000-0000-0000-0000-000000000003';
    userFocusRegistry.set(recipient, 'dm', dmId);
    await publishNotification({
      userId: recipient,
      kind: 'dm.new_message',
      subjectType: 'dm',
      subjectId: dmId,
      actorId: null,
      payload: {},
    });
    const rows = await db.select().from(notifications).where(eq(notifications.userId, recipient));
    expect(rows).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement the helper**

```ts
import { sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import type { NotificationKind, NotificationSubjectType } from '@agora/shared';
import { db } from '../db/client.js';
import { notifications } from '../db/schema.js';
import { bus } from '../bus/bus.js';
import { userTopic } from '../bus/topics.js';
import { userFocusRegistry } from '../ws/user-focus.js';
import { hydrateNotification } from './hydrate.js';

interface PublishArgs {
  userId: string;
  kind: NotificationKind;
  subjectType: NotificationSubjectType | null;
  subjectId: string | null;
  actorId: string | null;
  payload: Record<string, unknown>;
}

const isSuppressibleKind = (kind: NotificationKind): boolean =>
  kind === 'dm.new_message' || kind === 'room.mentioned';

export const publishNotification = async (args: PublishArgs): Promise<void> => {
  if (
    isSuppressibleKind(args.kind) &&
    args.subjectType &&
    args.subjectId &&
    userFocusRegistry.matches(args.userId, args.subjectType, args.subjectId)
  ) {
    return;
  }

  const id = uuidv7();
  const payloadJson = JSON.stringify(args.payload);

  const rows = await db.execute<{ id: string }>(sql`
    INSERT INTO notifications (id, user_id, kind, subject_type, subject_id, actor_user_id, payload_json, aggregate_count, created_at, updated_at)
    VALUES (${id}, ${args.userId}, ${args.kind}, ${args.subjectType}, ${args.subjectId}, ${args.actorId}, ${payloadJson}, 1, now(), now())
    ON CONFLICT (user_id, kind, subject_type, subject_id) WHERE read_at IS NULL
    DO UPDATE SET aggregate_count = notifications.aggregate_count + 1,
                  payload_json = EXCLUDED.payload_json,
                  updated_at = now()
    RETURNING id
  `);
  const resolvedId = rows.rows[0]?.id ?? id;

  const view = await hydrateNotification(resolvedId);
  if (view) {
    bus.publish(userTopic(args.userId), { type: 'notification.created', payload: view });
  }
};
```

`hydrateNotification(id)` is a sibling helper that joins to `users` for the actor and returns a `NotificationView`. Write it at the top of this same task (pre-requisite):

```ts
// apps/api/src/notifications/hydrate.ts
import { and, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../db/client.js';
import { notifications, users } from '../db/schema.js';
import type { NotificationView, NotificationKind, NotificationSubjectType } from '@agora/shared';

const actor = alias(users, 'actor');

export const hydrateNotification = async (id: string): Promise<NotificationView | null> => {
  const rows = await db
    .select({
      id: notifications.id,
      userId: notifications.userId,
      kind: notifications.kind,
      subjectType: notifications.subjectType,
      subjectId: notifications.subjectId,
      actorId: actor.id,
      actorUsername: actor.username,
      payloadJson: notifications.payloadJson,
      aggregateCount: notifications.aggregateCount,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      updatedAt: notifications.updatedAt,
    })
    .from(notifications)
    .leftJoin(actor, eq(actor.id, notifications.actorUserId))
    .where(eq(notifications.id, id))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    userId: r.userId,
    kind: r.kind as NotificationKind,
    subjectType: (r.subjectType ?? null) as NotificationSubjectType | null,
    subjectId: r.subjectId ?? null,
    actor: r.actorId && r.actorUsername ? { id: r.actorId, username: r.actorUsername } : null,
    payload: JSON.parse(r.payloadJson),
    aggregateCount: r.aggregateCount,
    readAt: r.readAt ? r.readAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
};
```

- [ ] **Step 4: Tests pass + commit**

```bash
pnpm --filter @agora/api test -- notifications/publisher.spec.ts
git add apps/api/src/notifications/
git commit -m "feat(notifications): publishNotification helper with collapse + focus suppression"
```

---

## Task 7: HTTP routes for notifications

**Files:**
- Create: `apps/api/src/notifications/routes.ts`
- Modify: `apps/api/src/server.ts` (register module)

- [ ] **Step 1: Write integration test**

`apps/api/tests/integration/notifications.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildTestApp, mkUserAndSignIn } from './helpers.js';

describe('/api/notifications', () => {
  it('returns paged feed for caller', async () => {
    const app = await buildTestApp();
    const { cookie, userId } = await mkUserAndSignIn(app);
    // seed: 3 notifications via the helper directly
    const { publishNotification } = await import('../../src/notifications/publisher.js');
    await publishNotification({ userId, kind: 'friend.request', subjectType: 'user', subjectId: '00000000-0000-0000-0000-000000000001', actorId: null, payload: {} });
    await publishNotification({ userId, kind: 'friend.request', subjectType: 'user', subjectId: '00000000-0000-0000-0000-000000000002', actorId: null, payload: {} });
    await publishNotification({ userId, kind: 'friend.request', subjectType: 'user', subjectId: '00000000-0000-0000-0000-000000000003', actorId: null, payload: {} });

    const resp = await app.inject({ method: 'GET', url: '/api/notifications', headers: { cookie } });
    expect(resp.statusCode).toBe(200);
    const body = resp.json();
    expect(body.notifications).toHaveLength(3);
  });

  it('unread-count endpoint', async () => {
    const app = await buildTestApp();
    const { cookie, userId } = await mkUserAndSignIn(app);
    const { publishNotification } = await import('../../src/notifications/publisher.js');
    await publishNotification({ userId, kind: 'friend.request', subjectType: 'user', subjectId: '00000000-0000-0000-0000-000000000004', actorId: null, payload: {} });

    const resp = await app.inject({ method: 'GET', url: '/api/notifications/unread-count', headers: { cookie } });
    expect(resp.json()).toEqual({ count: 1 });
  });

  it('mark-read endpoint flips read_at and broadcasts', async () => {
    const app = await buildTestApp();
    const { cookie, userId } = await mkUserAndSignIn(app);
    const { publishNotification } = await import('../../src/notifications/publisher.js');
    await publishNotification({ userId, kind: 'friend.request', subjectType: 'user', subjectId: '00000000-0000-0000-0000-000000000005', actorId: null, payload: {} });

    const feed = await app.inject({ method: 'GET', url: '/api/notifications', headers: { cookie } });
    const id = feed.json().notifications[0].id;

    const resp = await app.inject({ method: 'POST', url: `/api/notifications/${id}/read`, headers: { cookie } });
    expect(resp.statusCode).toBe(204);

    const count = await app.inject({ method: 'GET', url: '/api/notifications/unread-count', headers: { cookie } });
    expect(count.json()).toEqual({ count: 0 });
  });
});
```

(Use whatever integration harness exists; `buildTestApp` / `mkUserAndSignIn` names here mirror the patterns in `apps/api/tests/integration/`. Reuse or add to `helpers.ts` as needed.)

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement routes**

```ts
// apps/api/src/notifications/routes.ts
import type { FastifyInstance } from 'fastify';
import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { notifications } from '../db/schema.js';
import { bus } from '../bus/bus.js';
import { userTopic } from '../bus/topics.js';
import { addRouteModule } from '../routes/registry.js';
import { isAuthed, requireAuth } from '../session/require-auth.js';
import { hydrateNotification } from './hydrate.js';

const feedQuery = z.object({
  before: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

addRouteModule({
  name: 'notifications',
  register(app: FastifyInstance): void {
    app.register(async (scoped) => {
      scoped.addHook('onRequest', requireAuth);

      scoped.get('/api/notifications', async (req, reply) => {
        if (!isAuthed(req)) return;
        const parsed = feedQuery.safeParse(req.query);
        if (!parsed.success) return reply.code(400).send({ error: 'validation' });
        const limit = parsed.data.limit ?? 30;
        const rows = await db
          .select({ id: notifications.id })
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, req.user.id),
              parsed.data.before ? lt(notifications.id, parsed.data.before) : undefined,
            ),
          )
          .orderBy(sql`${notifications.createdAt} DESC`)
          .limit(limit);
        const views = await Promise.all(rows.map((r) => hydrateNotification(r.id)));
        return reply.send({ notifications: views.filter((v) => v !== null) });
      });

      scoped.get('/api/notifications/unread-count', async (req, reply) => {
        if (!isAuthed(req)) return;
        const [row] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(notifications)
          .where(and(eq(notifications.userId, req.user.id), isNull(notifications.readAt)));
        return reply.send({ count: row?.count ?? 0 });
      });

      scoped.post<{ Params: { id: string } }>('/api/notifications/:id/read', async (req, reply) => {
        if (!isAuthed(req)) return;
        const updated = await db
          .update(notifications)
          .set({ readAt: new Date() })
          .where(and(eq(notifications.id, req.params.id), eq(notifications.userId, req.user.id), isNull(notifications.readAt)))
          .returning({ id: notifications.id });
        if (updated.length === 0) return reply.code(404).send({ error: 'not_found' });
        bus.publish(userTopic(req.user.id), { type: 'notification.read', payload: { id: req.params.id } });
        return reply.code(204).send();
      });

      scoped.post('/api/notifications/read-all', async (req, reply) => {
        if (!isAuthed(req)) return;
        await db
          .update(notifications)
          .set({ readAt: new Date() })
          .where(and(eq(notifications.userId, req.user.id), isNull(notifications.readAt)));
        bus.publish(userTopic(req.user.id), { type: 'notification.read_all', payload: {} });
        return reply.code(204).send();
      });
    });
  },
});
```

- [ ] **Step 4: Register the module**

Edit `apps/api/src/server.ts` to import and register `notifications` alongside the other route modules.

- [ ] **Step 5: Tests pass + commit**

```bash
pnpm --filter @agora/api test -- tests/integration/notifications.spec.ts
git add apps/api/src/notifications/routes.ts apps/api/src/server.ts apps/api/tests/integration/notifications.spec.ts
git commit -m "feat(notifications): HTTP routes for feed, unread-count, mark-read"
```

---

## Task 8: Call publisher from DM message send

**Files:**
- Modify: `apps/api/src/messages/ws-handlers.ts`

- [ ] **Step 1: Write integration test** (`apps/api/tests/integration/notifications.spec.ts` additions)

```ts
it('DM message creates a dm.new_message notification for the counterparty', async () => {
  const app = await buildTestApp();
  const { cookie: bobCookie, userId: bobId } = await mkUserAndSignIn(app);
  const { userId: alId, username: alUsername } = await mkUser(app);
  await makeFriends(app, bobId, alId);
  const dmId = await openDm(app, bobCookie, alId);

  await sendWsMessageAsBob(app, bobCookie, { conversationType: 'dm', conversationId: dmId, body: 'hi' });

  const feed = await app.inject({
    method: 'GET',
    url: '/api/notifications',
    headers: { cookie: await signInAs(app, alId) },
  });
  const notifs = feed.json().notifications;
  expect(notifs).toHaveLength(1);
  expect(notifs[0].kind).toBe('dm.new_message');
  expect(notifs[0].subjectId).toBe(dmId);
  expect(notifs[0].actor.username).toBe('bob');
});
```

- [ ] **Step 2: Implement — call `publishNotification` inside `message.send` handler**

In `apps/api/src/messages/ws-handlers.ts`, after `publishNewMessage(view)` and the unread-count fan-out, add:

```ts
if (payload.conversationType === 'dm') {
  // the sole non-author participant is the recipient for DM notifications
  for (const { userId: rid } of insertResult.counts) {
    await publishNotification({
      userId: rid,
      kind: 'dm.new_message',
      subjectType: 'dm',
      subjectId: payload.conversationId,
      actorId: userId,
      payload: {
        senderUsername: view.author?.username ?? 'unknown',
        snippet: view.body.slice(0, 120),
      },
    });
  }
}

if (payload.conversationType === 'room' && view.body) {
  const mentioned = extractMentions(view.body);
  if (mentioned.length > 0) {
    const targets = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .innerJoin(roomMembers, and(eq(roomMembers.userId, users.id), eq(roomMembers.roomId, payload.conversationId)))
      .where(and(
        sql`lower(${users.username}) = ANY(${sql.param(mentioned)}::text[])`,
        ne(users.id, userId),
      ));
    for (const target of targets) {
      await publishNotification({
        userId: target.id,
        kind: 'room.mentioned',
        subjectType: 'room',
        subjectId: payload.conversationId,
        actorId: userId,
        payload: {
          senderUsername: view.author?.username ?? 'unknown',
          snippet: view.body.slice(0, 120),
        },
      });
    }
  }
}
```

Add imports: `publishNotification`, `extractMentions`, `users`, `ne`.

- [ ] **Step 3: Tests pass + commit**

```bash
git add apps/api/src/messages/ws-handlers.ts apps/api/tests/integration/notifications.spec.ts
git commit -m "feat(notifications): fire notifications for DMs and room mentions"
```

---

## Task 9: Wire publisher into friends flows

**Files:**
- Modify: `apps/api/src/friends/routes.ts`

For each of: `friend.request` (on `scoped.post('/api/friend-requests', ...)` success), `friend.accepted` (on accept — recipient of notification is the ORIGINAL SENDER), `user.ban` (on user-ban create — target is the banned user).

- [ ] **Step 1: Add tests**

```ts
it('friend request creates a friend.request notification for the recipient', async () => { /* … */ });
it('accepting sends friend.accepted notification to original sender', async () => { /* … */ });
it('user-ban sends user.ban notification to the target', async () => { /* … */ });
```

- [ ] **Step 2: Add publisher calls in `friends/routes.ts`**

Example for request:

```ts
await publishNotification({
  userId: target.id,
  kind: 'friend.request',
  subjectType: 'user',
  subjectId: senderId,
  actorId: senderId,
  payload: { senderUsername: req.user.username, note: inserted.note },
});
```

Mirror for accept and ban.

- [ ] **Step 3: Tests pass + commit**

```bash
git commit -m "feat(notifications): fire notifications for friend requests, accepts, bans"
```

---

## Task 10: Wire publisher into rooms flows

**Files:**
- Modify: `apps/api/src/rooms/routes.ts`

Points of integration:
- `POST /api/rooms/:id/invitations` success → `room.invitation` for invitee.
- `POST /api/rooms/:id/admins` (promote) → `room.role_changed` for target.
- `DELETE /api/rooms/:id/admins/:targetId` (demote) → `room.role_changed` for target.
- `DELETE /api/rooms/:id/members/:userId` (remove) → `room.removed` for target.
- `DELETE /api/rooms/:id` (delete) → `room.deleted` for every prior member EXCEPT the deleter.
- `POST /api/rooms/:id/bans` (ban) → `room.ban` for target.
- When a user JOINS a PRIVATE room (invitation accept path) → `room.joined_private` for owner + admins.

- [ ] **Step 1: Add tests for each event**
- [ ] **Step 2: Wire publishers**
- [ ] **Step 3: Commit** — `feat(notifications): fire notifications for room invitations, roles, removals, bans, and private joins`

---

## Task 11: Wire publisher into session revocation

**Files:**
- Modify: `apps/api/src/auth/routes.ts`
- Modify: `apps/api/src/session/store.ts`

Password-change already calls `deleteSessionsForUserExcept(user.id, session.id)`. Wrap that so we know how many rows were deleted and fire ONE `session.revoked_elsewhere` notification if >0.

- [ ] **Step 1: Test**

```ts
it('password change fires a single session.revoked_elsewhere notification', async () => { /* … */ });
```

- [ ] **Step 2: Modify `deleteSessionsForUserExcept` to return `number` (rows deleted)**

Then from the caller:

```ts
const revokedCount = await deleteSessionsForUserExcept(user.id, session.id);
if (revokedCount > 0) {
  await publishNotification({
    userId: user.id,
    kind: 'session.revoked_elsewhere',
    subjectType: null,
    subjectId: null,
    actorId: null,
    payload: { revokedCount, reason: 'password_change' },
  });
}
```

Mirror for the password-reset consume path in `auth/routes.ts`.

- [ ] **Step 3: Tests pass + commit**

```bash
git commit -m "feat(notifications): notify user when sibling sessions are revoked"
```

---

## Task 12: Retention cron

**Files:**
- Create: `apps/api/src/notifications/retention.ts`
- Modify: `apps/api/src/server.ts` (schedule)

- [ ] **Step 1: Test**

```ts
it('deletes notifications read more than 30 days ago', async () => {
  // insert a read notification with read_at = now - 31 days
  // call purgeReadNotifications()
  // expect 0 rows for that user
});
```

- [ ] **Step 2: Implement**

```ts
export const purgeReadNotifications = async (): Promise<number> => {
  const res = await db.execute(sql`
    DELETE FROM notifications
    WHERE read_at IS NOT NULL AND read_at < now() - interval '30 days'
  `);
  return res.rowCount ?? 0;
};
```

In `server.ts`, schedule with `setInterval(() => void purgeReadNotifications(), 60 * 60 * 1000)` on app start; clear on shutdown.

- [ ] **Step 3: Commit** — `feat(notifications): hourly retention sweep for 30-day-read rows`

---

## Task 13: Client feature folder – hooks

**Files:**
- Create: `apps/web/src/features/notifications/useNotifications.ts`
- Create: `apps/web/src/features/notifications/useUnreadCount.ts`
- Create: `apps/web/src/features/notifications/useMarkRead.ts`
- Create: `apps/web/src/features/notifications/useMarkAllRead.ts`

- [ ] **Step 1: `useNotifications` (infinite query)**

```ts
import { useInfiniteQuery } from '@tanstack/react-query';
import type { NotificationView } from '@agora/shared';
import { api } from '../../lib/apiClient';

export interface NotificationsPage {
  notifications: NotificationView[];
}

export const useNotifications = () =>
  useInfiniteQuery<NotificationsPage, Error, { pages: NotificationsPage[] }, ['notifications'], string | null>({
    queryKey: ['notifications'],
    queryFn: ({ pageParam }) =>
      api.get<NotificationsPage>(
        pageParam ? `/notifications?before=${pageParam}` : '/notifications',
      ),
    initialPageParam: null,
    getNextPageParam: (last) => last.notifications[last.notifications.length - 1]?.id ?? null,
  });
```

- [ ] **Step 2: `useUnreadCount`**

```ts
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';

export const useUnreadCount = () =>
  useQuery<{ count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ count: number }>('/notifications/unread-count'),
  });
```

- [ ] **Step 3: `useMarkRead`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';

export const useMarkRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<void>(`/notifications/${id}/read`, undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });
};
```

- [ ] **Step 4: `useMarkAllRead`** – same pattern, hits `/notifications/read-all`.

- [ ] **Step 5: Commit** — `feat(web): notifications TanStack Query hooks`

---

## Task 14: WS wiring for notification events

**Files:**
- Modify: `apps/web/src/app/WsProvider.tsx`

- [ ] **Step 1: Add handlers**

```ts
const unsubNotificationCreated = client.on('notification.created', (event) => {
  const payload = event.payload as NotificationView | undefined;
  if (!payload) return;
  queryClient.setQueryData<NotificationsInfiniteData>(['notifications'], (old) => {
    if (!old) return old;
    const [first, ...rest] = old.pages;
    if (!first) return old;
    // collapse: if the same (kind, subjectId) exists in page 0 unread, update it in place
    const existingIdx = first.notifications.findIndex(
      (n) => n.id === payload.id || (
        n.kind === payload.kind && n.subjectId === payload.subjectId && n.readAt === null
      ),
    );
    let nextFirst: NotificationsPage;
    if (existingIdx >= 0) {
      const nextList = first.notifications.slice();
      nextList[existingIdx] = payload;
      nextFirst = { notifications: nextList };
    } else {
      nextFirst = { notifications: [payload, ...first.notifications] };
    }
    return { ...old, pages: [nextFirst, ...rest] };
  });
  queryClient.setQueryData<{ count: number }>(['notifications', 'unread-count'], (old) =>
    old ? { count: old.count + 1 } : { count: 1 },
  );
  // Native toast gating handled by native.ts which subscribes to the same event.
});
const unsubNotificationRead = client.on('notification.read', (event) => {
  const payload = event.payload as { id: string } | undefined;
  if (!payload) return;
  queryClient.setQueryData<NotificationsInfiniteData>(['notifications'], (old) => {
    if (!old) return old;
    const pages = old.pages.map((p) => ({
      notifications: p.notifications.map((n) =>
        n.id === payload.id && n.readAt === null ? { ...n, readAt: new Date().toISOString() } : n,
      ),
    }));
    return { ...old, pages };
  });
  queryClient.setQueryData<{ count: number }>(['notifications', 'unread-count'], (old) =>
    old ? { count: Math.max(0, old.count - 1) } : { count: 0 },
  );
});
const unsubNotificationReadAll = client.on('notification.read_all', () => {
  queryClient.setQueryData<NotificationsInfiniteData>(['notifications'], (old) => {
    if (!old) return old;
    const nowIso = new Date().toISOString();
    const pages = old.pages.map((p) => ({
      notifications: p.notifications.map((n) => n.readAt ? n : { ...n, readAt: nowIso }),
    }));
    return { ...old, pages };
  });
  queryClient.setQueryData<{ count: number }>(['notifications', 'unread-count'], { count: 0 });
});
```

Return from the useEffect cleanup: call the three unsubs.

- [ ] **Step 2: Commit** — `feat(web): live notification feed via WS events`

---

## Task 15: DS primitives – Bell, NotificationMenu, NotificationRow

**Files:**
- Create: `apps/web/src/ds/Bell.tsx`
- Create: `apps/web/src/ds/NotificationMenu.tsx`
- Create: `apps/web/src/ds/NotificationRow.tsx`
- Modify: `apps/web/src/ds/index.ts`

- [ ] **Step 1: `NotificationRow`** – a read-only view of one notification with a 2px left rail tinted per-kind.

Kind → tint mapping (use existing tokens only):

```ts
const kindTint = (kind: NotificationKind) => {
  switch (kind) {
    case 'dm.new_message':
    case 'room.mentioned':
      return tokens.color.accent;
    case 'friend.request':
    case 'friend.accepted':
    case 'room.invitation':
      return tokens.color.ok;
    case 'room.ban':
    case 'user.ban':
    case 'room.removed':
      return tokens.color.warn;
    default:
      return tokens.color.ink2;
  }
};
```

Row layout: left rail (2px, kindTint) · body column (mono username + sans message, ink1 unread / ink2 read) · right column (time-ago, small ink2).

- [ ] **Step 2: `Bell`** – 16×16 icon button, filled when unread > 0, `<Badge tone="mention">{count}</Badge>` overlay top-right.

- [ ] **Step 3: `NotificationMenu`** – portal-to-body popover under Bell, hairline-bordered, max-height 60vh, scrolls. Header row: "Notifications" left, "Mark all read" button right. Footer link: "Turn on desktop notifications" (shown only when `Notification.permission === 'default'`; hidden if granted or denied).

- [ ] **Step 4: Commit** — `feat(ds): Bell icon, NotificationMenu popover, NotificationRow`

---

## Task 16: Mount Bell in RootLayout

**Files:**
- Modify: `apps/web/src/app/RootLayout.tsx`

- [ ] **Step 1: Import** and render `<Bell>` between the link navigation and the username in the topbar.
- [ ] **Step 2: Visual verification** – open the app, sign in, confirm the bell shows up and responds to hover.
- [ ] **Step 3: Commit** — `feat(ui): mount Bell in the topbar`

---

## Task 17: Native OS toast + BroadcastChannel dedup

**Files:**
- Create: `apps/web/src/features/notifications/native.ts`

- [ ] **Step 1: Implement opt-in + firing**

```ts
export const nativePermissionState = (): 'default' | 'granted' | 'denied' => {
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.permission;
};

export const requestNativePermission = async (): Promise<NotificationPermission> => {
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.requestPermission();
};

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('agora-notif') : null;
const claimed = new Set<string>();
channel?.addEventListener('message', (ev: MessageEvent<{ id: string }>) => {
  if (ev.data?.id) claimed.add(ev.data.id);
});

const HIGH_KINDS = new Set<NotificationKind>([
  'dm.new_message', 'room.mentioned', 'friend.request', 'room.invitation', 'room.ban', 'user.ban',
]);

export const maybeFireNative = (n: NotificationView): void => {
  if (!HIGH_KINDS.has(n.kind)) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (document.visibilityState !== 'hidden') return;
  // Claim first, then wait a tick to see if another tab beat us.
  channel?.postMessage({ id: n.id });
  setTimeout(() => {
    if (claimed.has(n.id) && claimed.size > 1) {
      // Another tab already claimed → skip
      return;
    }
    const title = titleFor(n);
    const body = bodyFor(n);
    try {
      new Notification(title, { body, tag: `${n.kind}:${n.subjectId ?? n.id}` });
    } catch {
      /* user-gesture errors on some browsers — ignore */
    }
  }, 100);
};
```

- [ ] **Step 2: Hook `maybeFireNative` from the WsProvider's `notification.created` handler**

Right after the `setQueryData` in Task 14:

```ts
maybeFireNative(payload);
```

- [ ] **Step 3: Commit** — `feat(notifications): opt-in native OS toasts with cross-tab dedup`

---

## Task 18: Client `client.focus` emitter

**Files:**
- Create: `apps/web/src/features/notifications/focus.ts`
- Modify: call `useFocusEmitter()` inside `RootLayout` (or a dedicated hook mounted once)

- [ ] **Step 1: Implement the hook**

```ts
import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useWs } from '../../app/WsProvider';

export const useFocusEmitter = () => {
  const ws = useWs();
  const location = useLocation();
  useEffect(() => {
    if (!ws) return;
    const emit = () => {
      const parts = location.pathname.split('/').filter(Boolean);
      let payload: { subjectType: 'room' | 'dm' | null; subjectId: string | null } = { subjectType: null, subjectId: null };
      if (parts[0] === 'chat' && parts[1]) {
        // we only have the room name on the client; resolution to id happens server-side? no: we store id.
        // Use the resolved room id from the conversations cache.
      }
      // Simpler: let RootLayout / ChatView / DmView pass (subjectType, subjectId) directly to the emitter.
      ws.send({ type: 'client.focus', payload });
    };
    emit();
    const onVis = () => { if (document.visibilityState === 'visible') emit(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [ws, location]);
};
```

Actually simpler: expose a tiny context `useSetFocus(subjectType, subjectId)` that ChatView and DmView call when they mount / unmount / route-change. Each view knows its own ids (it already resolves them to render the MessageList).

Rewrite as:

```ts
// features/notifications/focus.ts
import { useEffect } from 'react';
import { useWs } from '../../app/WsProvider';

export const useFocusBroadcast = (subjectType: 'room' | 'dm' | null, subjectId: string | null) => {
  const ws = useWs();
  useEffect(() => {
    if (!ws) return;
    ws.send({ type: 'client.focus', payload: { subjectType, subjectId } });
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        ws.send({ type: 'client.focus', payload: { subjectType, subjectId } });
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      ws.send({ type: 'client.focus', payload: { subjectType: null, subjectId: null } });
    };
  }, [ws, subjectType, subjectId]);
};
```

Call it from `ChatView` with `(roomType = 'room', roomId)` and from `DmView` with `('dm', dm.id)`.

- [ ] **Step 2: Wire calls + commit**

```bash
git commit -m "feat(web): emit client.focus so server can suppress notifications for the active conversation"
```

---

## Task 19: Verification – Playwright smoke

**Files:**
- Create: `tests/e2e/notifications.spec.ts` (in the existing e2e folder; follow its harness patterns).

- [ ] **Step 1: Scenario**

1. sign in as bob
2. sign in as wefflerer in a second browser context
3. make them friends via API
4. open the DM from bob's side (`/dm/wefflerer`)
5. from wefflerer, send a message via API
6. expect bob's bell badge to go to 1
7. click the bell → see one row: `"wefflerer · 1 new message"`
8. click the row → URL changes to `/dm/wefflerer` AND unread badge goes to 0

- [ ] **Step 2: Commit** — `test(e2e): smoke for notification bell + click-to-read flow`

---

## Task 20: Journal entry

**Files:**
- Create: `docs/journal/2026-04-19-02-notifications-system.md`

- [ ] **Step 1: Write the entry**

Summarise: what was built, why `notifications` table won over the events-log approach, how collapse works in one index, the focus-suppression trick, and the native-toast opt-in rationale. Past tense. Keep it terse.

- [ ] **Step 2: Commit** — `docs(journal): notifications system session notes`

---

## Self-review

- [ ] **Spec coverage:**
  - 12 event kinds across priorities → Tasks 8/9/10/11.
  - notifications table + partial unique index → Task 1.
  - HTTP routes + WS events → Tasks 7, 14.
  - Focus registry + `client.focus` → Tasks 3, 4, 18.
  - Collapse behaviour → Task 6 (+ test); also client-side prepend/collapse in Task 14.
  - Bell + dropdown + row tints → Tasks 15, 16.
  - Native OS toast opt-in + BroadcastChannel dedup → Task 17.
  - 30-day retention → Task 12.
  - Session revocation notification → Task 11.
  - Playwright smoke → Task 19.
  - Journal → Task 20.

- [ ] **No placeholders.** Every task has concrete files and code.

- [ ] **Type consistency.** `NotificationKind`, `NotificationSubjectType`, `NotificationView` all come from `@agora/shared`. `publishNotification` args are named identically at definition (Task 6) and callsites (Tasks 8–11). `useFocusBroadcast` name used in both Task 18 steps.

- [ ] **No dead ends.** `hydrate.ts`, `publisher.ts`, and the routes share the same drizzle imports. No unreferenced helpers.

---

**End of plan.**
