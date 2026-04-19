# agora

Classic web chat server. Rooms, DMs, presence, file sharing, moderation — the 2000s chat shape, built on a 2026 stack.

Built during an Agentic Development Hackathon (18–20 April 2026) by herding AI agents through a disciplined documentation-first ADLC.

## Run it

```sh
git clone https://github.com/Exiliot/agora.git
cd agora
docker compose up --build
```

Then:

- `http://localhost:8080` – the web app
- `http://localhost:3000/health` – api health check

That's the whole delivery contract. No cloud provider, no DNS, no certificates to wire up. If it builds on the reviewer's machine, it runs.

First `docker compose up --build` on a machine with a cold Docker image cache pays an extra 20–40 s pulling `node:24-alpine`, `postgres:16-alpine` and `nginx:alpine` before the application layers build.

### Port conflicts

The stack binds host ports `3000` (api) and `8080` (web). Both are common defaults (other Node APIs on 3000; Jenkins/Tomcat/assorted HTTP servers on 8080). If either port is already in use the affected container lands in a restart loop – `docker compose ps` will show it.

Override locally without editing the committed compose file by dropping a `docker-compose.override.yml` next to it (the override path is already in `.gitignore`):

```yaml
# docker-compose.override.yml
services:
  api:
    ports:
      - "3100:3000"
    environment:
      # Password-reset links are logged to stdout; this must match the host
      # port the web container is reachable on, or the link will 404.
      APP_BASE_URL: "http://localhost:8090"
  web:
    ports:
      - "8090:8080"
```

### API gotchas

A couple of shapes the curl-level tripwires flagged during the delivery-contract smoke:

- `POST /api/friend-requests` takes `{ "targetUsername": "..." }`, not `receiverId` / `userId`.
- `POST /api/friend-requests/:id/accept` and `/reject` take no body. They tolerate `-H 'Content-Type: application/json'` with no `-d`, and also a literal `{}`.
- Attachment uploads with `Content-Type: text/plain` are normalised to `application/octet-stream` by the MIME allow-list – expected, not a bug.

### CI / e2e overlay

`docker-compose.ci.yml` enables the dev-seed endpoints the Playwright large-history suite and the XMPP load test rely on. It is not layered into the default `docker compose up` so the committed demo never exposes the unauthenticated bulk-register surface. To run the e2e suite:

```sh
pnpm smoke
```

Which expands to `docker compose -f docker-compose.yml -f docker-compose.ci.yml up --build -d && playwright test`.

## Try it

1. Register an account (email + username + password) at `/register`.
2. Create a public room from the sidebar; send a message.
3. Open a second browser / Incognito window; register a second user.
4. From the second user, browse `/public`, join the same room, chat. Messages arrive in real-time on both sides over WebSockets.
5. On one user, go to `/contacts`, search for the other user, send a friend request.
6. The other user accepts from `/contacts`, then opens a DM via the "Message" button. DMs appear in the sidebar and support the same message features as rooms.
7. Create a private room on one side, send a room invitation by username, accept it on the other. Private rooms don't appear in the public catalogue.
8. As owner/admin in a room, click "Manage room" in the right sidebar for members / bans / invitations / settings tabs. Ban a member; they're kicked in real-time.
9. Go to `/sessions` to see active browser sessions; log out one and stay signed in on the other.

## Features

- **Accounts**: register, sign-in/out, password-reset (mock email, reset URL logged to stdout), password change, delete account with cascade.
- **Sessions**: server-side, DB-backed, individually revocable, sliding 14-day expiry.
- **Rooms**: create/browse/search public, invite-only private, join/leave, owner + admins with promote/demote, ban with read-only history for the banned user, delete with cascade.
- **Messages**: real-time over WebSockets, send/edit/delete, UTF-8 + multiline + emoji, reply threading, infinite-scroll history, unread counters. Message list is virtualised (`@tanstack/react-virtual`) to hold 10k+ messages smoothly.
- **DMs**: open from Contacts, friendship-gated, identical message feature set.
- **Contacts**: friend requests (send/accept/reject/cancel), unfriend, user-to-user ban with history preserved read-only.
- **Presence**: in-memory multi-tab state machine with online / AFK / offline states (AFK after 60s of no interaction across all tabs, offline when all tabs close).
- **Attachments**: upload via `POST /api/attachments` (20 MB file / 3 MB image caps), content-addressed disk storage, ACL checked at download against current membership, orphan sweep every 15 min, cascade on room delete.
- **Moderation**: room management modal with members, banned users, invitations, settings tabs.
- **XMPP federation (stretch goal)**: optional two-server Prosody overlay with HTTP-auth bridge into agora's argon2id store, dialback s2s, and a 50-client load test. See below.

## XMPP federation

Optional Phase 2 overlay per [ADR-0005](docs/adrs/0005-xmpp-sidecar.md). Spins two Prosody 0.12 instances beside the main stack; both delegate authentication to agora via HTTP so a single set of credentials works for web chat and XMPP clients.

