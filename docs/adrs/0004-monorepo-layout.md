# ADR-0004 · pnpm workspace monorepo

- **Status**: Accepted, 2026-04-18
- **Relates to**: AC-SINGLENODE-1, DR-1, DR-2

## Context

We have two applications (`api`, `web`) and at least one shared package (`shared` — zod schemas that must be identical on both sides of the wire). Three options:

1. **Two separate repos** — independent versioning, cleanest ownership.
2. **Single folder, no workspaces** — simplest, no package boundary enforcement.
3. **Monorepo with a workspace manager** (pnpm/yarn/turbo/nx) — shared types, single install, single build.

For a two-day hackathon with a hard delivery contract (`git clone && docker compose up`), option 3 wins on coordination cost.

Among workspace managers:

- **pnpm workspaces** — fastest install, content-addressable store, first-class workspace protocol (`workspace:*`), excellent for a small number of packages.
- **yarn 4 / berry** — capable but heavier, PnP adds confusion under Docker.
- **Turbo/Nx** — great for large teams, overkill for a 3-package layout.

## Decision

pnpm workspaces. Layout:

```
agora/
├── package.json              # workspace root, scripts, devDeps only
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig.base.json        # base options shared via "extends"
├── biome.json                # lint + format config for all packages
├── apps/
│   ├── api/
│   └── web/
└── packages/
    └── shared/
```

- Root `package.json` carries no production deps. Only devDeps (biome, tsx, drizzle-kit, etc.) so tooling works from any workspace.
- Each app/package has its own `package.json` with its own `dependencies`.
- Cross-package imports use `workspace:*`, e.g. `"@agora/shared": "workspace:*"` in `apps/api/package.json`.
- Single lockfile at the root.

## Consequences

**Positive**:

- Shared types via `@agora/shared` stay in lockstep across api + web without publishing.
- One `pnpm install` at the root sets everything up.
- `pnpm --filter api dev`, `pnpm --filter web dev`, `pnpm --filter api test` are natural.
- Dockerfiles can copy the lockfile + relevant package.json files for a fast, cache-friendly build.

**Negative**:

- Docker multi-stage builds need a small amount of ceremony to copy only the files needed for each stage (otherwise changing any package busts the cache). Documented in each app's Dockerfile.
- `pnpm` must be installed in CI/build images. We use Corepack (`corepack enable` + `corepack prepare pnpm@10.7.0 --activate`) which is bundled with Node 20+.

**Tradeoffs not taken**:

- **TurboRepo** would add parallelised task running but is not worth the setup for a two-day event.
- **A single `node_modules`** (not a workspace) would be simpler but loses the per-package hygiene and makes the shared types either duplicated or symlinked manually.
