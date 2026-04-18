# 2026-04-18 · Spec + production-posture sweep

Follow-on to `2026-04-18-16-design-audit.md`. After the Claude Design audit closed the visual/DS findings, I ran the project back through a **full spec + production-grade + high-load** review (dispatched to a code-reviewer subagent with the brief "what's still missing for a fresh-clone reviewer on a real-world product bar?"). The answer was longer than I expected: seven MUST-FIX, twelve SHOULD-FIX, seven NICE-TO-HAVE. All MUST-FIX and SHOULD-FIX plus the material NICE-TO-HAVE items shipped in this pass.

## Findings by class

### Hot-path scale (what breaks at NFR-CAP-1 / NFR-CAP-2)

- **DB pool `max: 10`** against 300 concurrent users firing ~5 queries on first-load each. Exhaustion directly violates NFR-PERF-1 (<3 s delivery). Raised to 30 via new `PG_POOL_MAX` env var, added `statement_timeout: 10_000` and `idleTimeoutMillis: 30_000` so one stuck query can't tie up the pool indefinitely.
- **`touchSession` fires per authed request**, no throttle. At NFR-CAP-1 that's ~1500 WAL-emitting UPDATEs per second on a single table, competing with the same pool as message history reads. Threw in an in-memory `Map<sessionId, lastTouched>` + a `SESSION_TOUCH_MIN_INTERVAL_MS` (default 60 s) so each session slides its expiry at most once a minute. The error path now warns instead of silently discarding.
- **`bus.publish` iterates all handlers synchronously**. For a 1000-member room (NFR-CAP-2) that's 1000 `ws.send` callbacks before any other I/O gets a chance. Now yields to `setImmediate` every 100 handlers, keeping the event loop responsive.
- **Presence sweeper did `await broadcast(...)` sequentially** per transitioning user. Combined with two DB queries per user (`listPresenceSubscribers`), it routinely blew past the 2 s sweep interval under normal churn. Rewrote to: (a) compute all transitions first (in-memory, cheap), then (b) `Promise.all` broadcasts. Added a 10 s TTL cache on `listPresenceSubscribers` + an `invalidatePresenceSubscribers(...)` hook for friend/room mutations to call.
- **WS payload had no `maxPayload` cap**. A multi-megabyte JSON blob would block the event loop on parse. Set `maxPayload: 64 * 1024` (well above the 3 KB message body budget).
- **auto-subscribe fired two DB queries on every `hello`**. On a flaky network with 300 users reconnecting simultaneously that's a lot of needless churn. Skip the queries if `conn.subscriptions.size > 0` — re-subscribe is a no-op at the lifecycle level.

### Query correctness

- **Conversation-list preview used `DISTINCT ON` over unbounded history**. For a user in 20 rooms with 100 k combined messages this is a large sort on every page load. Rewrote to `LEFT JOIN LATERAL` per conversation with `ORDER BY id DESC LIMIT 1` — an index-range seek instead of a sort.
- **DM preview leaked the last-message body when a user-ban existed** (NH-1). Per-spec history is read-only on ban; the sidebar preview is an extra surface we don't need. Now blanked when a `user_bans` row is in place either direction.
- **Rooms catalogue** used two correlated `COUNT(*)` subqueries — one in `SELECT`, one in `ORDER BY`. Initially rewrote as LATERAL, but the raw-SQL version stumbled on drizzle's table-alias resolution (`and(...)` still referenced `rooms.*` while I aliased to `r.*`) — 42P01 undefined table. Reverted to drizzle builder with a single shared `sql` fragment reused in both clauses; Postgres query planner inlines the two identical correlated subqueries into the same evaluation. Net: less dramatic speedup than LATERAL but one expression, no broken SQL.

### Validation / hardening

