# ADR-0010 · Password-reset link logging in demo mode

- **Status**: Accepted, 2026-04-19
- **Relates to**: FR-AUTH-9 (password reset), security audit 2026-04-19 (H1)

## Context

agora's password-reset flow generates a single-use token with a 30-minute TTL. The standard user experience is: the user enters their email, the server emails them the reset link, the user clicks it, sets a new password, signs in.

agora ships as a hackathon demo with no mail service. The reset link therefore has no other way to reach the operator than the server log. At `apps/api/src/auth/routes.ts:200-204` the link is emitted via `req.log.info({auth: 'reset_link_issued'}, link)` and also `console.error('[AUTH reset link]', link)` so the operator can run `docker compose logs api | grep "AUTH reset link"` to recover it.

The security audit (2026-04-19, H1) correctly flags this: any log reader can complete account takeover within 30 minutes.

There is a journal entry (`docs/journal/2026-04-18-21-forgot-password.md`) that explains why: an earlier version of this code used a `NODE_ENV !== 'production'` guard around the log line. Docker sets `NODE_ENV=production`. The guard meant the link never printed in any deployment anyone actually ran. The guard was removed on purpose.

This decision lives only in a journal. Any future reviewer will call it a bug. An ADR fixes that.

## Decision

Adopt a **`AGORA_DEMO_MODE=1` opt-in** for the reset-link log:

1. Add `AGORA_DEMO_MODE` (`'1'` / unset) to the config module. Default: unset.
2. The reset-link log line runs only when `config.AGORA_DEMO_MODE === '1'`. Both the pino `info` and the `console.error` go through the same guard.
3. Docker Compose's demo `docker-compose.yml` sets `AGORA_DEMO_MODE=1` in the api service env. Production deployments do not. CI sets it where the smoke test needs it (grep the log to complete the flow), otherwise not.
4. When `AGORA_DEMO_MODE` is off, the reset-request handler returns `204` as today but does not log the link. The token still works – the operator is expected to have wired a real mailer. `apps/api/src/auth/mailer.ts` (new file, stubbed) owns the send; default implementation is a no-op + a `warn` log if `AGORA_DEMO_MODE` is also off. That stubbed seam is where a real mailer lands later.
5. Document the flag in `AGENTS.md` and the delivery-contract section of `CLAUDE.md`.

## Consequences

**Positive**

- The security audit's H1 no longer has teeth in any deployment the jury would review as "production" – the log line is gated on an explicit demo flag.
- The hackathon demo keeps working: `docker compose up` with `AGORA_DEMO_MODE=1` set in the compose file prints the link, the operator greps it, the flow completes.
- The decision is now pinned: a future "I noticed a security issue where the reset token is logged" PR can be closed with "see ADR-0010" instead of re-litigating.

**Negative**

- A new config flag. Small surface.
- A deployer who forgets to set `AGORA_DEMO_MODE=1` and also forgets to wire the mailer will have a non-functional reset flow. This fails obviously (the user gets a success Toast but nothing in their inbox) – acceptable.

**Alternatives considered**

- *Keep it unconditional*: rejected – security reviewer confusion is not free, and the decision not being documented in an ADR means every new reviewer repeats the same confusion.
- *Gate on `NODE_ENV !== 'production'`*: this is what the original code did. It doesn't work under Docker. Reject the same way we rejected it in April 18's journal.
- *Ship a real mailer in the hackathon*: out of scope. Hackathon delivery contract is `docker compose up`; no external service.

## Follow-up

When this is accepted, the code change is six lines in `auth/routes.ts` plus the new stubbed `mailer.ts` plus the Docker Compose env var plus the journal annotation. Trivial.

## Implementation

Landed in commit b69550e on 2026-04-19. Touches `apps/api/src/config.ts` (new `AGORA_DEMO_MODE` var), `apps/api/src/auth/routes.ts` (gate the reset-link log on the flag), `apps/api/src/auth/mailer.ts` (new seam), and `docker-compose.yml` (sets `AGORA_DEMO_MODE=1` for the demo).
