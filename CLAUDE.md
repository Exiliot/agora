# CLAUDE.md · agora

The operating manual for Claude Code sessions in this repository. Read this first in every new session; it tells you where the truth lives and what workflow to follow.

## What agora is

A classic web chat server: rooms (public/private), DMs, multi-tab presence, file sharing, moderation. Built for the Agentic Development Hackathon, 18–20 April 2026. See `docs/spec.md` for the full brief. The rest of this file assumes you have read it.

## Where the truth lives

Read before doing. Update after changing.

| Need | Document |
|---|---|
| What is the product and what does it do? | `docs/spec.md` (canonical, requirement IDs pinned) |
| What are we building in this feature? | `docs/requirements/*.md` (one file per area, indexed in `docs/requirements/README.md`) |
| How does the system hang together? | `docs/architecture.md` |
| What does the DB look like? | `docs/data-model.md` |
| What does the wire protocol look like? | `docs/ws-protocol.md` |
| Why a specific choice? | `docs/adrs/*.md` (Nygard-style, immutable once accepted) |
| What's the design language? | `docs/design/README.md` and the Claude Design bundle in the same folder |
| What happened in past sessions? | `docs/journal/*.md` (chronological) |
| Concrete in-flight plan? | `docs/plans/*.md` (generated per feature via `/plan`) |

If two documents contradict: `docs/spec.md` wins. Flag the drift and update.

## The ADLC workflow

Every feature goes through the same loop. No skipping steps. Document-first, code after.

1. **Brainstorm** — `superpowers:brainstorming` to clarify intent. Output is a short memo in the feature's requirement file under "Open questions" resolved.
2. **Requirements** — the feature's file under `docs/requirements/` already exists. If gaps, fill them and note the spec IDs covered. If a new area appears, add `docs/requirements/XX-<area>.md` and index it in the README.
3. **Plan** — `superpowers:writing-plans`. Output: `docs/plans/<feature>.md` with an ordered step list, each step with a verification point (a test, a curl command, a browser check). Include a "how to abort" section if a step fails.
4. **Execute** — `superpowers:executing-plans` or `superpowers:subagent-driven-development`. Each step's verification runs before moving on.
5. **Test** — `superpowers:test-driven-development` for anything with non-trivial logic: auth flows, session lifecycle, presence state machine, ban checks, message permission rules, file ACL. Pure UI rendering can lean on e2e.
6. **Verify** — `superpowers:verification-before-completion` BEFORE claiming done. Golden rule: `docker compose up --build` → exercise the core flow → confirm. Playwright smoke must be green.
7. **Review** — `superpowers:requesting-code-review` before pushing to `main`.
8. **Journal** — append to `docs/journal/YYYY-MM-DD-<topic>.md` with decisions, detours, lessons. Keep it terse; past tense; Takeaways at the end.

## Non-negotiable rules

These are not preferences. Breaking them creates rework.

### Product / architecture

1. **Delivery contract first, features second.** `git clone && docker compose up --build` must bring the whole stack up on any machine with Docker. Confirm after every significant change. See DR-1..DR-6.
2. **Server-side sessions only.** No JWT. See ADR-0001. Sessions are individually revocable via DB rows.
3. **In-memory bus for fan-out.** No Redis in MVP. See ADR-0002.
4. **Presence is in memory, not in DB.** See ADR-0003.
5. **Postgres is the durable record for everything.** Messages, users, memberships, attachments metadata. Files on disk via the mounted volume.
6. **Access checks are done at request time, every time.** Room membership, user bans, attachment ACLs — never cache auth decisions across requests.
7. **Conversations are uniform.** Rooms and DMs share the messages table, differ only by discriminator + moderation rules.

### Code

