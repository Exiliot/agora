# Performance audit – agora

Read-only audit against `docs/spec.md` scale targets (300 concurrent users, rooms
up to 1000 members, 10k–100k history, 3s delivery, 2s presence).

## Executive summary

Overall posture is decent for a hackathon MVP but has one genuinely critical
bug (unindexed session token lookup) and two high-severity bottlenecks that
will bite the moment a room has real membership: per-recipient unread upserts
run as N sequential round-trips inside the send transaction, and every
`message.new` broadcast triggers the bus to synchronously JSON-serialise and
ship the full payload to every subscriber on the event loop. The good news is
the client already uses `@tanstack/react-virtual` for the message list, UUIDv7
gives k-sortable cursor pagination, and most query shapes have the right
supporting indexes. Presence propagation is sound; sidebar queries are
reasonable; there is no dangerous REST polling.

## Findings

| # | Severity | Location | Issue |
|---|---|---|---|
| 1 | critical | `apps/api/src/db/schema.ts:57` | `sessions.token_hash` has no index – every authenticated request seq-scans the sessions table |
| 2 | high | `apps/api/src/messages/ws-handlers.ts:135` | N sequential `incrementUnread` upserts per recipient inside the send transaction |
| 3 | high | `apps/api/src/bus/bus.ts:29` | `publish` synchronously iterates subscribers, each doing JSON.stringify + ws.send – one 1000-member message blocks the loop |
| 4 | high | `apps/api/src/session/plugin.ts:60` | Fire-and-forget `touchSession` UPDATE on every request – one write per API call |
| 5 | high | `apps/api/src/presence/sweeper.ts:22` | Sweeper runs `listPresenceSubscribers` (two DB round-trips) for every user whose state changed each tick, uncached |
| 6 | high | `apps/web/src/app/WsProvider.tsx:61` | `message.new` invalidates ALL `['messages']` queries – every open conversation refetches on any new message anywhere |
| 7 | medium | `apps/api/src/messages/routes.ts:216` | `GET /api/rooms` ranks public rooms with a correlated subquery-in-ORDER BY (`COUNT(*)` over `room_members` per row) |
| 8 | medium | `apps/api/src/messages/routes.ts:242` | `/api/conversations` preview query uses `DISTINCT ON` over all messages matching the full conversation id list – scales with total history, not with N conversations |
| 9 | medium | `apps/api/src/db/schema.ts:261` | `messages` index keyed on `created_at` but cursor pagination filters on `id`; works via backward index scan but a `(type, id, id)` index is a cleaner seek |
| 10 | medium | `apps/api/src/db/client.ts:8` | Pool `max: 10` is tight for 300 concurrent users – under burst, requests queue on pool checkout |
| 11 | medium | `apps/web/src/pages/chat/ChatView.tsx:149` | Right-hand panel renders every member of a 1000-member room unmemoised, each with its own `usePresenceOf` selector |
| 12 | medium | `apps/api/src/ws/auto-subscribe.ts:14` | `hello` auto-subscribes to every room and DM (two queries, synchronous subscribe loop) – no batching, fires twice per tab reconnect |
| 13 | medium | `apps/api/src/ws/connection-manager.ts:31` | Per-connection outbound queue counter is not back-pressure — it only drops `presence.update`; fast producers can still balloon socket buffers |
| 14 | low | `apps/api/src/messages/routes.ts:196` | Conversations payload looks up DM usernames with a separate `IN()` query after the DM scan – could be a single JOIN |
| 15 | low | `apps/api/src/rooms/routes.ts:248` | `/api/rooms/mine` also uses a correlated `COUNT(*)` subquery for memberCount per row |
| 16 | low | `apps/web/src/app/WsProvider.tsx:67` | `message.updated` and `message.deleted` invalidate every `['messages']` query, same blanket re-fetch pattern as #6 |
| 17 | low | `apps/api/src/presence/sweeper.ts:48` | Sweep iterates users sequentially with `await broadcast(...)` – one slow DB call blocks the next user's broadcast |
| 18 | low | `apps/api/src/rooms/routes.ts:285` | `join` / `accept invitation` run three separate queries (`loadRoom`, `isBannedFromRoom`, `getMembership`) that could be one JOIN |
| 19 | info | `apps/api/src/attachments/sweeper.ts:33` | Orphan sweeper deletes one row at a time in a loop – fine today, will want a batched delete once volumes grow |
| 20 | info | `apps/web/src/pages/chat/MessageList.tsx:181` | Virtualiser `estimateSize: 40` with dynamic measurement is correct; just confirming the known gap is closed |

