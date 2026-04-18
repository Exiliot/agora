# 2026-04-19 · Notifications system – bell, collapse, focus suppression

Wave 4 work. Before this session, every realtime WS event (`friend.request_received`, `invitation.received`, `room.access_lost`, and all the message updates) triggered a TanStack Query invalidation and nothing else. No UI surface telling the user "something happened while you were elsewhere". Missed DMs while the app was backgrounded disappeared the moment you opened another conversation. Mentions in busy rooms vanished into the scroll.

The bell changes that.

## Why a dedicated `notifications` table (not an events-log projection)

The obvious alternative was a single `events` table that everything writes to, with a view projecting it per user. Rejected for three reasons:

1. **Only one consumer.** The bell is the only thing that reads these rows. No audit surface, no admin dashboard, no replay for a message-reconstruction feature. A projection pays abstraction cost for nobody.
2. **Read-state is per-user.** An events table with per-user read tracking ends up being either a big JSONB blob or a second join table. At that point it's just the notifications table with extra steps.
3. **Collapse lives at the write path.** DM and mention aggregation ("9 new messages from @alice") is a write-time concern – it's `INSERT ... ON CONFLICT DO UPDATE`, and it wants a unique index on (user_id, kind, subject_type, subject_id) WHERE read_at IS NULL. That's not a natural shape for an events log.

So: a dedicated table with a partial unique index. Writes are one statement regardless of whether it's a first occurrence or the tenth, no CTE chain, no read-then-write race window.

## The partial unique index trick

```
CREATE UNIQUE INDEX notifications_unread_collapse_key
  ON notifications (user_id, kind, subject_type, subject_id)
  WHERE read_at IS NULL;
```

Partial so read rows don't block new unread rows with the same key (marking yesterday's DM-from-alice as read mustn't reject tomorrow's). Postgres lets `ON CONFLICT (...) WHERE ...` target this – but not `ON CONFLICT ON CONSTRAINT <name>` because partial indexes aren't constraints. First gotcha in the implementation.

The publisher reduces to:

```
INSERT INTO notifications (...) VALUES (...)
ON CONFLICT (user_id, kind, subject_type, subject_id) WHERE read_at IS NULL DO UPDATE
  SET aggregate_count = notifications.aggregate_count + 1,
      payload_json = EXCLUDED.payload_json,
      updated_at = now()
RETURNING id
```

The RETURNING clause gives the caller the row id regardless of whether it was a fresh insert or an update, so the WS fan-out can hydrate and broadcast a single `notification.created` event either way.

## Focus suppression: `userFocusRegistry` + `client.focus`

Users get upset if the bell rings while they're actively looking at the conversation that triggered it. We need "is this user currently focused on subject X" as a fast in-memory check inside the publisher.

`userFocusRegistry` is a `Map<userId, Set<subjectKey>>` that each WS connection writes into via a new `client.focus` event the client sends when a route becomes active. The publisher's `isSuppressibleByFocus(kind)` check (only `dm.new_message` and `room.mentioned` qualify; friend requests and invitations always deserve the bell) short-circuits the insert if any of the user's tabs is focused on that subject.

Multi-tab semantics are intentionally simple: latest `client.focus` wins for each tab, all tabs' sets are unioned per user, registry entries drop on WS close. A tab that navigates away without sending a new focus will have stale data until close, but the failure mode is "user doesn't get a bell entry they'd have benefited from" – not "phantom entry", so the bias is safe.

## Bell + NotificationMenu in the DS

A type-tinted 3px left rail per row carries the kind (mention/DM/friend/invitation/ban) without inventing tokens. Times are `[HH:MM]` mono same as message rows. Empty state is a single greyed line; no illustration. Unread count badge uses the existing `mention` tone.

Native desktop toasts are **opt-in only** – we do not prompt on load. The settings screen has a toggle that triggers `Notification.requestPermission()` via a button click, so the browser's user-gesture requirement is satisfied. Reasoning: `docs/spec.md` and the hackathon CLAUDE.md both flag that grader-friendly apps don't ambush visitors with browser permission prompts on first render.

## Cross-tab native toast dedup via BroadcastChannel

Problem: if three tabs of agora are open and a DM arrives, all three see `notification.created` on their respective WS connections, and the default behaviour would fire three OS toasts.