```sh
# base stack + XMPP overlay
docker compose -f docker-compose.yml -f docker-compose.xmpp.yml up --build -d

# verify cross-server delivery (ST-XMPP-1 + ST-XMPP-2)
NODE_TLS_REJECT_UNAUTHORIZED=0 node tools/xmpp-federation-test.mjs

# 50-client federation load test (ST-XMPP-3)
NODE_TLS_REJECT_UNAUTHORIZED=0 node tools/xmpp-load-test.mjs 50
```

Observed on the reference setup: 50/50 messages delivered across the s2s link, p50 = 10 ms, p95 = 13 ms. The load-test harness enforces ≥ 95% delivery at p95 ≤ 5000 ms and exits non-zero on miss.

`NODE_TLS_REJECT_UNAUTHORIZED=0` is present because Prosody uses a self-signed cert inside the compose network. Direct-TLS c2s on port 5223 (`xmpps://`), s2s via XEP-0220 dialback. The journal trail lives in `docs/journal/` — entries `09`, `12`, and `14` cover the spike, the SASL wall, and the fix respectively.

## Stack

Node 24 · TypeScript (strict) · Fastify 5 · Postgres 16 · Drizzle ORM · React 19 · Vite · TanStack Query · Zustand · Tailwind · Biome · pnpm workspaces · Playwright · Prosody 0.12 (optional XMPP overlay).

## Security and production posture

- **Server-side sessions**, argon2id hashes, SHA-256 token hashing at rest, rotate-on-password-change, individually revocable. See [ADR-0001](docs/adrs/0001-server-side-sessions.md).
- **`@fastify/rate-limit`** on all `/api/auth/*` routes (10/min per IP anon, per-session on `password-change`).
- **`@fastify/helmet`** on the api; nginx carries the SPA-appropriate CSP + `X-Content-Type-Options: nosniff` + `X-Frame-Options: DENY` + `Referrer-Policy: no-referrer` + a restrictive `Permissions-Policy`.
- **WebSocket `subscribe` ACL** gated by the same `canAccessRoom` / `canAccessDm` / `userId === conn.userId` helpers as the HTTP history routes — no client-initiated subscribe slips past membership checks.
- **WS same-origin check** at upgrade; mismatches close 4403.
- **Session secret** is generated from 48 bytes of `randomBytes` on boot if the env var isn't provided, with a warning. `docker-compose.yml` does not commit one, so a fresh clone never ships with a known secret.
- **Postgres is not exposed on the host port.** Api reaches db through the compose network; developers who want psql run `docker compose exec db psql -U app -d app`.
- **Attachment mime allowlist + nosniff** on downloads; `originalFilename` truncated to 255 bytes.
- **Accessibility baseline**: `:focus-visible`, sr-only class, Modal focus-trap + Escape, MessageList `role="log" aria-live="polite"`, composer labelled, primary nav carries `aria-current`, sign-out is a real `<button>`, skip-to-content link present, AA-compliant contrast on all token pairings.

Everything is journalled — see `docs/journal/2026-04-18-11-wave-1.md`, `…-13-wave-2.md`, `…-15-wave-3.md` for the audit → fix trail.

## Project docs

- [Product spec](docs/spec.md) — canonical, with stable requirement IDs.
- [Per-feature requirements](docs/requirements/)
- [Architecture](docs/architecture.md), [data model](docs/data-model.md), [WebSocket protocol](docs/ws-protocol.md).
- [Design system](docs/design/README.md) — Claude Design (Opus 4.7) handoff bundle.
- [ADRs](docs/adrs/) — immutable decisions that shape everything.
- [Journal](docs/journal/) — decisions, detours, lessons as they happened. Entries are numbered (`01`, `02`, …) so they sort chronologically.
- [Audits](docs/audits/) — security, performance, a11y, code quality reports against the afternoon `main`.
- [Demo script](docs/demo-script.md) — five-minute reviewer walkthrough.

## ADLC

This repo was built as an explicit experiment in agent-driven development: context first, code second. Every feature goes through brainstorm → requirements → plan → execute → test → verify → journal before a commit lands. See `CLAUDE.md` and `AGENTS.md`.

## Layout

```
agora/
├── apps/
│   ├── api/                    # Fastify backend
│   └── web/                    # Vite + React frontend
├── packages/
│   └── shared/                 # zod schemas shared between api and web
├── docs/                       # spec, architecture, adrs, journal, design, audits
├── tests/e2e/                  # Playwright delivery-contract smoke tests
├── tools/
│   ├── prosody/                # XMPP sidecar Dockerfile + config template
│   ├── xmpp-federation-test.mjs
│   └── xmpp-load-test.mjs
├── docker-compose.yml          # base stack (db + api + web)
└── docker-compose.xmpp.yml     # optional overlay (prosody-a + prosody-b)
```