### 1 – `sessions.token_hash` unindexed (critical)
**Impact.** Every HTTP request passes through `sessionPlugin` which calls
`findSessionByToken`, translating to `WHERE token_hash = $1` on a bytea column
with no index. At 300 concurrent users hammering REST + WS upgrade handshakes,
this is a guaranteed sequential scan on every request. `password_resets` has
exactly this index (`password_resets_token_hash_key`); `sessions` was
overlooked.
**Fix.** Add `CREATE UNIQUE INDEX sessions_token_hash_key ON sessions(token_hash)`
in a new migration. Mirror the unique constraint in `schema.ts`.

### 2 – N sequential unread upserts per room message (high)
**Impact.** `ws-handlers.ts:135` does `Promise.all(recipients.map(incrementUnread))`
where each `incrementUnread` is a separate `INSERT ... ON CONFLICT` round-trip.
For a 1000-member room, one message fires 1000 sequential upserts (Promise.all
is concurrent at the JS level but the `tx` is a single PG session → they
serialise). Each carries ~1ms network RTT. The entire send transaction holds
locks on `messages`, `conversation_unreads` while doing 1000+ms of work, so
throughput for that room collapses to <1 msg/s.
**Fix.** Single bulk upsert:
`INSERT INTO conversation_unreads (user_id, conversation_type, conversation_id, count)
 SELECT user_id, 'room', $roomId, 1 FROM room_members WHERE room_id = $roomId AND user_id <> $author
 ON CONFLICT (...) DO UPDATE SET count = conversation_unreads.count + 1
 RETURNING user_id, count`.

### 3 – Synchronous fan-out on `bus.publish` (high)
**Impact.** `createInMemoryBus().publish` iterates every subscriber
synchronously; each handler calls `conn.send → JSON.stringify → socket.send`.
For a message in a 1000-member room, the publishing tick stringifies the same
MessageView 1000 times and schedules 1000 writes before returning control to
the loop. At room-size = 1000 and body ~500B, that's ~500KB of string churn
and ~1000 ws write buffers in one synchronous burst.
**Fix.** (a) Stringify once per event and pass the pre-serialised buffer to
subscribers. (b) Optionally yield every N handlers with `queueMicrotask` /
`setImmediate` to avoid head-of-line blocking on other work (dispatcher,
heartbeats). Both changes are localised to `bus.publish` and `WsConnection.send`.

### 4 – `touchSession` on every request (high)
**Impact.** Every authenticated HTTP hit fires an async `UPDATE sessions SET
last_seen_at = ..., expires_at = ...`. At 300 users × ~1 req/s typical chat
load, that's 300 WAL-emitting UPDATEs per second, pure overhead. Compounded
with #1, this is the session table's double-tax.
**Fix.** Throttle: only touch once per N seconds per session (in-memory
`Map<sessionId, lastTouch>`). Or move the slide logic to a periodic batch
update keyed by a per-connection timestamp. A 60s throttle cuts ~99% of the
writes with zero functional impact.

### 5 – Presence sweeper recomputes subscribers uncached (high)
**Impact.** Every 2s (`PRESENCE_SWEEP_INTERVAL_MS`), for each user whose
state flipped, `listPresenceSubscribers` runs two DB queries (friendships +
room co-members). The comment in `subscription.ts:7` acknowledges this. At
300 active users with normal churn between online/afk, it's dozens of
round-trips per tick. Not catastrophic today but directly in the 2s presence
SLA path.
**Fix.** Short-lived memo (e.g. 5s TTL) keyed by `userId`. Invalidate on
friendship/room-membership mutations (those already publish bus events, so
the presence module can listen). Also: publish transitions to a per-user
topic `presence:<userId>` and let interested connections subscribe at
`hello` time – then no query is needed on the hot path.

