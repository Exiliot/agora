# ADR-0001 · Server-side sessions, not JWT

- **Status**: Accepted, 2026-04-18
- **Relates to**: FR-AUTH-7, FR-SESS-1..5, FR-FRND-6, FR-ROOM-13, AC-SESSIONS-1

## Context

The spec requires:

1. **Active-sessions view + individual logout** (FR-SESS-2, FR-SESS-3) — a user must be able to see every signed-in browser and kill any of them immediately.
2. **User-to-user bans take effect now** (FR-FRND-6) — a banned user cannot send another message. Not on next token refresh.
3. **Room bans take effect now** (FR-ROOM-13).
4. **Persistent login across browser restart** (FR-AUTH-8) without forced re-auth.
5. **No auto-logout due to inactivity** (NFR-SESS-3), but (pragmatically) sliding expiry after long idleness.

JWT was the alternative considered. It is explicitly discouraged by Denis on the kickoff call, with rationale that matches our analysis below.

## Decision

Use server-side sessions stored in Postgres, identified by an opaque random token in an `HttpOnly; Secure; SameSite=Lax` cookie.

- A `sessions` table holds one row per signed-in browser: `id`, `user_id`, `token_hash` (SHA-256 of the cookie value), `user_agent`, `ip`, `created_at`, `last_seen_at`, `expires_at`.
- The cookie carries only the random token. The DB stores only the hash.
- Sliding expiry: 14 days from `last_seen_at`. Hard expiry on logout-all events (password change, password reset).
- Sessions middleware resolves the row on every authenticated request; the ban/access checks happen against *live DB state*, so revocation is always immediate.

## Consequences

**Positive**:

- Per-session revocation is a single `DELETE` — trivially correct and instant.
- Password change / reset can invalidate all sessions (optionally keeping the current one) with a single `DELETE ... WHERE user_id=? AND id<>?`.
- Role/membership changes (room bans, user bans) are checked against the DB on every request, so there's no propagation lag.
- Simple mental model: the session row is the truth.

**Negative**:

- Every authenticated request does a DB lookup for the session. Mitigation: trivial to cache in-process with a short TTL (5 s) if it shows up in a profile, but not needed at MVP scale.
- Cookie-based auth constrains CORS design (we're serving web + api from the same compose stack, so this is fine).

**Escape hatch**:

- If we ever horizontally scale to multiple `api` instances, the sessions table remains the shared source of truth. No redesign needed; we just share the DB.
