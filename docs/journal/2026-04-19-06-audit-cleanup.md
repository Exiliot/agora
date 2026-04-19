# 2026-04-19 · Audit follow-ups: four open criticals/highs closed in parallel

After the five ADRs landed (session 04) four audit-level issues remained flagged as deliberate follow-ups – they didn't fit a cross-cutting ADR and were better handled as focused fixes. Cleared them in one parallel pass because the scopes are properly disjoint this time.

## What landed

| # | Origin | Commit | Change |
|---|---|---|---|
| 1 | Product critical #1 | `cff0f8d` | Client now sends `mark.read` (throttled 1.5s) when viewing a conversation scrolled near-bottom with the tab visible. |
| 2 | Product critical #2 | `05ccceb` | Danger-zone section on `/sessions` with a `ConfirmModal`-guarded "Delete my account" wired to `DELETE /api/users/me`. |
| 3 | Performance audit H2 | `8f40c4a` | `GET /api/notifications` feed is now a single SELECT + LEFT JOIN. 31 queries per page → 1. |
| 4 | Accessibility audit H3 | `0df0c08` | `--mention-fg` darkened from `#8a6a10` to `#7a5d0d`; contrast on `--mention-bg` (`#fbecb5`) goes from 4.28:1 to 5.23:1. |

## Parallelisation this time was fine

Unlike the ADR implementation pass, these four fixes touch genuinely disjoint file sets:

- #1: `apps/web/src/features/messages/useMarkRead.ts` (new) + `apps/web/src/pages/chat/MessageList.tsx`.
- #2: `apps/web/src/features/auth/useDeleteAccount.ts` (new) + `apps/web/src/pages/sessions/SessionsPage.tsx`.
- #3: `apps/api/src/notifications/hydrate.ts` + `apps/api/src/notifications/routes.ts`.
- #4: `apps/web/src/styles/tokens.css`.

Four background agents ran concurrently; total wall time ≈ 5 minutes instead of ≈ 15 sequential. No conflicts.

## Verification evidence from the agents

- `pnpm --filter @agora/web exec tsc --noEmit`: clean across all web changes.
- `pnpm --filter @agora/api test`: 12 files / 86 tests passing after the batch-hydrate rewrite. `publisher.spec.ts` still green thanks to `hydrateNotification` staying as a thin wrapper over `hydrateNotifications([id])`.
- Contrast math: new `#7a5d0d` on `#fbecb5` computes to 5.2271:1, comfortably inside the 4.7–5.5 target window with room against future rounding.
- mark.read: the hook fires on latest-id change AND on tab `visibilitychange` to `visible`, mirroring the pattern `useFocusBroadcast` already established.

## What this closes vs. what remains

Closed:
- **Product critical #1** – FR-NOTIF-2 now functional end-to-end; sidebar and bell counters clear on open.
- **Product critical #2** – FR-AUTH-13 has a UI surface; the server has been correct all along.
- **Performance audit H2** – N+1 dropped to 1 query per feed page; notifications at 30-row pages go from ~30 SELECTs to 1.
- **Accessibility audit H3** – every place the mention-fg / mention-bg pair renders (Badge `tone="mention"`, Bell unread counter, mention row accents) now passes WCAG 2.1 AA for normal text.

Combined with the ADR implementation pass, the audit dashboard now reads:

| Audit | Critical closed | High closed | Remaining high |
|---|---|---|---|
| Product integrity | 2 / 2 | 1 / 5 | 4 (still medium in practice; client-side plumbing gaps, not structural) |
| Security and privacy | – | 2 / 3 | 1 (XMPP internal routes – gated by `ENABLE_XMPP_BRIDGE=1`, out-of-scope by ADR-0005) |
| Performance and data integrity | – | 2 / 5 | 3 (messages cursor index, WS backpressure, mark.read watermark race) |
| Accessibility round 2 | – | 3 / 4 | 1 (NotificationMenu list semantics; was deliberately relaxed per ADR-0008) |

That's two criticals out of two, and eight of seventeen high-severity items resolved, across the ADR pass + this cleanup. The medium cluster is a separate half-day of work.

## Takeaways

- When the scopes are actually disjoint, the parallel fan-out saves real time. Took ≈ 5 minutes of wall clock versus the ≈ 15 minutes of the sequential ADR pass, for roughly the same code volume.
- The "set an `active` flag mirrored in React state so `useEffect` re-runs on visibilitychange" pattern showed up in both `useMarkRead` and `useFocusBroadcast`. One more consumer and this is a `useTabVisible` hook in the DS. Two consumers is not yet a pattern; flagging for the next round.
- The batch-hydrate rewrite was cleaner than expected because `hydrateNotifications(ids)` naturally replaces the loop and `hydrateNotification(id)` becomes a two-line wrapper. No consumer knows the difference. The cheap refactors that keep their public shape are the ones worth doing first.

## Commits

- `cff0f8d` fix(messages): wire mark.read from client when active at bottom
- `05ccceb` feat(auth): UI for account deletion on /sessions
- `8f40c4a` perf(notifications): batch-hydrate the feed in one JOIN
- `0df0c08` fix(ds): darken mention-fg to hit WCAG AA contrast (a11y H3)