1. **TypeScript strict everywhere.** `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
2. **Shared types live in `packages/shared/`**, consumed by both api and web via `workspace:*`. No duplicated DTOs.
3. **Validate at boundaries.** Every HTTP input + every WS incoming event passes through a zod schema from `@agora/shared`.
4. **`const` over `let`. Arrow functions. `async`/`await` over `.then()`.** Functional helpers over imperative loops where it doesn't hurt readability.
5. **Default export React components; named export helpers.**
6. **Tests live next to sources.** `foo.ts` + `foo.spec.ts`. Integration/e2e live under `tests/e2e/` and `apps/*/tests/integration/`.
7. **Don't add error handling, fallbacks, or validation for scenarios that can't happen.** Trust internal code and framework guarantees. Only validate at external boundaries.
8. **No comments that narrate WHAT.** Good names do that job. Only comment non-obvious WHY — a hidden constraint, a workaround, a subtle invariant.

### Design

These come from `docs/design/`; the agent must respect them without prompting.

1. **Text first.** Message rows are `[HH:MM] nick: body`. No chat bubbles.
2. **Density honestly.** 3 px row padding, not 14. Power users re-read history.
3. **One accent, one hue.** Oxidized teal (`oklch(0.52 0.07 190)`) for all emphasis. Status has its own flat palette. Everything else is ink or paper.
4. **Hairlines > shadows.** 1 px rules do layout. Shadows only for floating surfaces (popovers, dialogs).
5. **Mono for truth.** IBM Plex Mono for timestamps, usernames, IDs, file sizes, counts. Proportional digits lie.
6. **Presence cues use shape + colour.** Square filled/half-diagonal/outlined for online/AFK/offline. Never colour alone.
7. **Tokens only.** Every colour and spacing value comes from `apps/web/src/styles/tokens.css`. Hex literals and magic pixels in component code are a bug.

### Git hygiene

1. **Conventional Commits.** Format: `type(scope): imperative message`. Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`. Scopes roughly match spec sections: `auth`, `sessions`, `presence`, `rooms`, `messages`, `attachments`, `ui`, `ws`, `infra`.
2. **Describe value, not files.** `feat(rooms): enforce owner can't leave own room` — not `feat: update roomService.ts`.
3. **British English.** Comments, commit messages, docs. No em dashes (—); use en dashes (–) if you must.
4. **No AI attribution.** No `Co-Authored-By`, no "Generated by Claude" trailers in commits or PRs.
5. **No force push to `main`.** `--force-with-lease` on feature branches only.
6. **Never skip hooks** (`--no-verify`) or bypass signing without explicit user permission.

## Tools and skills

### Skills to use proactively

- `superpowers:brainstorming` — before any new feature. Resolves ambiguity in requirements.
- `superpowers:writing-plans` — once requirements are clear, turn them into an executable plan.
- `superpowers:executing-plans` / `superpowers:subagent-driven-development` — during implementation.
- `superpowers:test-driven-development` — for logic-heavy features (auth, permission checks, presence, ban semantics).
- `superpowers:verification-before-completion` — BEFORE asserting anything is done. Run the actual checks.
- `superpowers:requesting-code-review` — before pushing.
- `superpowers:systematic-debugging` — when a test fails or something behaves unexpectedly.
- `superpowers:receiving-code-review` — when the user (or another reviewer) gives feedback.

### MCPs available and when to use them

- `playwright` — end-to-end browser automation. Use to verify UI flows after implementation.
- `chrome-devtools-mcp` — when diagnosing runtime issues in the running app (network, console).
- `context7` — for up-to-date Fastify / Drizzle / TanStack Query / React 19 docs. Your training data may predate current APIs; prefer this over guessing.
- `typescript-lsp` — real TS diagnostics for the agent. Use when the build is broken.
- `figma@claude-plugins-official` — fallback for design handoff if the Claude Design bundle needs extending.

### Commands (project slash commands)

Under `.claude/commands/`:

- `/feature <area>` — start a new feature flow (brainstorm → requirements gap-fill → plan → execute).
- `/plan <requirement-file>` — turn a requirements file into an executable plan under `docs/plans/`.
- `/spec refresh` — re-synthesise `docs/spec.md` from PDF + Q&A + any clarifications captured since.
- `/smoke` — run the full delivery-contract check: `docker compose up --build`, wait for health, run Playwright e2e smoke, tear down.

## What NOT to do without asking first

- Introduce a new runtime dependency beyond the stack listed in `AGENTS.md`. New deps must be justified in the feature's plan or an ADR.
- Change anything under `docs/design/` (it's a reference import, not a source).
- Change the delivery contract (`docker-compose.yml` top-level shape, required env vars).
- Touch ADRs marked Accepted — supersede, don't edit.
- Write code in a feature directory before writing the feature's requirement file and plan.
- Push to `origin/main` without running `/smoke` green.
- Invent design tokens, colours, spacing values, or fonts.
- Add fallback logic for "what if the database is down" / "what if the session doesn't exist" at internal boundaries — those are real bugs to surface, not paths to handle silently.
- Silence a failing test. Fix it or mark it explicitly skipped with a reason in a journal entry.

## Scope discipline

The brief is bigger than a day. Don't over-build.

- **MVP first pass** through §2 and §3 of `docs/spec.md`. Get the happy path demoable before any polish.
- **Jabber federation (ST-XMPP-*) only after §2 + §3 are green end-to-end.** See ADR-0005 for why it's a sidecar and how to stage it.
- **Say no to features not in the spec.** If a feature seems desirable (reactions, threads, search), surface it to the user as "out of scope unless prioritised" — don't silently implement.
- **Three similar lines is better than a premature abstraction.** Duplication that becomes a pattern can be extracted later; abstractions invented too early cost more.

## The delivery-contract reminder

~50% of past submissions fail this simple test. Don't be a statistic.

```sh
git clone https://github.com/Exiliot/agora.git
cd agora
docker compose up --build
# browser → http://localhost:8080 → see the app
```

Should produce a working demo on a fresh machine. Run this yourself after any non-trivial change. It is the single most important check in this project.
