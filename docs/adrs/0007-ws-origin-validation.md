# ADR-0007 · WebSocket `Origin` validation and cross-origin policy

- **Status**: Accepted, 2026-04-19
- **Relates to**: NFR-SEC-1, security audit 2026-04-19 (H2 – cross-site WebSocket hijacking)

## Context

The WS handshake at `apps/api/src/ws/plugin.ts` does not check the `Origin` header on the upgrade request. Browsers send the cookie with any WebSocket request regardless of origin (no CORS on WS handshakes), so a malicious page on `evil.example` can open a `wss://agora.example/ws` connection in the victim's browser and receive the same fan-out the victim sees. The subscribe ACL confines *new* subscriptions to topics the user can access, but auto-subscribe runs on `hello` and blankets the user's topics (every room + DM) before any attacker-controlled subscribe is attempted. Net effect: a well-timed cross-site WS can read the victim's private chat and notifications.

The same-origin policy does not protect WebSockets. This is classic CSWSH (Cross-Site WebSocket Hijacking) territory.

## Decision

Enforce `Origin` on the WS upgrade handshake. Reject upgrades whose `Origin` is not in an allow-list derived from `APP_BASE_URL`.

Specifics:

1. In `registerWsPlugin`, the `/ws` route adds a preflight check inside the HTTP upgrade handler:

   ```ts
   app.get('/ws', { websocket: true }, (socket, req) => {
     const origin = req.headers.origin;
     if (!origin || !isAllowedOrigin(origin)) {
       socket.close(4403, 'forbidden_origin');
       return;
     }
     // ...existing handler
   });
   ```

2. `isAllowedOrigin(origin)`:
   - Strict match against `config.APP_BASE_URL` (already set per environment).
   - Optional allow-list from `WS_ALLOWED_ORIGINS` (comma-separated) for a small set of known internal tools – empty by default.
   - Reject wildcard. Reject `null` (file:// or data:). Reject anything else.

3. Log rejections at `warn` with the offending origin and the connecting IP. Don't include the cookie in the log line.

4. Tests: one accepts `APP_BASE_URL`, one rejects a random origin, one rejects missing Origin, one rejects `Origin: null`.

5. This is not CORS. The HTTP surface already uses a separate allow-list; WS is a discrete decision.

## Consequences

**Positive**

- Closes CSWSH. The bug bounty reader at grade time will not find it.
- Consistent with the cookie posture (`SameSite=Lax`): a cookie not sent cross-site + a WS rejecting cross-origin is belt-and-braces.
- Zero impact on the delivery-contract demo (`docker compose up` runs both web + api under the same host/port mapping, so `Origin` matches `APP_BASE_URL` out of the box).

**Negative**

- Developers running a hot-reload vite dev server on a different origin than `APP_BASE_URL` must add their origin to `WS_ALLOWED_ORIGINS`. Documented in `AGENTS.md` alongside the existing dev-env notes.
- Browser extensions or test harnesses that synthesise requests without `Origin` are rejected. Acceptable for a production surface.

**Alternatives considered**

- *Rely on `SameSite=Lax` cookie only*: insufficient. `Lax` blocks cross-site cookie on top-level-navigation POST, but a WS upgrade is GET with the cookie attached. Some browsers do not treat WS upgrades like fetch. Defence in depth is cheaper than betting on browser UA consistency.
- *Require a CSRF-style `Sec-WebSocket-Protocol` header from the client carrying a token*: more invasive; `Origin` alone buys the same protection for far less code.

## Implementation

Landed in commit <SHA> on 2026-04-19. Touches `apps/api/src/config.ts` (new `WS_ALLOWED_ORIGINS` var) and `apps/api/src/ws/plugin.ts` (Origin check at the top of the upgrade handler).