Solution: `BroadcastChannel('agora-notif')`. On each `notification.created`, every tab posts a claim `{ id, at: Date.now() }` and also records its own claim locally (the `message` event listener only sees *other* tabs' messages – Chrome is specific about that). After a 120ms settle, the tab with the smallest `at` fires the toast; the others drop it. Ties resolve by the reducer's left-bias, which is fine – any single winner is correct.

`setTimeout(..., 120)` is a pragma. Too short and a slow tab never hears the broadcast before the timer fires; too long and the toast feels laggy. 120ms is well under perceptual threshold and orders of magnitude above intra-browser BroadcastChannel latency.

## `session.revoked_elsewhere`

`deleteSessionsForUserExcept` was already `Promise<number>` from the earlier auth wave, so Task 11 reduced to: call `publishNotification` from the password-change and password-reset-consume handlers when the row count is > 0. Reason is encoded in the payload (`password_change` vs `password_reset`) so the UI can distinguish later if needed.

The reset-consume case is interesting: there's no current session to exclude, so every session is revoked and every session receives the notification. That's correct – the user should see "4 sessions were signed out" on whichever device they next sign in from.

## Bell badge covers icon

Last UAT finding. The bell was a 16x16 button with an absolutely-positioned badge in the top-right corner, which overlapped the glyph. Fixed by widening the button to 44x28, pinning the icon to the left with `paddingLeft: 6`, and positioning the badge at `top: 3, right: 2`. Both visible, no layout shift when the badge appears/disappears.

## Deferred (explicit)

- **Task 12 – retention cron.** 30-day delete-where-created-at-<-now() loop. Nice to have for a long-running deployment, not for a hackathon demo. Backlog.
- **Task 19 – Playwright e2e for the bell.** The existing Playwright suite covers the presence/messages core flow. Bell was UAT'd by hand in Chrome and the insert-row-via-SQL smoke confirms the feed rendering. Skipping this to respect the agent budget rather than burn tokens on a test that's unlikely to catch regressions we wouldn't catch in manual UAT. Backlog.

Both documented in the plan's "Deferred" section.

## Takeaways

1. **`superpowers:subagent-driven-development` was a real win here.** The plan had 20 tasks; dispatching them to fresh subagents kept the main context under 200k tokens. Every task returned a compact report and only the bits worth keeping stayed in the main thread. Without it the rolling summary would have eaten the architecture notes that I needed in context at commit time.
2. **The mention parser needed a leading-whitespace rule.** First cut matched `@nick` anywhere in the body – which meant email addresses in pasted text (`alice@findmypast.com`) mentioned a user called `findmypast`. The fix is `(?:^|\s)@[\w]+` – a mention must start the body or follow whitespace. Cheap rule, 100% of the bogus mentions gone. Tested with `['email is foo@bar.com', '@nick hi', 'hi @nick', 'end@notmention', '@first @second']`.
3. **Don't optimistically bump unread-count on `notification.created`.** The server collapses via the partial unique index, so a new WS event doesn't necessarily mean a new unread row – it may be an aggregate_count increment on an existing one. The client can't tell without round-tripping to ask. Cheapest reconciliation: invalidate the `['notifications', 'unread-count']` query key and let the scalar endpoint return the truth. Two request/response exchanges in the worst case, but the endpoint is a single indexed COUNT so the cost is negligible, and the alternative (bumping optimistically and reconciling later) means the badge flickers when it shouldn't.

## Commit trail

```
15e691f feat(notifications): add notifications table with collapse-unique index
747dc41 feat(shared): zod schemas for notifications and client.focus WS event
0af722a feat(ws): in-memory user focus registry for notification suppression
aeba5b1 feat(ws): handle client.focus to track the user's active conversation
9805aa9 feat(notifications): extract mentions from message body
ed2aa79 feat(notifications): publishNotification with collapse + focus suppression
f20c8b5 feat(notifications): HTTP routes for feed, unread count, mark read
58f379a feat(notifications): fire dm.new_message and room.mentioned on send
328b66a feat(notifications): fire friend.request, friend.accepted, user.ban
b8e2b59 feat(notifications): fire room invitation, role change, remove, delete, ban, private-join
84cd3b6 feat(web): TanStack Query hooks for notifications feed and unread count
eb0734e feat(web): live-update notifications feed from WS events
b24c4ad feat(ds): Bell icon, NotificationRow, NotificationMenu popover
c462872 feat(ui): mount Bell and notification menu in the topbar
41e8cdd feat(web): emit client.focus from ChatView and DmView
a61934b feat(notifications): notify when sibling sessions are revoked
0a595e4 feat(notifications): opt-in native OS toasts with cross-tab dedup
```
