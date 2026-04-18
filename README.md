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

1. Register an account (email + username + password).
2. Create a public room; post a message.
3. Open a second browser (or Incognito window), register a second user, join the same room, send a message from both sides.
4. Open the sessions page — log out one session; the other stays alive.
5. Add the second user as a friend; send a direct message.
6. Attach an image via the paper-clip button or paste it from the clipboard.
7. Close one tab; watch presence move online → AFK → offline as you stop interacting.

> **Demo note**: the hackathon MVP scope is the core chat flows. The scaffolding in this repo is ready; feature implementation happens in the ADLC loop documented under `.claude/commands/feature.md`.

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
