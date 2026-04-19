# 2026-04-19 · Four parallel specialist audits

Ran four independent audits against the current `main` in parallel, each by a read-only specialist subagent, each writing a dated report under `docs/audits/`. The shape of the pass is deliberate: after two waves of design polish landed, the next question is not "what else looks off" but "does this thing actually work, and how does it fail". Four angles:

- **Product integrity and user-flow correctness** – every documented flow traced end-to-end.
- **Security and privacy** – authN/Z, input validation, rate limiting, data exposure, transport posture.
- **Performance, high-load, data integrity** – DB indexes, N+1, bus scalability, WS hot path, client frame budget.
- **Accessibility (round 2)** – WCAG 2.1 AA, keyboard, screen reader, contrast.

## Scoreboard

| Audit | Critical | High | Medium | Low | Info | Report |
|---|---|---|---|---|---|---|
| Product integrity | 2 | 5 | 8 | 7 | – | [product-integrity.md](../audits/product-integrity.md) |
| Security and privacy | 0 | 3 | 8 | 10 | 4 | [security.md](../audits/security.md) |
| Performance and data integrity | 0 | 5 | 11 | 7 | 2 | [performance.md](../audits/performance.md) |
| Accessibility round 2 | 0 | 4 | 9 | 6 | 3 | [accessibility.md](../audits/accessibility.md) |
| Totals | **2** | **17** | **36** | **30** | **9** | |

## What the audits agreed on (cross-cutting themes)

Several themes surface in more than one audit. These are the ones worth turning into architectural pins rather than one-off fixes.

1. **`mark.read` never fires from the client.** Product flagged this as critical: the client has an unread-counter UI but the server-side `mark.read` WS event is never sent, so the sidebar and bell counters never clear on open. FR-NOTIF-2 is broken end-to-end. Accessibility noted the knock-on: screen-reader users hear a badge that never updates. Performance noted that the server's bulk unread upsert is correct but gets no traffic because the client doesn't call it.

2. **Client drops nine server-published WS events on the floor.** `friendship.removed`, `user_ban.created/removed`, `friend.request_cancelled`, `room.admin_added/removed`, `room.member_left/removed`, `room.deleted` – the server publishes them, the client never subscribes. Moderation and friendship changes don't propagate live until a hard reload. Product audit called this critical. This is a structural gap, not a one-line fix, and deserves a contract (ADR-0009 below).

3. **`message.send` has no idempotency.** Performance flagged: a WS retry under flaky network produces two DB rows. Product audit noted adjacent user-visible weirdness (the row appears twice in the log once any reconnect backfill catches up). One `reqId`-keyed dedupe table fixes both (ADR-0006).

4. **Popovers and modals have an inconsistent a11y contract.** Accessibility flagged `Modal` hard-codes `<h2>` (breaking heading outline on auth pages that have no `<h1>`) and `NotificationMenu` declares `role="dialog"` but does not trap focus, restore focus, or announce as modal. Product audit noted the same menu does not reposition or close on resize/scroll in every browser. One shared contract across Modal and NotificationMenu (ADR-0008).

5. **WebSocket upgrade does not validate `Origin`.** Security high: cross-site WebSocket hijacking is possible. The subscribe ACL confines *new* subscriptions, but auto-subscribed topics (every room/DM the victim is in) still fan messages out to the attacker's page on `hello`. Fix: enforce `Origin` on the HTTP upgrade handshake (ADR-0007).

6. **Password-reset link is logged unconditionally to stdout.** Security high. This is a decision already made and documented (see `docs/journal/2026-04-18-21-forgot-password.md` – the `NODE_ENV !== 'production'` guard was *removed* on purpose because docker runs production mode and the operator needs the link for the demo). But the decision lives in a journal, not an ADR; any future reader will call this a bug and "fix" it. Pin the decision and gate it on `AGORA_DEMO_MODE=1` (ADR-0010).

7. **Notifications feed is N+1.** Performance flagged: `Promise.all(rows.map(r => hydrateNotification(r.id)))` runs one SELECT per row. At 30-row pages this is invisible on localhost; at 100 it starts to bite. Collapse into a single join. Low-complexity win.

## What the audits called "already solid"

Across all four reports, common ground on what not to worry about:

- Token hygiene: SHA-256 hash at rest, single-use, TTL, timing-safe comparison on reset tokens.
- Argon2id password hashing with the library's production defaults.
- Server-side sessions via opaque token, DB-backed, individually revocable (ADR-0001 held up).
- TypeScript strict everywhere; shared zod schemas used at every HTTP and WS boundary.
- Tokenised design system: one accent, hairlines, no emoji, consistent density.
- Presence kept in-memory per ADR-0003; fan-out is bounded by room size.
- In-process bus fan-out (ADR-0002) scales fine at hackathon scale; per-topic subscriber Set is the right data structure.
- The round-3 DS work (new `IconButton`, `Textarea`, `EmptyState`, `Spinner`, `RoomName`, `LockIcon` primitives) has genuinely reduced the drift the earlier audits complained about.

## Capacity, credibility, numbers

Performance audit estimate: **~250-300 concurrent active users** on the current single-node docker compose deployment. First bottleneck is WS write-buffer bloat on one slow consumer (ADR candidate `Backpressure policy`), not CPU, not DB. For the hackathon jury this is comfortably over-spec – the grading load is "does the core flow work on two laptops" – but it's the kind of number that lets us answer "so, could you deploy this" without hand-waving.

Accessibility verdict: **not WCAG 2.1 AA yet, but close**. Three high-severity items are the blockers (Modal heading, NotificationMenu focus contract, mention contrast). A subsequent half-day of work clears the medium cluster (radio-group fieldset, form-error association, `prefers-reduced-motion` gate). Architecturally the primitives are all in place; this is wiring not redesign.

## ADRs proposed (not yet accepted)

Five new ADRs drafted as `Status: Proposed`. Each picks a cross-cutting theme that multiple audits touched and pins the decision so the next round of changes can't accidentally drift.

- [ADR-0006: `message.send` idempotency via client-supplied reqId](../adrs/0006-message-send-idempotency.md) – resolves performance H1, covers the "sent twice after a reconnect" user-visible bug.
- [ADR-0007: WebSocket `Origin` validation and cross-origin policy](../adrs/0007-ws-origin-validation.md) – resolves security H2, closes cross-site WS hijacking.
- [ADR-0008: Modal and popover heading + focus contract](../adrs/0008-modal-popover-contract.md) – resolves accessibility H1 and H2 with a single cross-cutting pin.
- [ADR-0009: Client WS event-handler coverage contract](../adrs/0009-ws-event-handler-coverage.md) – resolves product critical (9 dropped events), provides a lint-style test that a server-published event type has a client handler.
- [ADR-0010: Password-reset link logging in demo mode](../adrs/0010-demo-mode-reset-link-logging.md) – pins the deliberate-but-undocumented decision, gates it behind an opt-in env var so the next session doesn't "fix" it accidentally.

All five carry `Status: Proposed` and link back to the audits that motivated them. Acceptance requires a separate session.

## Process notes

- Four audits ran fully in parallel as background subagents – total wall time ~15 minutes while I worked on other things. Each agent got a scoped prompt, a fixed output path, and the explicit constraint "read-only, don't touch code, only write your report".
- Cross-cutting synthesis is worth the extra hour at the end. Individual audit reports are long; the scoreboard + themes section here is the only artefact most readers will open, and it's the only place the patterns become visible.
- Point-in-time audits accumulate. We now have two dated accessibility reports (2026-04-18 + 2026-04-19) and the newer one explicitly lists what the older one flagged that is now closed. This makes "am I looking at stale advice" a one-line check, not a diff exercise.

## Takeaways

- Fifteen minutes of parallel specialist attention found 94 distinct observations, of which 19 are material (2 critical + 17 high). That's a better ratio than any single audit pass produced in this project, suggesting parallel-specialised-reviewers is a pattern worth keeping.
- The critical pair is both "wiring the client to the server it already has" – no missing features, just handlers not attached. Cheap to fix, high user-visible impact.
- Five ADRs in one session is a lot, but each covers a theme at least two audits independently flagged. Ignoring a theme two auditors agreed on is how technical debt accrues.

## Commits

This session wrote audit reports + journal + five proposed ADRs. No application code was changed in this pass; that's the follow-up work once ADRs are accepted.
