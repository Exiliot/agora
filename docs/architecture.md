# Architecture

How agora is structured, why, and where every moving piece lives. Read this before planning a feature; it defines the seams.

## 1. Context

```
                ┌────────────────────────────────────────────┐
                │            User's browser (1..N tabs)      │
                │   ┌──────────┐   ┌──────────┐              │
                │   │  web SPA │   │  web SPA │              │
                │   │  tab 1   │   │  tab 2   │   ...        │
                │   └────┬─────┘   └────┬─────┘              │
                └────────│────────────────│──────────────────┘
                         │   HTTP/WS      │
                         ▼                ▼
                ┌─────────────────────────────────────┐
                │          api (Fastify)              │
                │  ┌───────────────────────────────┐  │
                │  │   in-memory pub/sub bus       │  │
                │  │   presence registry           │  │
                │  │   ws connection manager       │  │
                │  └───────────────────────────────┘  │
                └────────┬──────────────┬─────────────┘
                         │              │
                         ▼              ▼
                  ┌──────────┐   ┌─────────────┐
                  │ postgres │   │ /data       │
                  │          │   │ attachments │
                  └──────────┘   └─────────────┘
```

## 2. Containers (docker-compose services)

| Service | Image | Role |
|---|---|---|
| `db` | `postgres:16-alpine` | RDBMS. Single source of durable truth. |
| `api` | multi-stage build from `apps/api/` | Fastify backend. REST + WebSockets. Hosts the in-memory bus and presence registry. |
| `web` | multi-stage build from `apps/web/` | Static Vite build served by `nginx:alpine` or `@fastify/static`. Plain SPA assets. |

Optional in Phase 2 (ST-XMPP-*): `prosody-a`, `prosody-b`, a second `api` instance, and a DNS alias service.

## 3. Process topology (MVP, single instance)

- One `api` process. AC-SINGLENODE-1 is explicit: we do not plan for horizontal scale in the MVP.
- Presence and pub/sub are in-memory inside that process. If we ever need to scale out, the bus gets a Redis backend (ADR-0002 spells out the escape hatch).
- The DB is the source of truth for durable state: users, sessions, rooms, memberships, messages, attachments metadata.
- Attachment bytes live on a named Docker volume mounted at `/data/attachments` inside the api container.

## 4. Frontend (`apps/web`)

Vite + React 19 + TypeScript + Tailwind + TanStack Query + Zustand. Structure:

```
apps/web/
├── public/
├── src/
│   ├── app/              # Route components mapped to URLs
│   │   ├── auth/
│   │   ├── chat/
│   │   ├── sessions/
│   │   └── profile/
│   ├── components/       # Shared presentational components
│   ├── features/         # Feature-aligned slices (messages, rooms, presence…)
│   │   └── messages/
│   │       ├── MessageRow.tsx
│   │       ├── useMessages.ts      # TanStack Query hooks + WS cache mutations
│   │       └── messageStore.ts     # Zustand store (optimistic sends, drafts)
│   ├── lib/
│   │   ├── ws.ts         # WS client singleton + reconnect + subscribe API
│   │   ├── api.ts        # Typed HTTP client, generated from zod schemas
│   │   └── queryClient.ts
│   ├── styles/
│   │   ├── tokens.css    # :root design tokens ported from docs/design
│   │   └── base.css      # resets + global rules
│   └── main.tsx
├── index.html
└── vite.config.ts
```

### Data flow — HTTP

- Every HTTP request goes through the typed `api` client, which validates responses with zod schemas imported from `packages/shared`.
- Mutations use TanStack Query's `useMutation`. On success, they *do not* invalidate; they update the cache locally. WS events do the authoritative propagation.

### Data flow — WebSocket

- Exactly one `WebSocket` per tab, opened on auth.
- On connect, the client sends a `hello` with its tab id (persisted in `sessionStorage`) and the ids of its currently-open conversations (for initial subscription).
- Incoming events are routed through a single dispatcher (`lib/ws.ts`) that updates TanStack Query caches + Zustand stores directly.

## 5. Backend (`apps/api`)

Fastify + Drizzle + `pg` + `@fastify/session` + `@fastify/websocket` + `argon2` + `zod`. Structure:

```
apps/api/
├── src/
│   ├── server.ts                   # bootstrap, plugin registration, start listening
│   ├── config.ts                   # env parsing via zod
│   ├── db/
│   │   ├── schema.ts               # Drizzle schema (tables + enums)
│   │   ├── client.ts               # pg Pool + Drizzle instance
│   │   └── migrations/             # drizzle-kit generated
│   ├── auth/
│   │   ├── routes.ts               # sign-in, register, reset…
│   │   ├── password.ts             # argon2id wrapper
│   │   ├── session-store.ts        # @fastify/session adapter backed by Drizzle
│   │   └── middleware.ts           # requireAuth()
│   ├── users/
│   ├── rooms/
│   ├── messages/
│   ├── attachments/
│   ├── friends/
│   ├── sessions/                   # the "active sessions" feature, not fastify-session
│   ├── notifications/
│   ├── presence/
│   │   ├── registry.ts             # in-memory Map<userId, Map<tabId, lastActivityAt>>
│   │   ├── sweeper.ts              # every N seconds, transitions presence + emits
│   │   └── events.ts               # presence event types + helpers
│   ├── bus/
│   │   ├── bus.ts                  # publish/subscribe API
│   │   └── topics.ts               # topic naming conventions (room:X, dm:X, user:X)
│   ├── ws/
│   │   ├── plugin.ts               # @fastify/websocket registration
│   │   ├── handler.ts              # per-connection session + dispatcher
│   │   └── events.ts               # shared zod schemas for WS events
│   └── utils/
├── tests/                          # vitest
│   ├── unit/
│   └── integration/                # spin up a test db via testcontainers or a test compose
└── drizzle.config.ts
```

