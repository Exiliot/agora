# Sessions and presence

## Scope

FR-SESS-1 to FR-SESS-5, FR-PRES-1 to FR-PRES-6, NFR-SESS-1 to NFR-SESS-3, NFR-PERF-2, AC-SESSIONS-1, AC-PRESENCE-1.

## Definition of done

Users can see every active session (current browser highlighted) with browser, IP, and last-seen, and can log out each session individually. Presence transitions between `online` / `afk` / `offline` correctly reflect aggregated activity across all of that user's open browser tabs, with transitions propagating to other users within 2 seconds (NFR-PERF-2).

## Acceptance criteria — sessions

- **Session on sign-in** — Every successful sign-in inserts a `session` row with: id (opaque token, hashed at rest), user_id, user_agent, ip, created_at, last_seen_at, expires_at.
- **Session cookie** — Cookie is `HttpOnly`, `SameSite=Lax`, has a 14-day max-age, carries the session id.
- **Keep-alive** — Every authenticated HTTP request or WS heartbeat advances `last_seen_at`.
- **Absolute expiry** — Sessions past `expires_at` are rejected even if the cookie is intact. Expiry is 14 days from `last_seen_at` (sliding window).
- **Active sessions list** — `GET /api/sessions` returns the caller's sessions, each annotated with `is_current: boolean` for the session making the request.
- **Revoke one** — `DELETE /api/sessions/:id` removes that session row. If it's the current session, response clears the cookie; if it's another session, the cookie stays.
- **Logout-all on password change** — See requirements file 01; password change/reset invalidates sessions per FR-AUTH rules.
- **User-agent parse** — Display a humane browser label (e.g. `Safari 17 · macOS`) derived from `user-agent`. Use a small parser (`ua-parser-js`).

## Acceptance criteria — presence

- **Heartbeat protocol** — Each tab opens a WS connection and sends a `heartbeat` message whenever user activity is detected (keypress, mouse move, visibility change to visible). The server records a `last_activity_at` per tab.
- **Tab registry** — Server keeps an in-memory `Map<userId, Map<tabId, lastActivityAt>>`. No DB writes for presence.
- **Presence computation** — Every N seconds (N=2 is safe for NFR-PERF-2), a sweeper walks the registry:
  - A tab with `now - lastActivityAt > 60s` is marked idle.
  - If *any* tab is non-idle → user is `online`.
  - If every tab is idle → user is `afk`.
  - If no tabs remain → user is `offline`.
- **Transition broadcast** — On any computed state change, broadcast a `presence_update` event (userId, newState) to everyone subscribed to that user's presence: friends, and rooms the user is a member of.
- **Subscription model** — A client subscribes implicitly to presence of:
  - all of their friends;
  - all members of any room they have currently open.
- **Multi-tab consistency** — Opening a second tab does not change presence if the user was already online. Closing the last tab eventually moves the user to offline once all tabs are gone (WS close).
- **Reconnect tolerance** — If a tab's WS drops and reconnects within 30 seconds, presence should not flicker. Tab IDs are client-generated GUIDs (stored in `sessionStorage`) so reconnects re-register the same tab.
- **Presence latency** — An `afk → online` transition broadcast to other users completes within 2 seconds (NFR-PERF-2). Measured end-to-end in e2e tests with two simulated clients.

## Out of scope

- Typing indicators (deferred; not in MVP spec).
- Last-seen timestamps shown to other users (we only expose the computed presence state, not a wall clock).
- Cross-device presence aggregation beyond tabs (e.g. mobile + desktop) — it's implicitly covered by treating every WS connection as a "tab".
- IP geolocation enrichment for the sessions view.

## Implementation hints

- Don't write presence to the DB. AC-PRESENCE-1 is a hard constraint; the sessions table is about *authentication* sessions, not presence.
- The `presence_update` event SHOULD include only the transitioning user's id + new state, not a bulk roster dump — clients maintain their own merged view.
- When a user opens a room they're a member of, the client subscribes to presence for every member of that room (up to 1000). Server should return the current presence snapshot for all room members along with the room payload to avoid N flickering joins.
- Keep the sweeper interval and the AFK threshold as env-configurable so tests can tighten them (e.g. 200ms sweep, 1s AFK) without changing code.
- For `last_seen_at` updates: batch them in memory and flush to DB every few seconds to avoid a DB write per request.

## Open questions

- [ ] Do we broadcast the IP address of a new session to the user proactively (email-style "new sign-in from X")? Defaulting to **no** (mocked email, noise on one-user demo).
- [ ] Should sessions store the exact last URL visited? Defaulting to **no**; we store `last_seen_at` only.
