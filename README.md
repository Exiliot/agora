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

- `http://localhost:8080` — the web app
- `http://localhost:3000/health` — api health check

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
- **Messages**: real-time over WebSockets, send/edit/delete, UTF-8 + multiline + emoji, reply threading, infinite-scroll history, unread counters.
- **DMs**: open from Contacts, friendship-gated, identical message feature set.
- **Contacts**: friend requests (send/accept/reject/cancel), unfriend, user-to-user ban with history preserved read-only.
- **Presence**: in-memory multi-tab state machine with online / AFK / offline states (AFK after 60s of no interaction across all tabs, offline when all tabs close).
- **Attachments**: upload via `POST /api/attachments` (20 MB file / 3 MB image caps), content-addressed disk storage, ACL checked at download against current membership, orphan sweep every 15 min, cascade on room delete.
- **Moderation**: room management modal with members, banned users, invitations, settings tabs.

## Stack

Node 24 · TypeScript · Fastify 5 · Postgres 16 · Drizzle ORM · React 19 · Vite · TanStack Query · Tailwind · Biome · pnpm workspaces · Playwright.

## Project docs

- [Product spec](docs/spec.md) — canonical, with stable requirement IDs.
- [Per-feature requirements](docs/requirements/)
- [Architecture](docs/architecture.md), [data model](docs/data-model.md), [WebSocket protocol](docs/ws-protocol.md).
- [Design system](docs/design/README.md) — Claude Design (Opus 4.7) handoff bundle.
- [ADRs](docs/adrs/) — immutable decisions that shape everything.
- [Journal](docs/journal/) — decisions, detours, lessons as they happen.

## ADLC

This repo was built as an explicit experiment in agent-driven development: context first, code second. Every feature goes through brainstorm → requirements → plan → execute → test → verify → journal before a commit lands. See `CLAUDE.md` and `AGENTS.md`.

## Layout

```
agora/
├── apps/
│   ├── api/          # Fastify backend
│   └── web/          # Vite + React frontend
├── packages/
│   └── shared/       # zod schemas shared between api and web
├── docs/             # spec, architecture, adrs, journal, design
├── tests/e2e/        # Playwright delivery-contract smoke tests
└── docker-compose.yml
```