### Request pipeline

1. Fastify hook resolves session from cookie via `session-store`.
2. `requireAuth()` attaches `request.user` or returns 401.
3. Route handler validates input with a zod schema.
4. Business logic (often a transactional `db.transaction(async tx => …)`).
5. Publish domain events to the in-memory bus.
6. Response serialised via zod (or a typed serialiser), ensuring shape matches the `shared` package's contract.

### WebSocket pipeline

1. Upgrade request inherits the session cookie — unauthenticated WS connections close with 4401.
2. On open, the handler receives `hello`, registers the tab in the presence registry, subscribes the socket to the union of topics for: the user, their friends, and every conversation the user belongs to.
3. Incoming client events (`message_send`, `message_edit`, `mark_read`, `heartbeat`, `typing` — stretch) go through a central switch; each delegates to the corresponding feature module.
4. Bus-originated events matching the socket's subscription set are serialised and forwarded.
5. Backpressure: each socket has a bounded outbound queue; if full, the oldest-non-critical event is dropped (never a `message_new`).

## 6. The in-memory bus

Not Redis. A single Node module exposing:

```ts
interface Bus {
  publish(topic: string, event: Event): void;
  subscribe(topic: string, handler: (event: Event) => void): () => void;
}
```

Topics use a tiny naming convention:

- `room:<uuid>` — events scoped to one room (message_new, member_joined, etc.)
- `dm:<uuid>` — events scoped to one personal dialog
- `user:<uuid>` — user-targeted events (notifications, presence subscriptions)

Implementation detail: backed by a `Map<string, Set<Handler>>` with iteration on publish. For MVP scale (300 connections, 1000 topics) this is trivially fast. If/when we need Redis (scale-out), the Bus interface stays; the implementation changes.

See ADR-0002 for why this beats Redis for the current scope.

## 7. Presence

Separate from the bus because its state model is richer than pub/sub:

```ts
// In-memory only — never persisted.
type TabId = string;
type UserId = string;
const presence: Map<UserId, Map<TabId, { lastActivityAt: number }>> = new Map();
```

Every WS connection contributes to a tab entry (created on `hello`, updated on `heartbeat`, removed on close). A sweeper runs every 2 seconds:

- For each user, compute the minimum `(now - lastActivityAt)` over all their tabs.
- If no tabs remain → presence is `offline`.
- Else if the minimum idle time > AFK_THRESHOLD (60s) → presence is `afk`.
- Else → presence is `online`.
- If the state changed since the last sweep, publish `presence_update` to the relevant subscriber set.

The sweeper is the *only* writer to the authoritative presence map; WS events read-modify-write atomically within a single event loop tick, which is safe in Node's single-threaded model.

See ADR-0003 for the full state machine and edge cases.

## 8. Persistence layer

Postgres 16, accessed via Drizzle. Why Drizzle over Prisma:

- Flatter generated code, easier for the agent to read and extend.
- Migrations are SQL files in the repo (`drizzle-kit generate`), easier to review.
- No Rust toolchain / engine process to wait on in container builds.

Migrations apply automatically on `api` startup via a small migration runner (`drizzle-orm/migrator`). The migration runner is idempotent — safe to run in every container boot.

## 9. File storage

Attachments stored at `/data/attachments/<hash[0:2]>/<hash[2:4]>/<hash>` on a named Docker volume. Path layout keeps directory fan-out bounded. Each attachment row in the DB holds the content hash + metadata; the bytes are never in the DB.

## 10. Build and run

### Developer loop (outside Docker)

```sh
pnpm install
pnpm --filter api dev      # tsx watch, nodemon-style
pnpm --filter web dev      # vite dev server
# Requires a local postgres; easiest: docker compose up db
```

### Full stack (delivery contract)

```sh
docker compose up --build
# web on :8080, api on :3000, db on :5432
```

## 11. Key design decisions with ADR links

- [ADR-0001 · Server-side sessions, not JWT](adrs/0001-server-side-sessions.md)
- [ADR-0002 · In-process pub/sub bus over Redis](adrs/0002-in-process-bus.md)
- [ADR-0003 · Presence aggregated from per-tab heartbeats](adrs/0003-presence-state-machine.md)
- [ADR-0004 · pnpm workspace monorepo](adrs/0004-monorepo-layout.md)
- [ADR-0005 · XMPP federation as a sidecar, not a retrofit](adrs/0005-xmpp-sidecar.md)
