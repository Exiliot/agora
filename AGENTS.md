# AGENTS.md · agora

Tool-agnostic guide for any agent (Claude Code, Codex, Cursor) working in this repo. For Claude-specific workflow, read `CLAUDE.md` too.

## Project

`agora` is a classic web chat server built during the Agentic Development Hackathon, April 2026. Full brief: `docs/spec.md`.

## Stack

- **Runtime**: Node 24 + TypeScript strict
- **Backend**: Fastify 5 + `@fastify/websocket` + `@fastify/session` + `@fastify/multipart` + `@fastify/cookie` + `@fastify/rate-limit`
- **Database**: Postgres 16 via Drizzle ORM (`drizzle-orm`, `drizzle-kit`)
- **Password hashing**: `argon2` (argon2id)
- **Realtime**: WebSockets (no WebRTC, no Socket.io)
- **Pub/sub**: in-process `Map<topic, Set<handler>>` — no Redis in MVP
- **Frontend**: Vite + React 19 + TypeScript + Tailwind + TanStack Query + Zustand
- **Shared schemas**: zod, in `packages/shared/`
- **Testing**: Vitest (units/integration) + Playwright (e2e)
- **Tooling**: Biome for lint+format, tsx for local dev watch, pnpm 10 as package manager

## Layout

```
agora/
├── apps/
│   ├── api/                        # Fastify backend
│   └── web/                        # Vite + React frontend
├── packages/
│   └── shared/                     # zod schemas for DTOs and WS events
├── docs/                           # spec, requirements, architecture, adrs, design, journal, plans
├── tests/
│   └── e2e/                        # Playwright end-to-end tests
├── storage/                        # (gitignored) host-side volume for uploaded files
├── docker-compose.yml
├── CLAUDE.md
├── AGENTS.md
├── README.md
└── package.json                    # pnpm workspace root
```

## Delivery contract

```sh
git clone https://github.com/Exiliot/agora.git
cd agora
docker compose up --build
# api    → http://localhost:3000
# web    → http://localhost:8080
# db     → localhost:5432 (exposed for dev only)
# health → http://localhost:3000/health returns 200 once up
```

No environment variables required to run the demo. Any defaults live in `docker-compose.yml` or a checked-in `.env.example` loaded by Compose.

## Commands

```sh
pnpm install                          # install everything
pnpm --filter api dev                 # api in watch mode (requires a running db)
pnpm --filter web dev                 # vite dev server
pnpm --filter api test                # api unit + integration tests
pnpm --filter web test                # web unit tests
pnpm test:e2e                         # Playwright end-to-end
pnpm typecheck                        # tsc --noEmit across workspace
pnpm lint                             # Biome check
pnpm format                           # Biome format write

# Docker
docker compose up --build             # full stack
docker compose logs -f api            # tail backend logs
docker compose exec api sh            # shell in backend container
docker compose exec db psql -U app    # postgres cli
```

## Conventions

- **TypeScript strict.** `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- **ESM only** in application code. `"type": "module"` everywhere.
- **`const` over `let`, arrow over `function`, `async/await` over `.then()`.** Functional helpers over imperative loops.
- **Validate at boundaries.** HTTP inputs + WS events pass through a zod schema from `@agora/shared`.
- **Tests next to source.** `foo.ts` + `foo.spec.ts`.
- **Default export React components, named export helpers.**
- **No comments that narrate WHAT.** Only WHY, and only when non-obvious.
- **British English** everywhere. No em dashes in prose.

## Conventional Commits (no tooling, just discipline)

Format: `type(scope): imperative message`.

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`.

Scopes: roughly the spec sections — `auth`, `sessions`, `presence`, `rooms`, `messages`, `attachments`, `notifications`, `ui`, `ws`, `infra`.

Good: `feat(rooms): enforce owner cannot leave own room`
Bad: `feat: update roomService.ts`

One imperative line. No body unless the change needs a rationale. No `Co-Authored-By`, no AI attribution.

## What not to do

- Don't add a runtime dependency without justification in a plan or ADR.
- Don't touch files under `docs/design/` — reference only.
- Don't edit accepted ADRs. Supersede with a new one.
- Don't push to `main` without running the delivery-contract check.
- Don't invent new design tokens, colours, spacing values, or fonts.
- Don't add error handling or fallbacks for impossible internal states.
- Don't use JWT (see ADR-0001). Don't use Redis (see ADR-0002).
- Don't use Socket.io. Native WS only.
- Don't put presence state in Postgres (see ADR-0003).

## Delivery checklist (before push)

- [ ] `docker compose up --build` starts cleanly from a fresh state
- [ ] `http://localhost:3000/health` returns 200
- [ ] Playwright e2e smoke is green
- [ ] `pnpm typecheck` is green across all workspaces
- [ ] `pnpm lint` is green
- [ ] `docs/journal/` has an entry for the session
- [ ] Commit log reads like a human wrote it
