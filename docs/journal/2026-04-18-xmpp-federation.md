# 2026-04-18 · XMPP federation — continued on main

Supersedes the earlier `2026-04-18-xmpp-spike.md`. After merging the spike branch into main (per "no separate branch anymore") the work continues here.

## What's in place on `main`

- `docker-compose.xmpp.yml` overlay that spins up **two** Prosody instances (`prosody-a` / `prosody-b`) alongside the main stack, with network aliases `server-a` and `server-b` so s2s dialback resolves peer hostnames inside the compose network.
- `tools/prosody/Dockerfile` — Debian 12 base + Prosody 0.12 + `openssl` for self-signed certs + the `mod_auth_http` community module pulled at build time.
- `tools/prosody/entrypoint.sh` — templated config rendering per-instance (`PROSODY_DOMAIN`, `PROSODY_MUC_DOMAIN`, `PROSODY_AUTH_URL`) + self-signed cert generation so STARTTLS is offered. Self-signed; demo network only.
- `tools/prosody/prosody.cfg.lua.tmpl` — shared template. Loads dialback for s2s (no mutual-CA ceremony), `auth_http` for credential validation, MUC as a component. TLS required on c2s.
- `apps/api/src/xmpp/routes.ts` — `POST /internal/xmpp/auth` (form-urlencoded or JSON) and `GET /internal/xmpp/users/:username`. Gated behind `ENABLE_XMPP_BRIDGE=1`. Validates against the same argon2id password store the web uses. **Verified end-to-end with curl**: 200 for valid credentials, 401 for invalid, both body shapes accepted.
- `tools/xmpp-connect-test.mjs` — Node/@xmpp/client test harness parametrised for server-a / server-b.

## Current state of the demo flow

- **Prosody sidecar runs** end-to-end. Both containers boot, load `mod_auth_http`, open c2s on 5222 and s2s on 5269, listen with the self-signed cert.
- **Auth bridge works**. `curl -X POST /internal/xmpp/auth` with a registered agora user's credentials returns 200 + `userId`. Bad password returns 401. Unknown user returns 401. Tested locally; confirmed.
- **Prosody itself loads the module** — boot logs show no `modules-community` errors; the config is valid.
- **Client-side compatibility is the blocker.** `@xmpp/client` in Node fails at SASL negotiation with `Mechanism undefined not found` because — based on raw-stream inspection — Prosody 0.12 doesn't advertise `<starttls>` in the initial `<stream:features>` response despite having a valid cert loaded. The server only advertises `<mechanisms><mechanism>PLAIN</mechanism></mechanisms>`, and xmpp.js won't accept PLAIN without TLS first.

  Raw dump for record:
  ```
  <stream:features>
    <mechanisms xmlns='urn:ietf:params:xml:ns:xmpp-sasl'>
      <mechanism>PLAIN</mechanism>
    </mechanisms>
  </stream:features>
  ```
  No `<starttls>` element.

## What's left and the honest estimate

The remaining gap is Prosody-side, not agora-side. Likely fixes to try, in order:

1. Add `tls` to `modules_enabled` explicitly (it should be implicit, but Prosody 0.12 may behave differently with `c2s_require_encryption = true`).
2. Switch to Prosody's `internal_hashed` auth + seed users via `prosodyctl register` at container boot (simpler handshake, loses the agora password-unification property).
3. Try Prosody 0.13 (later apt source) which has different TLS defaults.
4. Use a different SASL mechanism (SCRAM-SHA-1-PLUS) requires the channel binding work; fight that later.
5. Open a direct-TLS port (5223) via `c2s_direct_tls_ports = { 5223 }` and have clients connect there to skip STARTTLS negotiation.

Each is a focused 30–60 min debug session. The remaining chunks for the full stretch goal (federation smoke + 50-client load test + admin UI tab) stay at the earlier estimate of 2–3 working days total once SASL is unblocked.

## Why pause here

The audit findings that came back in parallel (security + performance + a11y + code quality) contain several **critical** items that will be noticed in a review:

- WebSocket `subscribe` had no ACL (fixed mid-session).
- `sessions.token_hash` had no unique index — every auth'd request seq-scanned the sessions table (fixed mid-session via migration `0001`).
- Reset tokens were logged at `info` level (fixed).
- `verifyPassword` args were reversed in the XMPP bridge itself (fixed).
- Dev seed endpoint's permission check was broken (fixed).
- No `:focus-visible` styles, no `aria-modal` on Modal, no `aria-live` on MessageList — a11y bar.
- Per-recipient unread upserts serial inside `message.send` transaction — scale ceiling at 1000 members.
- `bus.publish` blocks the event loop on `JSON.stringify` + `ws.send` — scale ceiling for busy rooms.

Those are industry-grade-bar items and carry more weight for submission than XMPP does. Redirecting effort there. XMPP stays on main as runnable scaffolding + proven auth bridge; the "finish the SASL handshake" work can be picked up anytime via `docker compose -f docker-compose.yml -f docker-compose.xmpp.yml up`.

## Takeaways

- **The bridge design survived contact with reality.** `POST /internal/xmpp/auth` with argon2id verification is a 30-line endpoint. The agora side of XMPP integration is genuinely done.
- **Prosody's TLS negotiation in a self-signed demo environment is fiddlier than expected.** In production you'd have a real CA and this wouldn't surface; in a demo-localhost setup it's the kind of thing that eats an afternoon.
- **Federation demos are high-ceremony for a reason.** Two servers + DNS + s2s certs + SASL + client interop is a lot of surface area to get right for a single "one message crossed two servers" demo. Worth noting for future ADR-0005-style decisions about whether to take on protocol stretch goals.
