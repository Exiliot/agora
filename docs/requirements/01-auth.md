# Auth and accounts

## Scope

FR-AUTH-1 to FR-AUTH-13.

## Definition of done

A user can register, sign in, sign out of a single browser, reset a forgotten password via a mocked reset link, change their password while signed in, and delete their own account. All credential material is stored only as an Argon2id hash. Usernames are globally unique, immutable, and match the JID localpart rules so Phase 2 XMPP federation can adopt them without rewriting identities.

## Acceptance criteria

- **Register with valid inputs** — Given unused email and unique username, a POST `/api/auth/register` with email, username, password returns 201 + a session cookie. A follow-up `/api/auth/me` returns the current user.
- **Reject duplicate email** — Registering with an already-used email returns 409 with a machine-readable error code.
- **Reject duplicate username** — Registering with an already-used username returns 409 with a distinct error code.
- **Username immutable** — There is no API path to change a username. A `PATCH /api/users/me` rejects a `username` field with 400.
- **Username format** — Allowed: `[a-z0-9._-]{3,32}`, must start with a letter, no trailing dots. Aligns with XMPP JID localpart rules (ADR-0005).
- **Email format** — Basic RFC-5322 parse via a library (`zod.string().email()`), no domain lookup.
- **Password strength** — Minimum 8 characters. No maximum. No forced complexity classes. Rejected under 8 with 400.
- **Password hashing** — Stored as `argon2id` with parameters `m=65536, t=3, p=4` (baseline OWASP recommendation for 2026). Hash string verified on sign-in.
- **Sign in** — Correct email + password → 200 + session cookie. Wrong password → 401 with generic "invalid credentials" (do not disclose which field was wrong).
- **Sign out** — `POST /api/auth/sign-out` deletes the current session row and clears the cookie. Other sessions for the same user remain unaffected (see FR-AUTH-7).
- **Password reset (mocked)** — `POST /api/auth/password-reset/request` with email: if email exists, generate a single-use token, persist it with a 30-minute expiry, log the full reset URL to stdout (`[AUTH] reset link: http://localhost:8080/reset?token=...`). Response is always 204 regardless of email existence (do not enumerate).
- **Password reset consume** — `POST /api/auth/password-reset/consume` with token + new password: rotates the password, invalidates **all** sessions for that user, consumes the token.
- **Password change while signed in** — `POST /api/auth/password-change` with current password + new password: rotates the password, invalidates all sessions *except the current one* (user stays signed in here but is logged out elsewhere).
- **Account deletion** — `DELETE /api/users/me`: cascades per FR-AUTH-13. Rooms owned by the user are deleted (and their files/messages). Membership in other rooms is removed. Messages authored in other rooms remain but are attributed to a deleted-user sentinel (`null` author with a preserved display name, or a reserved `deleted-user-<n>` name — pick one in the data-model doc).
- **Deletion is final** — No undelete. Username and email are not automatically released for re-registration in the MVP (prevents impersonation attacks); if we choose to release, it's a separate decision.

## Out of scope

- Real SMTP / email delivery (FR-AUTH-9 explicit mock).
- Email verification (FR-AUTH-5 excludes).
- OAuth / social login.
- 2FA / TOTP.
- Account recovery via anything other than the email reset link.
- Forced periodic password rotation (FR-AUTH-11 excludes).

## Implementation hints

- Use `@fastify/session` with a Drizzle-backed session store. Sessions are keyed by a 32-byte opaque random ID; the cookie carries only that ID.
- Cookie attributes: `httpOnly=true`, `sameSite='lax'`, `secure=true` when behind HTTPS in production (development uses `secure=false` inside docker-compose on localhost).
- Don't use `bcrypt` — argon2id is the 2026 default. `argon2` npm package is the stable binding.
- Reset token is 32 bytes of `crypto.randomBytes` base64url-encoded, hashed before storage (only the hash lives in DB).
- Rate-limit sign-in attempts per IP + email (`@fastify/rate-limit`) to 10 per minute; acceptable trade-off to prevent brute force in a demo.
- When the user deletes their account, run everything inside a single transaction: delete owned rooms (cascading messages/attachments by FK), nullify author on other messages, remove memberships, then delete the user row. Fail the whole transaction if any step fails.

## Open questions

- [ ] Do we reserve deleted usernames forever or allow re-registration after N days? Defaulting to "reserved forever in MVP" unless challenged.
- [ ] Should the reset link URL point to the frontend or backend origin? Default: frontend (`http://localhost:8080/reset`) because that's where the form lives; backend validates the token on submit.
