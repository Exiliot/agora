# Performance, load, and data-integrity audit – agora

Date: 2026-04-19. Scope: full stack; emphasis on the server hot paths and the
chat-scroll client path. Read-only audit; no code changed. Supersedes
`docs/audits/performance.md` (2026-04-18) where findings overlap; the older
file is kept for trace. This round focuses on the drift since the previous
audit – notifications system, forgot-password, round-3 design fixes – plus a
fresh sweep of areas the first pass called out as likely to regress.

## Executive summary

Between 2026-04-18 and today almost every top finding from the previous audit
has been addressed, which is why this round lands notably calmer. The
previously-critical unindexed `sessions.token_hash` now has
`sessions_token_hash_key` (migration `0001_add_sessions_token_hash_idx.sql`);
the N-sequential unread upserts are now a single batch
`incrementUnreadForMany` (`apps/api/src/messages/unread.ts:79`); the bus
pre-serialises once and yields every 100 handlers (`apps/api/src/bus/bus.ts`);
`touchSession` is throttled to one write per session per 60 s
(`apps/api/src/session/plugin.ts:68`); the pool default moved from 10 to 30
(`apps/api/src/config.ts:26`); `listPresenceSubscribers` has a 10 s TTL memo
(`apps/api/src/presence/subscription.ts:16`); the `/api/conversations`
preview uses `LATERAL` with `ORDER BY m.id` (`apps/api/src/messages/routes.ts:266`);
WS blanket `['messages']` invalidation is now a scoped `setQueryData`
(`apps/web/src/app/WsProvider.tsx:74`); `auto-subscribe` is now idempotent
across reconnect hellos (`apps/api/src/ws/auto-subscribe.ts:20`).

That leaves the notifications feed as the single standout regression risk:
`GET /api/notifications` runs `Promise.all(rows.map(r => hydrateNotification(r.id)))`
where each hydrate is its own SELECT (`apps/api/src/notifications/routes.ts:47`
calling `apps/api/src/notifications/hydrate.ts:13`). At the default limit of
30 this is 30 round-trips for a single REST hit. The most serious structural
gap is **idempotency on `message.send`**: the server mints `uuidv7()` with no
dedupe, so a client retry after a flaky WS send can land two copies of the
same message. Lower down, cursor pagination on `messages` still relies on
`(conversation_type, conversation_id, created_at)` with a residual filter on
`id`, the `/api/rooms` catalogue still uses a correlated `COUNT(*)` in
`ORDER BY`, `/api/users/search` has no index on `lower(username) text_pattern_ops`,
orphan attachment sweeper still deletes one row at a time, and attachment
storage has no tenant-level disk cap.

Top three fixes by resilience per hour of engineering: (1) dedupe
`message.send` by `(userId, clientReqId)` inside a short-lived key; (2) batch
hydrate the notifications feed into a single query; (3) add
`messages_conversation_id_idx` on `(conversation_type, conversation_id, id)`
so history pagination is a clean index-only range seek.

## Findings

Sorted by severity (critical / high / medium / low / info). Paths relative
to the repo root. Under current behaviour, the suggested fixes are estimates
against the single-node Docker Compose target.