### 6 – Blanket `['messages']` cache invalidation on every `message.new` (high)
**Impact.** `WsProvider.tsx:61` calls
`queryClient.invalidateQueries({ queryKey: ['messages'] })` on any incoming
message. This invalidates the infinite query for every conversation the user
has cached, not just the one the message belongs to. In a session with ten
open tabs / recently-viewed rooms, a single message in room A refetches
messages for rooms B..J too. That's a latent 10× amplification on every
message delivery.
**Fix.** `invalidateQueries({ queryKey: ['messages', payload.conversationType,
payload.conversationId] })`. For the infinite query, prefer `setQueryData` to
append the new message to the first page (the backfill code already does this
pattern) – zero network round-trip on the hot path. Same treatment for
`message.updated` (#16).

### 7 – Correlated `COUNT(*)` in `ORDER BY` for public rooms (medium)
**Impact.** `routes.ts:216` ranks public rooms by `ORDER BY (SELECT COUNT(*)
FROM room_members WHERE room_id = rooms.id) DESC`. Planner usually converts
this to a nested loop; at 100s of public rooms with 1000 members each, that's
still fast, but this is the kind of query that surprises on the demo when the
catalogue is cold.
**Fix.** Single `LEFT JOIN LATERAL (SELECT COUNT(*) FROM room_members WHERE
room_id = rooms.id) AS mc ON true` with `ORDER BY mc.count DESC`, or a
`GROUP BY rooms.id` with `COUNT(room_members.user_id)`. Alternatively
denormalise a `member_count` column on `rooms` maintained by triggers.

### 8 – `DISTINCT ON` preview across all conversations (medium)
**Impact.** `/api/conversations` runs one big `DISTINCT ON (type, conv_id)`
over the messages table filtered by all conversation ids the user has.
Postgres will typically pick a sort here; for a user in 50 rooms totalling
500k messages, that's a ~500k-row sort per page load. Sidebar renders on
every login and after every `unread.updated` invalidate.
**Fix.** Correlated `LATERAL` subquery: one index lookup per conversation
using the existing `messages_conversation_idx`. Shape:
`... FROM conversations c
 LEFT JOIN LATERAL (SELECT id, body, created_at, author_id, deleted_at
                   FROM messages
                   WHERE conversation_type = c.type AND conversation_id = c.id
                   ORDER BY created_at DESC, id DESC LIMIT 1) m ON true`.

### 9 – Messages index vs cursor column mismatch (medium)
**Impact.** The only index covering conversation history is
`(conversation_type, conversation_id, created_at)`. Pagination predicates
filter by `id` (`lt(messages.id, q.before)`). Works because UUIDv7 ids sort
the same as `created_at` and PG can combine index scan + filter, but every
page pays a small residual-filter cost.
**Fix.** Add `(conversation_type, conversation_id, id)` – cursor pagination
becomes a clean index-only range seek. Drop the created_at variant if nothing
else relies on it (preview query uses it – see #8; switching to LATERAL
removes that dependency too).

### 10 – Connection pool too small (medium)
**Impact.** `pool.max = 10` at 300 concurrent users means any burst of
synchronous REST (first-load screen: `/rooms/mine` + `/conversations` +
`/users/me` + `/rooms/:id` + message history) serialises through ten slots.
With WS hello also kicking two auto-subscribe queries, the demo's first
minute will spend time in `pool.connect()`.
**Fix.** Bump to 30–40 with an env override (`PG_POOL_MAX`). Set
`idleTimeoutMillis: 30_000` so idle connections don't linger. Validate with
pg's `pg_stat_activity` during a load test.

### 11 – Members panel re-renders on every presence tick (medium)
**Impact.** `ChatView.tsx:149` maps `detail.members` to a `MemberRow` each,
which calls `usePresenceOf(user.id)`. No memoisation. For a 1000-member room,
that's 1000 components subscribing to the same zustand store. Every
`presence.update` triggers zustand to run all 1000 selectors; React reconciles
a single child if its primitive value changed. Tolerable at MVP scale but not
free.
**Fix.** `React.memo(MemberRow)` and virtualise the member list (another
`useVirtualizer`, the dep is already installed). Bonus: collapse the panel
below an expandable disclosure if it has > 50 members.

### 12 – `hello` auto-subscribe fires twice & is synchronous (medium)
**Impact.** `auto-subscribe.ts` subscribes on every `hello` event, including
reconnect-driven hellos. There's nothing checking whether the connection is
already subscribed, so each reconnect re-runs the two DB queries. For 300
users with flappy wifi this is a meaningful re-query load.
**Fix.** `subscribeConnection` is already idempotent (it checks
`subscriptions.has(topic)`), so the queries themselves are the waste. Cache
the result for a few seconds keyed by userId, or only run when
`conn.subscriptions` is empty (i.e. a brand-new connection, not a
reconnect-hello on a stable conn).

### 13 – Outbound queue isn't back-pressure (medium)
**Impact.** `MAX_OUTBOUND_QUEUE = 512` only drops `presence.update`; message
events always enqueue. If a client stalls (slow network, tab backgrounded on
iOS), Node buffers unbounded. For 10k-history rooms with fast chat, a stuck
tab grows RSS linearly.
**Fix.** Check `socket.bufferedAmount` before `ws.send`; if above a
threshold, drop or close with 1013 (try again). Standard pattern.

### 14 – DM usernames fetched separately (low)
**Impact.** `routes.ts:196` lists DMs, then runs a second `inArray` query
against `users` for the other participants. Two round-trips where one JOIN
does the job.
**Fix.** Add the JOIN to the initial `dmConversations` select.

### 15 – `/api/rooms/mine` has same correlated COUNT pattern as #7 (low)
**Fix.** Same as #7.

### 16 – Blanket invalidation on edit/delete (low)
**Fix.** Same pattern as #6 — scope by `conversationType` + `conversationId`.

### 17 – Sweeper awaits broadcasts sequentially (low)
**Impact.** `for (const userId of tracked) { await broadcast(...) }`. Each
`broadcast` does two DB queries. Serialising across users slows the overall
sweep. At 300 users with rare flips this is OK, but the math doesn't favour
scale.
**Fix.** `await Promise.all(tracked.map(broadcast))`. Or, preferably, combine
with #5's memoisation.

### 18 – Room join/accept does three queries where one does (low)
**Fix.** Replace `loadRoom` + `isBannedFromRoom` + `getMembership` with a
single `SELECT rooms.*, bans.target_id IS NOT NULL AS is_banned, members.role
FROM rooms LEFT JOIN room_bans ... LEFT JOIN room_members ... WHERE rooms.id = $1`.

### 19 – Orphan sweeper single-row deletes (info)
Noted for the future; fine today.

### 20 – Virtualisation is already in place (info)
`MessageList.tsx` uses `@tanstack/react-virtual` with `estimateSize: 40` and
`measureElement`. The original brief's "known gap" is closed. Confirm it stays
closed under attachment-heavy rooms (measurement cost).

## Things done well (protect these)

- **UUIDv7 + cursor pagination** on history. k-sortable ids make `before`
  cursors a clean range seek; no offset scans ever.
- **WS + REST split** is sensible: REST for initial load and infinite scroll,
  WS for live deltas. No polling found.
- **Backfill-on-reconnect** via per-conversation watermark (`lastSeen`) +
  `?since=` history endpoint. Correct and rare in hackathon code.
- **Bounded outbound queue drops only presence** on pressure (`connection-manager.ts:34`).
  Prioritisation is the right call even if implementation is partial (#13).
- **Tab grace window** on presence (`PRESENCE_TAB_GRACE_MS`) prevents flicker
  on reconnect – a classic bug avoided.
- **Attachment dedupe by content hash** with orphan sweeper. Correct for
  demo-heavy image posting.
- **Drizzle schema indexes** for common read paths (`messages_conversation_idx`,
  `room_members_user_idx`, etc) are present. The gap is the session table (#1).
- **Client virtualisation** already wired with dynamic measurement.
- **Session cookie approach** (hashed token, server-side revocable) per
  ADR-0001 is the right call for the demo.

## Scale ceiling at 2× target (600 users, 20k history, 1000-member rooms)

The first thing to break is the **room-wide message send path** (findings
#2 + #3). A single message posted to a 1000-member room runs 1000 sequential
unread upserts inside a DB transaction, then synchronously JSON-serialises +
writes the same ~500-byte payload to 1000 WS subscribers on the event loop
before returning. Total wall-clock for that one send is dominated by the DB
round-trips — on a local PG that's ~200–500ms, on a remote one ~1–3s. At 2×
scale the room is still 1000 members (membership cap is the hard constraint,
not user count) but the server is juggling 600 hellos, 600 touchSession
writes per request beat, and a pool of 10 connections — meaning the send
transaction often waits for a pool slot before it can even start. The 3s
delivery SLA falls over on any chatty room as soon as two people send within
half a second of each other. Fix #2 (bulk upsert) first, then #3 (serialise
once + yield), then #1 and #10 (session index + pool size) and the ceiling
comfortably moves past 4× target.