- **POST `/api/rooms/:id/admins`** had `req.body as { userId?: unknown }` with no zod schema. Now `z.object({ userId: z.string().uuid() })` — 400 on bad input instead of 500 from the DB layer.
- **Remove-member `reason`** was unbounded `text`. Capped at 280 chars via zod.
- **`password-change`** had no rate limit. Any attacker with a hijacked session could brute-force the current password. Now covered by `authRateLimit` (5/min per IP).
- **`/api/users/search`** would happily accept `q=a` and do a full prefix scan. Now requires `q.length >= 2` and carries its own 30/min rate-limit config.
- **FR-MSG-3** says "3 KB per message, UTF-8". The schema had `.max(3072)` characters — fine for ASCII but multi-byte emoji could blow past 3 KB. Added a `.refine` that checks the real UTF-8 byte length via `TextEncoder.encode(s).byteLength`.
- **Content-Disposition filename encoding** (NH-3) was ad-hoc — no RFC 5987 variant, so Cyrillic filenames (the app's stated user-base language) could reach the browser mangled via any intermediate proxy. Now emits both `filename="ascii-fallback"` and `filename*=UTF-8''%xx%xx%xx`.

### Delivery contract (DR-2/DR-3 compliance)

- **Password-reset link was hardcoded to `http://localhost:8080/reset`**. If a reviewer ran the stack on any non-localhost machine the reset flow couldn't complete. Now sourced from a new `APP_BASE_URL` env var (defaulted in `docker-compose.yml` so `docker compose up` still works out-of-the-box on localhost; settable by anyone deploying elsewhere).
- **`ALLOW_DEV_SEED=1` shipped in the committed compose file**. The dev-routes include an unauthenticated `POST /api/dev/bulk-register` for load tests — guarded by that flag. Anyone running `docker compose up` was exposing it to the local network. Removed from `docker-compose.yml`; the e2e suite (large-history) and XMPP load test now use a new `docker-compose.ci.yml` overlay applied via `pnpm smoke`.

### WS client robustness

- **Reconnect had no jitter** — after a server restart, every client retries in lockstep. Added `0.5 + Math.random()` jitter on `backoffMs`.
- **`setTimeout` for reconnect wasn't cancelled on `close()`**. If a component unmounted (user signs out) while a reconnect was queued, the socket would come back up for a user who had signed out. Now stored as `reconnectTimer`, cleared in `close()`, and guarded by `intentionallyClosed`.
- **No server-side WS ping/pong**. nginx holds idle WS connections for `proxy_read_timeout 3600s` by default; a phone that loses network silently would remain "connected" from the server's perspective for up to an hour. Added a 30 s app-level ping + `alive` flag + `socket.terminate()` on missed pong, so dead connections drop within ~60 s.

### Test helpers (NH-6, partially)

Left `__resetPresenceForTests` and `__stopSweeperForTests` as-is — they're clearly-namespaced exports, shipping them to production adds no real risk, and gating on `NODE_ENV==='test'` would require reshuffling the e2e test harness. Noted as carried debt.

### Bus structured logging (NH-7)

Left `console.error` in `bus.ts`. The bus doesn't hold a logger reference (it's constructed at module load before Fastify); threading one through means changing the construction pattern. The bus only logs on handler-throw, which is already noisy. Reasonable to defer.

## What `pnpm smoke` looks like now

```sh
pnpm smoke
# → docker compose -f docker-compose.yml -f docker-compose.ci.yml up --build -d
# → node health probe wait
# → npx playwright test (7 tests)
# → docker compose … down
```

Plain `docker compose up --build` still gives a working demo without the dev-seed surface exposed.

## Verification

- `pnpm typecheck` across three workspaces — clean.
- `pnpm --filter @agora/api test` — 61/61.
- `npx playwright test` with CI overlay — 7/7.
- `pnpm lint:tokens` — clean.
- Manual probe: `curl /api/rooms?visibility=public` after the rewrite works end-to-end (seeded data returns with correct `memberCount` sort order).

## Takeaways

- **"It works for the demo" and "it scales to the spec" are separate bars.** My NFR-CAP-1 target of 300 concurrent users was in the spec from day one, but several hot-path bottlenecks (pool max, touchSession, bus fan-out) were only caught by a production-lens pass. A source audit alone won't find them; one needs to multiply query counts by realistic concurrency in your head.
- **Drizzle's raw `sql` template is great for LATERAL joins but easy to get wrong with aliased columns.** When you mix a raw-SQL `SELECT` with drizzle's `and(...)` in the `WHERE`, the `and` clause still references the original table name, not your alias. If I were going to do more LATERAL rewrites I'd either go all-raw or all-builder, not both.
- **CI overlays beat compile-time feature flags for "demo safe / test permissive" splits.** `ALLOW_DEV_SEED=1` in the committed compose was the wrong default for a submission artefact. Putting it in `docker-compose.ci.yml` and pointing `pnpm smoke` at the overlay gives us test coverage without exposing the bulk-register endpoint by default.
- **Several of these findings were already noted in wave-1/2/3 and carried forward.** The lint guard caught some; others (WS maxPayload, touchSession log, graceful shutdown error path) were explicitly punted with "fine for hackathon" and came back to bite on the production-lens pass. Lesson: "fine for hackathon" is a half-hour decision to revisit explicitly, not indefinitely.
- **The code-reviewer subagent with access to spec + audit history + codebase is a genuinely useful extra lens.** The findings it caught are the same class of thing another engineer would catch in a first serious review — "the pool is what size?", "the bus does what synchronously?" — questions I was too close to the code to ask.
