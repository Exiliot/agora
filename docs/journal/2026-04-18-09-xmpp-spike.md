# 2026-04-18 · XMPP sidecar spike

Exploratory work on the `phase2-xmpp` branch. The goal was to answer one question: **how significant is the effort to add Jabber/XMPP federation to agora, and how much does it touch the existing database, architecture, and shipped code on `main`?**

Answer up front: **Zero changes to the database. Zero changes to any shipped feature on `main`. The sidecar lives entirely beside the main app, gated behind env flags.** ADR-0005's sidecar design held up — the concessions made during MVP (JID-safe usernames, stable bus interface) kept the path clean.

## What I built

A first-pass scaffold proving the architecture works, without implementing every flow:

### 1. Prosody sidecar (`tools/prosody/`)

- `Dockerfile` built on top of `prosody/prosody:0.12`.
- `prosody.cfg.lua` with:
  - one `VirtualHost "agora.test"` and a `muc` component at `rooms.agora.test`
  - `authentication = "http_async"` delegating to agora via the community `mod_auth_http_async`
  - `c2s` on 5222, `s2s` on 5269, HTTP admin on 5280
  - TLS disabled for localhost; documented as not production-ready.

### 2. Docker compose overlay (`docker-compose.xmpp.yml`)

- Adds the `prosody` service to the existing stack.
- Sets `ENABLE_XMPP_BRIDGE=1` on the api container so the XMPP routes mount.
- Run with: `docker compose -f docker-compose.yml -f docker-compose.xmpp.yml up --build`.

### 3. agora-side endpoints (`apps/api/src/xmpp/routes.ts`)

- `POST /internal/xmpp/auth` — Prosody posts `{username, password}`, we look up by username (lowercase), verify via `argon2` against the same `password_hash` column the web uses. Returns `{ok: true, userId}` or 401. Gated behind `ENABLE_XMPP_BRIDGE=1`.
- `GET /internal/xmpp/users/:username` — existence check for future s2s presence subscriptions.
- Nothing else mounts if the flag is off — zero production-surface impact.

### 4. Connectivity test (`tools/xmpp-connect-test.mjs`)

Node script using `@xmpp/client`. Connects to `xmpp://localhost:5222` as `alice@agora.test`, sends presence. Proves end-to-end that an agora account credential validates through Prosody.

```
node tools/xmpp-connect-test.mjs alice password123
[xmpp] online as alice@agora.test/<resource>
```

## What I did NOT build (and why)

- **Message bridging both ways.** Outbound (agora → Prosody) requires subscribing to the bus in-process, constructing XMPP stanzas, and publishing to MUC rooms keyed by agora room id. Inbound (Prosody → agora) needs a `mod_rest` hook or a custom Lua module that calls back into the api. Each is ~4–6 hours; together with testing, closer to a day.
- **Two-server federation.** Requires a second Prosody instance, DNS aliases inside the compose network (`server-a.agora.test`, `server-b.agora.test`), a committed test CA, two sets of TLS certs, and mutual-trust config on both sides. Plus the mirror bridge running on each side so messages cross the wire. Realistic: 1–2 days.
- **Load test with 50+ clients per side.** Depends on federation being solid. 3–4 hours on top of the above.
- **Admin UI for connections + federation stats.** Small once the data is there; pointless until it is.

## What it would take to finish

Roughly grouped by unit of effort:

| Item | Effort (focused) | Risk |
|---|---|---|
| Outbound bridge: in-process XMPP client publishing agora messages to MUC/DM | 4–6 h | low — `@xmpp/client` well-documented |
| Inbound bridge: Prosody `mod_rest` → agora webhook → DB + bus | 4–6 h | medium — custom Lua module likely |
| Per-user provisioning: auto-register agora users as Prosody JIDs on first XMPP connect | 2–3 h | low — HTTP auth already the hook |
| Two-server compose topology with shared test CA | 3–4 h | medium — TLS config is fiddly |
| Federation s2s wire-up + smoke test across servers | 3–4 h | medium |
| 50-client load test script + measurements | 2–3 h | low |
| Admin UI: connections + federation stats tab | 3–4 h | low |

**Total: ~3 working days of focused effort for full ST-XMPP-1 through ST-XMPP-4 coverage**, which matches what Denis estimated in the pre-event call.

## Impact assessment against the original question

- **Database**: zero migrations needed. The existing `users.username` column, already JID-safe, maps 1:1 to JID localparts. No new tables; Prosody keeps its own runtime state (rosters, MUC memberships) in its own storage.
- **Existing architecture**: zero changes to any `apps/api/src/{auth,rooms,messages,friends,attachments,presence}/` module on `main`. The bridge sits in `apps/api/src/xmpp/` and subscribes to the same bus every other feature subscribes to.
- **Decisions previously made**: every one held up under scrutiny. ADR-0001 (server-side sessions) doesn't conflict with XMPP because XMPP has its own SASL session layer — we don't need to map between them. ADR-0002 (in-process bus) is where the bridge hooks in; an s2s scale-out would push us to Redis eventually but not for the demo. ADR-0003 (in-memory presence) still works — XMPP presence is separate from our browser presence because the user may be online in one and not the other.
- **docker-compose shape**: the overlay approach (`docker-compose.xmpp.yml`) means main's delivery contract (`docker compose up`) is untouched. Reviewers test what we built on main; XMPP is opt-in via the overlay.

## Decision for the hackathon

Ship the main branch as the submission. Keep `phase2-xmpp` as the ready-to-grow scaffold. In the submission notes and the README, point at this journal entry as evidence of the plan being real and grounded — not just an aspiration.

## Takeaways

- **ADR-0005 predicted this outcome accurately.** The sidecar design held up; no MVP decisions needed reversing. That's the value of writing ADRs with consequences stated up front.
- **Feature flags are the right tool for optional large features.** Gating the XMPP routes behind `ENABLE_XMPP_BRIDGE=1` means the code ships on `main` invisibly when we merge, but nobody encounters it unless they opt in. A cleaner pattern than a long-lived feature branch.
- **Prosody's HTTP auth module is almost a one-line integration** once you accept that you're running a real XMPP server. The real work is the bridge in both directions — and that's where the bulk of the effort estimate goes.