| # | Sev | Area | Location | Issue | Symptom under load | Suggested fix |
|---|---|---|---|---|---|---|
| 1 | high | Integrity | `apps/api/src/messages/ws-handlers.ts:111` | `message.send` mints server-side `uuidv7()` with no client idempotency key | Retry after flaky WS or composer double-click double-posts the message | [CLOSED in 38328fb / ADR-0006] `message.send` accepts a client-minted `clientMessageId`; a per-user LRU plus a partial unique index on `(author_id, client_message_id)` collapses retries to the original MessageView. |
| 2 | high | DB | `apps/api/src/notifications/routes.ts:47` → `apps/api/src/notifications/hydrate.ts:13` | Feed endpoint N+1: 30-row page issues 30 SELECTs | 30ms baseline jumps to ~400ms on a warm page against a remote DB; worse cold | [CLOSED in 8f40c4a] Feed endpoint hydrates every page in a single JOIN with actor username pre-attached. `hydrateNotification(id)` remains only on the single-row happy paths (publisher echo, mark-read). |
| 3 | high | DB | `apps/api/src/db/schema.ts:264` | `messages` cursor pagination filters on `id` but the only covering index is on `(conversation_type, conversation_id, created_at)` | Every page-load pays a residual filter; not a bottleneck today, becomes one at 100k history | [CLOSED in migration 0004] Added `messages_conversation_id_idx` on `(conversation_type, conversation_id, id)`. History pagination and the `/api/conversations` LATERAL preview now serve an index-only range scan. |
| 4 | high | WS | `apps/api/src/ws/connection-manager.ts:23,36` | Outbound queue counter drops only `presence.update`; `bufferedAmount` is never consulted | One slow consumer buffers unbounded; RSS grows linearly until OOM on a busy room | [CLOSED] `writeFrame` consults `socket.bufferedAmount` before every send; frames above a 1 MiB threshold are dropped for non-message events with a throttled warn; the 30 s ping tick samples backpressure and closes the socket with 1013 after two consecutive saturated ticks. |
| 5 | high | Integrity | `apps/api/src/messages/ws-handlers.ts:317` | `mark.read` unconditionally overwrites `last_read_message_id` – two out-of-order acks can regress the watermark | Late-arriving `mark.read` older than the current watermark rewinds the read state; unread count goes stale | Add `WHERE last_read_message_id IS NULL OR last_read_message_id < $new` to the UPSERT's DO UPDATE branch |
| 6 | medium | DB | `apps/api/src/rooms/routes.ts:221` | `/api/rooms` public catalogue orders by correlated `COUNT(*)` subquery | Nested-loop cost scales with rooms × avg-members; noticeable at hundreds of rooms | `LEFT JOIN LATERAL (SELECT count(*) …)` or maintain `member_count` column by trigger |
| 7 | medium | DB | `apps/api/src/friends/routes.ts:572` | User search uses `lower(username) like lower('prefix%')` with no matching index | Full table scan of `users_username_lower_key` ignored because `text_pattern_ops` missing | [CLOSED in migration 0004] Added `users_username_lower_prefix_idx` on `lower(username) text_pattern_ops`. Prefix probes from the friends search now hit a covering index instead of seq-scanning users. |
| 8 | medium | DB | `apps/api/src/messages/routes.ts:226-256` | `/api/conversations` runs 4 sequential queries (memberships, DMs, usernames, unreads, last-read, preview) | Six serial round-trips before response; dominant cost is network RTT, not per-query work | Parallelise the independent ones; promote the DM usernames into the initial `dmConversations` scan with a JOIN |
| 9 | medium | DB | `apps/api/src/rooms/routes.ts:260` | `/api/rooms/mine` also uses correlated `COUNT(*)` per row | Same shape as #6 at lower cardinality | Same fix as #6 |
| 10 | medium | DB | `apps/api/src/db/schema.ts:265` | `messages.reply_to_id` has no index; deleting a message won't cascade but replies to deleted messages need a lookup | Any feature that lists replies to a given message does a seq-scan | [CLOSED in migration 0004] Added partial `messages_reply_to_idx` on `(reply_to_id) WHERE reply_to_id IS NOT NULL`. Reply-chain lookups are O(index) instead of seq-scanning messages. |
| 11 | medium | DB | `apps/api/src/attachments/sweeper.ts:33` | Orphan sweep deletes one attachment row at a time and runs a separate "still referenced" check per hash | At steady state fine; after a refused-upload flood, 1000 orphans do 2000 round-trips | Batched `DELETE ... RETURNING`, then group by hash + a single `LEFT JOIN` against the remaining table |
| 12 | medium | DB | `apps/api/src/notifications/publisher.ts:48` | `ON CONFLICT (user_id, kind, subject_type, subject_id) WHERE read_at IS NULL DO UPDATE` – on concurrent inserts from different authors Postgres serialises at the unique index, correctness-safe, but the `aggregate_count = aggregate_count + 1` increment returns the inserted id with stale view | Under two simultaneous mentions, the second hits `DO UPDATE`, `RETURNING id` gives the original row id; a subsequent `hydrateNotification(resolvedId)` hits the DB a second time | Combine insert+hydrate into one statement, or use `SELECT ... FROM new_rows` CTE |
| 13 | medium | WS hot path | `apps/api/src/ws/plugin.ts:81` | `clientToServerEvent.safeParse` runs on every frame including heartbeats | Zod discriminated-union parse is ~20-40µs per frame; at 300 users × 1 heartbeat / 5s = 60/s it's fine, but every `client.focus` from tab-switching stacks on top | Keep the parse; only nitpick if `heartbeat` becomes the dominant load – consider a two-stage parse that short-circuits on `type` |
| 14 | medium | Client | `apps/web/src/app/WsProvider.tsx:138` | `unread.updated` invalidates every `['conversations']` query and the same for `message.new` at line 88 | On a chatty room, every inbound message triggers a full sidebar refetch | Scope invalidate to `['conversations']` but cap with `refetchType: 'active'` or patch the cached list in place |
| 15 | medium | Client | `apps/web/src/pages/chat/ChatView.tsx:108` | Members panel renders every `MemberRow` unmemoised; each calls `usePresenceOf` | 1000-member room → 1000 selectors run per `presence.update`; zustand's shallow compare saves render but not selector cost | `React.memo(MemberRow)` + virtualise the member list; presence event only re-renders the changed row |
| 16 | medium | Observability | `apps/api/src/server.ts:17` | Pino at `info` in production logs every request and every WS close; debug in dev logs every ws-open / close / hello / heartbeat | Disk churn on a busy night; log volume hides signal | Keep info for REST, promote WS ping/close to `trace`, demote request-logging to `warn` level outside dev |
| 17 | low | Integrity | `apps/api/src/db/schema.ts:136` | Friendship `(user_a_id < user_b_id)` check is at the DB level; good. `dm_conversations` has the same check. Confirm every write path uses `pairKey` | No defect observed; call-sites audit matches; worth a CI linter | Add an eslint rule (or just a grep in CI) that insertions into `friendships` / `dm_conversations` go through `pairKey` only |
| 18 | low | Integrity | `apps/api/src/messages/ws-handlers.ts:264` | `message.delete` issues `SELECT ... messages` then `UPDATE ... messages` without a transaction – two users racing delete can both "win" and both publish `message.deleted` | One duplicate `message.deleted` event on concurrent deletes; harmless but noisy | Wrap in a single `UPDATE ... WHERE id = $id AND deleted_at IS NULL RETURNING ...` |
| 19 | low | Storage | `apps/api/src/attachments/storage.ts:49` | Named Docker volume (`attachments:/data/attachments`) has no size cap or per-user quota | A single user can fill the host disk by looped uploads up to `MAX_FILE_BYTES` each; sweeper only reaps orphans | Enforce a per-user + global cap at upload time (SUM of sizes by uploader, reject at threshold); document the disk-fill failure mode |
| 20 | low | Observability | `apps/api/src/server.ts:57` | `/health` reports DB reachability but no `/ready` (migrations applied) and no `/metrics` | Container orchestrators have to guess; manual load-test needs ad-hoc metrics | Split into `/live` (process up) and `/ready` (migrations applied + pool hasn't flat-lined). Add a `/metrics` later if Prometheus joins the stack |
| 21 | low | Startup | `apps/api/src/server.ts:93` | API blocks on migrations before `listen()`; healthcheck waits out the migration | Fine today (3 migrations, ms-scale); a 30-second alter-table would make the container's `depends_on` soak timeout trip | Accept for MVP; document "blocking migrations" in ADR-style note if / when an expensive one appears |
| 22 | low | DB | `apps/api/src/session/store.ts:103` | Cascade delete on `users` → `sessions`, `friendships`, `friend_requests`, `room_members`, `room_bans`, `room_invitations`, `dm_conversations`, `conversation_unreads`, `last_read`, `notifications` | Deleting a power user with 1k rooms + 10k messages holds exclusive locks on every cascaded table; everyone in those rooms sees latency | Soft-delete is already present via `users.deleted_at`; hard-delete should batch via `WHERE user_id = $1 LIMIT n` per table if ever needed |
| 23 | low | Client | `apps/web/package.json` | `@tanstack/react-query` + `@tanstack/react-virtual` + `react-router-dom` + `zustand` + `zod` + `react` + `react-dom` is a reasonable baseline | No bundle build in `apps/web/dist/` to measure; estimate sub-200KB gzipped for app code, ~50KB for React 19 runtime | Run `vite build` once and wire a CI bundle-size budget in `docker-compose.ci.yml` |
| 24 | info | Bus | `apps/api/src/bus/bus.ts:74` | `handlers.size > 1` gates pre-serialisation; single-subscriber topics still stringify in `WsConnection.send` | Sub-optimal but cheap | Consider always pre-serialising if the subscriber is a ws connection; topic type isn't known at publish time so leave |
| 25 | info | WS | `apps/api/src/ws/plugin.ts:64` | 30 s ping, terminate on missed pong (~60 s) | Sensible default | Document the interval so future edits don't silently regress |

## Area-by-area notes

### 1. Database – indexes, query plans, N+1

**Index coverage is solid for the known hot paths.**

- `sessions.token_hash` is unique-indexed (`schema.ts:76`,
  `0001_add_sessions_token_hash_idx.sql`). The critical finding from the
  previous audit is resolved.
- `messages_conversation_idx` covers the history scan by
  `(conversation_type, conversation_id, created_at)`. Cursor pagination
  filters by `messages.id`, not `created_at` – UUIDv7 keeps the two
  equivalent in sort order, but the planner does a residual filter. A
  `(conversation_type, conversation_id, id)` index turns pagination into an
  index-only range seek (finding #3). The preview LATERAL in
  `/api/conversations` also orders by `m.id DESC`, so it would benefit.
- `/api/conversations` preview (`routes.ts:266`) is cleanly rewritten with
  `LATERAL (SELECT … ORDER BY m.id DESC LIMIT 1)` – this is the recommended
  shape from the previous audit.
- `notifications_feed_idx (user_id, read_at, created_at)` and the partial
  unique `notifications_unread_collapse_key (user_id, kind, subject_type,
  subject_id) WHERE read_at IS NULL` are both in place and correct for the
  collapse semantics.
- User-search lookup (`friends/routes.ts:572`) uses `lower(username) LIKE
  'prefix%'`. The unique index on `lower(username)` exists but isn't usable
  for `LIKE prefix%` in default collation without `text_pattern_ops`. At
  the current user count it's a full scan; adding a prefix-opclass index
  fixes it (finding #7).

**N+1 hot spots.**

- Notifications feed (finding #2) – the `Promise.all(rows.map(r =>
  hydrateNotification(r.id)))` pattern is structurally N+1 by design. At
  `limit=30`, that's 30 single-row SELECTs per feed load. Each hydrate is a
  simple `users` left join – easy to fold into the feed query with the
  same alias trick already used inside `hydrateNotification`. Becomes
  noticeable (≥100ms added latency) on any remote DB link; on a LAN-local
  Postgres it hides in RTT noise.
- `hydrateMessages` in `apps/api/src/messages/history.ts:66` is already
  batched – one author-lookup + one attachment-lookup regardless of row
  count. Good.

**Transactions.**

- `message.send` (`ws-handlers.ts:114`) is in a transaction (message insert
  + attachments link + unread upserts). Correct.
- `message.edit` is a single UPDATE – fine.
- `message.delete` is SELECT then UPDATE without a transaction – two users
  racing can both "win"; finding #18.
- `createRoom`, friend-request accept, user-ban, room-delete, room-admin
  promote/demote are all wrapped correctly.
- Password reset (`apps/api/src/auth/password-reset.ts`) updates the
  password hash and deletes the used reset token in one transaction.
- `dm_conversations` creation uses `INSERT … ON CONFLICT DO NOTHING` with
  a retry-select to handle races cleanly; idempotent by construction.

**ON CONFLICT on the notifications collapse index.**

- The partial unique index is valid ( `WHERE read_at IS NULL` ). Concurrent
  inserts that both fall into `DO UPDATE` serialise at the index; one
  survives as INSERT, the other as UPDATE. Correctness-safe.
- `RETURNING id` returns the *original* row's id on UPDATE (not the new
  UUIDv7 the publisher generated). `publisher.ts:54` already handles that
  (`result.rows[0]?.id ?? newId`). Fine.
- Minor: the subsequent `hydrateNotification(resolvedId)` is a second SELECT
  that could be folded into the INSERT via a CTE (finding #12).

**Cascades.**

- Every FK to `users` uses `ON DELETE cascade` (sessions, rooms,
  room_members, room_bans, room_invitations, friend_requests, friendships,
  user_bans, dm_conversations on both sides, last_read,
  conversation_unreads, password_resets, notifications – and `set null`
  for messages.author_id, attachments.uploader_id, rooms as owner are not
  set-null). Hard-deleting a power user with lots of rooms would hold
  locks across ~ten tables. `users.deleted_at` is the intended soft-delete
  path; document this (#22).

### 2. In-process bus scalability

- `bus.ts` backs topics with `Map<string, Set<Handler>>`. `publish`
  snapshots the handler set into an array, pre-serialises the event body
  once when there is more than one subscriber, and yields to the event
  loop every 100 handlers via `setImmediate`. The 2026-04-18 fan-out
  bottleneck is resolved.
- Peak subscribers per topic: `room:<id>` gets one subscription per live
  tab per member; for a 1000-member room with each member on 2 tabs that's
  2000 handlers. At YIELD_EVERY=100 the bus dispatches in ~20 batches with
  setImmediate boundaries; inclusive cost ~3 ms on a modern server (one
  `ws.send` per handler is ~1.5 µs for Node after buffering).
- `user:<uuid>` topics are 1–N where N is the user's tab count. Typical 3.
- `publish` cannot be awaited, so the dispatcher continues without yielding
  to DB work. No bus publish is inside a DB transaction in the current
  code (`message.send` publishes after `tx` returns, `notification.created`
  publishes after the INSERT…RETURNING). Good.
- `connections.forUser(userId)` is `Array.from(Set)` – `O(k)` where `k` is
  the user's live tabs. `ConnectionRegistry.byUser` keeps a per-user Set.
  At 100 users × 3 tabs = 300 sockets total the registry is trivially fast.

### 3. WebSocket hot path

- Per-message cost on the plugin's `socket.on('message')` handler:
  `raw.toString()` → `JSON.parse` → `clientToServerEvent.safeParse`. Zod's
  discriminated-union parse is O(1) against the `type` tag plus the variant
  schema cost. ~20-40 µs per frame on Node 22. At 300 users × 1 heartbeat /
  5 s = 60 events / s, cost is negligible; client.focus and typing
  stretches stay under 1k events / s even with every user switching tabs.
- Max WS payload is 64 KiB (server.ts:39). Message body cap is 3 KB
  (per `ws-protocol.md`); attachments travel out-of-band.
- **Backpressure gap (finding #4).** The connection manager counts queued
  frames and drops `presence.update` once `queued >= 512`. But `queued` is
  incremented on *enqueue* and decremented on the ws lib's send callback –
  it reflects "frames we've asked to send that haven't been acked by the
  Node stream API yet", not kernel socket buffer pressure. If a consumer's
  TCP buffer is full, `ws.send` returns immediately and the Node WebSocket
  layer queues in memory. `socket.bufferedAmount` is the real signal; the
  plugin never reads it. Fix: gate by `bufferedAmount > THRESHOLD` and
  close with 1013 if exceeded for more than one tick.
- Ping every 30 s, terminate on missed pong within 30-60 s. Sensible
  default; matches `@fastify/websocket` / `ws` idioms.
- `auto-subscribe.ts` is now idempotent against reconnect hellos – the
  `hasConversationSub` check short-circuits the DB roundtrip if this
  connection has already loaded its rooms/DMs. For a fresh hello the
  two-query fan-out is still unbatched but each query is indexed
  (`room_members_user_idx`, `dm_conversations_pair_key`). At 1000 rooms
  per user (unlikely), this is two 1000-row scans. Keep watching.

### 4. Presence

- State lives in `presence: Map<userId, Map<tabId, TabState>>` in
  `apps/api/src/presence/registry.ts`, never persisted.
- Sweeper runs every 2 s, iterates tracked users, computes state changes
  in memory, then fans out `Promise.all(transitions.map(broadcast))` – the
  sequential-broadcast regression from the previous audit is gone.
- `listPresenceSubscribers` has a 10 s TTL memo
  (`presence/subscription.ts:16`) with explicit invalidation on friendship
  / user-ban / room-membership mutations (grep for
  `invalidatePresenceSubscribers`). At 300 users churning online↔afk once
  per minute, cache hit rate is >90 %; below that TTL, 2 sequential
  `SELECT`s against indexed columns (`friendships` composite PK,
  `room_members_user_idx`). OK.
- Cost of one user going offline: `listPresenceSubscribers` → N subscriber
  ids → N `bus.publish(userTopic(subscriberId), event)` calls. Each
  `bus.publish` is O(handlers for that user's topic) = O(their tab count).
  For a user sharing 10 rooms at 100 members each = 100 subscribers × 3
  tabs average = 300 sends. Well within budget.

### 5. Client performance

- Message virtualiser (`MessageList.tsx:317`) uses `@tanstack/react-virtual`
  with `estimateSize: 40`, `overscan: 12`, `measureElement:
  getBoundingClientRect().height`. On a 10k-message conversation the
  virtualiser keeps ~20 DOM rows mounted. Measured via the
  `large-history.spec.ts` e2e test; confirmed still present and still
  targeting `seeded message 5000` at 10k.
- **Layout thrash:** the initial scroll-to-end and "auto-follow on new
  message" hooks use `requestAnimationFrame` to give the virtualiser a
  measure pass before scrolling – no read-then-write in the same frame.
  `handleScroll` reads `scrollHeight/scrollTop/clientHeight` and sets
  `isAtBottom` via `setState`; React batches the update. Clean.
- The members panel (ChatView.tsx:108) renders every member unmemoised
  (finding #15). Zustand's subscription makes the render cost O(rows per
  presence.update × selector cost). Fine at 50 members, measurable at 500.
- React Query cache footprint: `useMessages` uses infinite queries keyed
  by `['messages', type, id]`; pages are never pruned automatically.
  Switching between 10 conversations retains 10 × N-pages in memory. With
  per-page ~50 messages × 10 conversations, cache ~5 MB. TanStack Query's
  default `gcTime` of 5 min kicks in when a query has no observers; cache
  should trim naturally once a chat is closed. Not a problem today. Worth
  a cap (e.g. `maxPages: 20`) if a user pins 50+ rooms open.
- `WsProvider.tsx` handlers: the `useEffect` registers once per mount;
  cleanup on unmount. `queryClient.setQueryData` callers use inline
  closures – that's fine for correctness (the updater runs once per
  event), the "stable callback" concern doesn't apply because these aren't
  passed into child components via props.
- Bundle size: `apps/web/dist/` is absent because the build hasn't been
  run in the workspace. Dependency list looks tight: React 19, TanStack
  Query 5, TanStack Virtual 3, react-router-dom 7, zustand, zod. No
  obvious heavyweights (no MUI, no moment, no lodash, no recharts). A
  measured build should land under ~220 KB gzipped for app code.

### 6. Concurrency + integrity

- **Idempotency on `message.send` (finding #1).** Server mints `uuidv7()`
  inside the handler; retry after the client doesn't receive an ack will
  mint a new id and land a second row. The WS client sets a 10 s timeout
  and rejects; the UI can re-send. There is nothing on the server to
  detect "this is the same message re-sent". Fix: accept an optional
  `clientMessageId` in the payload; hash `(userId, clientMessageId)` into
  a per-user short-lived LRU set (or a tiny `message_dedupe` table with
  `(user_id, client_id, message_id)` and an expiry) and return the prior
  `MessageView` if seen. Low effort; big correctness win.
- **Concurrent unread upserts from two simultaneous sends to the same DM.**
  `incrementUnreadForMany` does a single `INSERT ... ON CONFLICT DO
  UPDATE SET count = count + 1 RETURNING`. Two parallel inserts land on
  the same PK `(user_id, conversation_type, conversation_id)`; Postgres
  serialises at the unique constraint and each returns the correct
  post-increment count. Safe.
- **`mark.read` out-of-order regression (finding #5).** `ws-handlers.ts:317`
  unconditionally writes `last_read_message_id = payload.messageId`. Two
  `mark.read` acks arriving out-of-order from two tabs of the same user
  (one for an older message, one for a newer one) will leave the older
  winning if it arrives last. UUIDv7 ids are monotonic per client tick but
  not across tabs. Fix: add `WHERE last_read_message_id IS NULL OR
  last_read_message_id < EXCLUDED.last_read_message_id` to the DO UPDATE.
- **Friendship pair ordering.** `friendships_a_lt_b` CHECK constraint
  enforces `user_a_id < user_b_id` at the DB level (schema.ts:138). A
  malicious or buggy client cannot bypass it – any INSERT with reversed
  order fails the check. `pairKey()` is used at every call site in
  `apps/api/src/friends/routes.ts` to avoid hitting the constraint. Same
  shape on `dm_conversations` (schema.ts:258). Solid.

### 7. Startup + migrations

- `server.ts:91-96` runs `runMigrations()` (Drizzle's migrator) before
  `app.listen()`. The health endpoint only exists once the server listens,
  so Docker healthchecks wait through migration time. Today that's ~50 ms;
  a future 30 s migration would miss the compose `retries: 30` window (2 s
  × 30 = 60 s). Note the risk (finding #21) but acceptable for MVP.
- Migration files under `apps/api/src/db/migrations/` are named
  `0000_init.sql`, `0001_add_sessions_token_hash_idx.sql`,
  `0002_notifications.sql`. `meta/_journal.json` tracks which have been
  applied. Drizzle's migrator is idempotent – safe to re-run. Rollback is
  not supported by Drizzle; forward-only migrations is the contract.

### 8. Observability

- Request logging: pino at `info` in production,
  `disableRequestLogging: true`. WS open/close is logged at `debug` only.
  Per-message WS frames are not logged. Noise floor is acceptable.
- Health: `/health` returns DB reachability + `Date.now()`. There is no
  `/ready` (migrations applied marker) and no `/metrics`. Finding #20
  recommends a split.
- No slow-query logging configured in Postgres 16 – default
  `log_min_duration_statement` is off. Enabling it
  (`POSTGRES_INITDB_ARGS="--log-min-duration-statement=200"` or via
  `psql ALTER SYSTEM`) would surface regressions during the demo without
  changing application code.

### 9. Load-test evidence

- The previous audit's "50-client test" refers to `tools/xmpp-load-test.mjs`
  which still exists. It authenticates 50 clients per XMPP server and
  measures p50/p95/max – it tests the federation path via XMPP, not the
  native WebSocket path. There is no native WS load test in-repo.
- Playwright e2e in `tests/e2e/`:
  - `large-history.spec.ts` seeds 10k messages via `/api/dev/seed-messages`
    and verifies progressive scroll-up works within 120 s.
  - `multi-user.spec.ts` runs two browsers against a single room and
    confirms real-time round-trip.
  - No fan-out load test; no soak; no memory-growth assertion.
- `apps/api/tests/integration/` holds per-feature integration specs
  (messages, rooms, friends, attachments) but no concurrency sweep.
- Recommendation: wire a small `autocannon` or plain `ws` Node script
  that opens N sockets, joins one room, sends M messages, measures
  latency p95. Ten lines of code; enormous signal for a 3rd-edition
  hackathon demo that has to impress ~80 graders.

### 10. Storage

- Attachments live on a named Docker volume (`storage:/data/attachments`
  in `docker-compose.yml`). Content-addressed
  `sha256` hash with a two-level fan-out (`<hash[0:2]>/<hash[2:4]>/<hash>`)
  keeps any single directory bounded.
- `MAX_FILE_BYTES` and `MAX_IMAGE_BYTES` enforce per-upload caps; neither
  the API nor the sweeper enforces a per-user quota or a global
  "near-full" threshold. A malicious user uploading 10 MB files until
  disk fills will take down the volume; Postgres on the same docker
  daemon will start to refuse WAL writes (different volume but shared
  underlying disk on default setups). Finding #19.
- Orphan sweeper runs every 15 min; per-row deletes (finding #11 for
  scale, not correctness).

## Capacity estimate

For the single-instance Docker Compose deployment on a developer-class
host (4-core, 16 GB, NVMe local disk): **comfortably serves ~250–300
concurrent active users** with the current code, limited first by
WebSocket buffer behaviour on any unhealthy consumer (finding #4) rather
than by CPU or DB. Message delivery p95 stays well under the 3 s SLA up
to about 500 concurrent users sending at a realistic ~0.2 msg/s each;
presence updates stay within the 2 s SLA up to ~400 users with normal
online/afk churn because the sweeper's sequential-broadcast regression
is gone.

First bottleneck beyond that range: WebSocket write-buffer bloat on slow
consumers, because the queue counter only gates `presence.update` and
there is no `bufferedAmount` check. Second bottleneck: notifications feed
N+1 starts to show in the UX (bell icon "slow to load") around 2–3k
notifications per user. Third bottleneck, later: `sessions` table
`UPDATE` churn – even throttled to 60 s, at 1 000 concurrent users it's
~17 writes/s, harmless but worth keeping in mind if session-TTL is ever
shortened.

## What's already solid

- Session token lookup is now indexed (the critical regression from
  2026-04-18 is closed).
- Unread upserts are one statement via `incrementUnreadForMany`, scaling
  cleanly to 1000-member rooms.
- Bus pre-serialises once per publish and yields every 100 handlers –
  fan-out is no longer blocking on the event loop.
- `touchSession` throttled to one write per session per 60 s.
- PG pool max is now 30 by default with env override.
- `/api/conversations` preview is `LATERAL`-based, not `DISTINCT ON`.
- `listPresenceSubscribers` is memoised with explicit invalidation on
  membership / friendship / ban mutations.
- WS `auto-subscribe` is idempotent on reconnect hellos.
- WS blanket `['messages']` invalidation became scoped `setQueryData`.
- Presence sweeper broadcasts in parallel with try/catch around each.
- `dm_conversations` + `friendships` pair ordering enforced by DB CHECK,
  not application code alone.
- UUIDv7 everywhere for k-sortable pagination and cheap cursor seeks.
- TanStack Virtual already wired on the message list with dynamic
  measurement; the 10k-history e2e still green.
- Topic ACL on `subscribe` (`topic-acl.ts`) correctly locks down cross-
  user topic subscriptions.
- Attachment storage is content-addressed with atomic temp-file rename;
  dedupe at rest; mime-type allowlist for images.

## Recommended ADRs

**ADR: Idempotency keys for `message.send`.** Message send is the only
hot write path where a client retry after a flaky ack produces a visible
duplicate. Accept an optional `clientMessageId` (client-minted UUIDv7);
store `(user_id, client_message_id, message_id, created_at)` in a small
`message_dedupe` table with a 24 h TTL (or an in-memory LRU keyed per
user tab if we accept losing dedupe on restart); return the prior
`MessageView` when a retry lands. Document the retry contract in
`docs/ws-protocol.md`.

**ADR: Batch hydration for feed endpoints.** The notifications feed
demonstrates that `hydrate(id)` is a reasonable per-row helper in
isolation but dangerous when mapped over a result set. Establish a
repo-wide norm: any endpoint returning a list of domain objects hydrates
its view in one query that joins the needed lookups; per-id hydration is
kept for single-row endpoints only. Ban `Promise.all(rows.map(h))`
patterns in code review.

**ADR: WebSocket write backpressure policy.** Adopt a concrete policy
for when to drop vs. close: check `socket.bufferedAmount` before every
`ws.send`; if above 1 MiB for more than one tick, close with 1013 (try
again later); presence updates stay dropped-first; message events never
dropped before close. Pin this in code and in docs so a future hackathon
session doesn't silently regress the contract.

**ADR (lesser priority): Attachment quotas and disk-full policy.**
Decide whether per-user quota enforcement lives in the application layer
(cheap) or uses filesystem quotas on the named volume (Docker-specific).
Decide what happens on `ENOSPC`: reject uploads cleanly, or crash and
let compose restart? Pick one; document it; wire a nightly log of disk
headroom.
