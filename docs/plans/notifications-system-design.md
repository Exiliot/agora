# Notifications system – design spec

Date: 2026-04-19
Status: Approved (to be implemented)
Scope: agora v1

## Goal

Give agora a first-class notifications system that is (a) consistent with the existing design language (text-first, hairlines, one accent, mono for truth) and (b) reliable in the industry-standard ways people now expect from Slack / Discord / Gitter:

- nothing is lost when you reload the page
- nothing is lost when you were offline while it happened
- the tab can still be in the background and the user is still told about the important stuff (native OS toast)
- in-app, you see a transient toast for the event AND a persistent entry that hangs around in a bell-icon drop-down until you deal with it.

## Non-goals (v1)

- Per-conversation mute / do-not-disturb windows / quiet hours.
- Grouping across senders (a single "you have 12 new things from 4 people" digest). We collapse per-sender-per-conversation only.
- Email fallback for offline users (there is no mailer – see `apps/api/src/auth/routes.ts` reset-link comment).
- Push notifications via a service worker once the tab is fully closed. Native OS toast while the tab is open and backgrounded is in scope; true push is not.
- Notifications for low-signal state changes (presence, unread counter, your own actions).

## Event catalogue

Notifications are produced for these events, mapped from existing WS fan-out:

| Priority | Event                        | Trigger                                                                     | Toast | Bell | Native OS |
|----------|------------------------------|-----------------------------------------------------------------------------|-------|------|-----------|
| high     | `dm.new_message`             | a DM message arrives from a counterparty, and the user isn't actively viewing that DM | yes | yes | yes, if tab is not focused |
| high     | `room.mentioned`             | `@nick` of the recipient appears in a room message the recipient can see    | yes | yes | yes, if tab is not focused |
| high     | `friend.request`             | incoming friend request                                                     | yes | yes | yes, if tab is not focused |
| high     | `room.invitation`            | incoming room invitation                                                    | yes | yes | yes, if tab is not focused |
| high     | `room.ban`                   | you were room-banned                                                         | yes | yes | yes, if tab is not focused |
| high     | `user.ban`                   | a counterparty user-banned you (DM frozen)                                  | yes | yes | yes, if tab is not focused |
| medium   | `friend.accepted`            | the other side accepted your outgoing friend request                        | yes | yes | no |
| medium   | `room.role_changed`          | you were promoted to / demoted from admin                                   | yes | yes | no |
| medium   | `room.removed`               | you were removed from a room (non-ban)                                      | yes | yes | no |
| medium   | `room.deleted`               | a room you were a member of was deleted                                     | yes | yes | no |
| medium   | `session.revoked_elsewhere`  | your session was terminated by a password change, admin action, or bulk sign-out from another device | yes | yes | no |
| low      | `room.joined_private`        | a user joined a private room where you are owner or admin                   | no  | yes | no |

**DM collapse rule.** If an unread `dm.new_message` notification already exists for the same (recipient, dmId) pair, the server increments its `aggregateCount` field and refreshes `updatedAt` instead of inserting a new row. Display is `"wefflerer · 12 new messages"`. Clicking opens the DM and marks the notification read.

**Mention collapse rule.** Same idea for `room.mentioned` – one unread row per (recipient, roomId), increment on repeat. Display: `"#general · 3 new mentions"`.

Everything else – one row per occurrence, no aggregation.

"Active view" suppression: if the user is currently looking at the room or DM that would have fired `dm.new_message` / `room.mentioned`, we do NOT create a notification row (their unread counter already does the job). The server knows `currentConversationId` from a lightweight `client.focus` WS event (fire-and-forget, no ack) emitted by the client whenever the route changes or the tab regains focus.

## Architecture

### Data model

New table `notifications`:

```
id              uuid pk
user_id         uuid fk users.id on delete cascade
kind            text not null    -- enum: dm.new_message, room.mentioned, friend.request, …
subject_type    text             -- 'room' | 'dm' | 'user' | null
subject_id      uuid             -- roomId / dmId / otherUserId; used for collapse + deep-link
actor_user_id   uuid fk users.id on delete set null   -- who caused it, nullable for system
payload_json    jsonb            -- small shape per kind (roomName, senderUsername, inviter, …)
aggregate_count int not null default 1
read_at         timestamptz
created_at      timestamptz default now()
updated_at      timestamptz default now()

unique (user_id, kind, subject_type, subject_id) where read_at is null
    -- ^ the collapse index: one unread row per (user, kind, subject).
index (user_id, read_at nulls first, created_at desc)
    -- ^ primary feed index.
```

Rationale:
- No global kind enum type in PG – the allowed set is in the zod schema in `@agora/shared` and validated at the service layer. Keeps migrations cheap.
- `payload_json` holds the small amount of denormalised data the UI needs to render without a second fetch (sender username, room name, etc.). Not the source of truth.
- The partial unique index is what makes collapse O(1).

### Write path

A new helper `apps/api/src/notifications/publisher.ts` exposes `publishNotification(userId, kind, subjectType, subjectId, payload, actorId?)`. It:

1. INSERTs into `notifications` with `ON CONFLICT (user_id, kind, subject_type, subject_id) WHERE read_at IS NULL DO UPDATE SET aggregate_count = aggregate_count + 1, updated_at = now(), payload_json = excluded.payload_json`.
2. Publishes a `notification.created` event on `userTopic(userId)` carrying the full row shape.

This helper is called from the existing publishers in each feature module:
- `messages/ws-handlers.ts` – after the new message is hydrated, resolve mentions + DM counterpart and call `publishNotification`.
- `friends/routes.ts` – on request send, on accept (for the requester), on ban.
- `rooms/routes.ts` – on invitation, on role change, on remove, on delete, on ban, on member-joined (owner/admin only for private rooms).
- `auth/routes.ts` (password-change) and `session/store.ts` (bulk revoke) – fire a single `session.revoked_elsewhere` notification per user whenever one or more of their sibling sessions is revoked, not one per session revoked. payload carries the count (e.g. `{ revokedCount: 3, reason: 'password_change' }`).

Active-view suppression is implemented in `publishNotification`: it reads from an in-memory `userFocusRegistry` (see below) and skips the insert if the user's current focus matches `subjectType:subjectId`.

### Read path

HTTP (for initial load and for backfill after reconnect):
- `GET /api/notifications?before=<id>&limit=30` – paged feed, newest first. Default 30, max 100.
- `GET /api/notifications/unread-count` – single number, used to prime the bell badge before the feed loads.
- `POST /api/notifications/:id/read` – mark one read.
- `POST /api/notifications/read-all` – mark every unread as read.

WS:
- `notification.created` – new notification (or collapse update).
- `notification.read` – another tab marked something read; update locally.

### Client state

- New `apps/web/src/features/notifications/` feature folder.
- TanStack Query `['notifications']` is an infinite query over `GET /api/notifications`. Unread count has its own tiny `['notifications', 'unread-count']` query for the bell badge (so the badge updates without paging the whole feed).
- `notification.created` does `queryClient.setQueryData` on page 0 (prepend or collapse-update) and bumps the unread-count cache. Same `setQueryData` pattern we already use for `message.new` (see `apps/web/src/app/WsProvider.tsx:57`).
- `notification.read` decrements unread-count + patches the matching row's `readAt`.

### UX mapping – design tokens already present

| Surface          | Component                                                                                  |
|------------------|---------------------------------------------------------------------------------------------|
| Transient toast  | `apps/web/src/ds/ToastHost.tsx` `useToast().push(...)` – already shipped in audit round 2.  |
| Bell icon        | New `apps/web/src/ds/Bell.tsx` – 16×16 outline glyph in `tokens.color.ink1`, filled at `tokens.color.accent` when unread > 0. Uses `Badge tone="mention"` on top-right for count. |
| Bell dropdown    | New `apps/web/src/ds/NotificationMenu.tsx` – hairline-bordered popover, `Col gap=0` list of rows, max-height 60vh. |
| Notification row | Reuse `ds/ListRow.tsx` semantics. Left 2px rail tinted by kind: `tokens.color.accent` for mentions/DMs, `tokens.color.ok` for friendship/role-changes, `tokens.color.warn` for bans/removals, `tokens.color.ink2` for low-priority. Mono username + time-ago, sans body. |
| Topbar mount     | `apps/web/src/app/RootLayout.tsx` – bell sits between the navigation links and the username, left of "Sign out". |

No new design tokens. Colour rail tints use the existing status palette from `apps/web/src/styles/tokens.css`.

### Native OS notifications

- On first sign-in we DO NOT auto-prompt for permission. That's jarring and it's one of the "grader-hostile" surprises CLAUDE.md warns about (hackathon).
- Instead, the bell dropdown has a one-line "Turn on desktop notifications" link that triggers `Notification.requestPermission()` when clicked. State lives in `localStorage.agora.notifPerm`: `default | granted | denied`.
- Firing logic: on every `notification.created` with `priority: 'high'`, if `Notification.permission === 'granted'` AND `document.visibilityState === 'hidden'`, call `new Notification(title, { body, icon: '/favicon.ico', tag: \`${kind}:${subjectId}\` })`. The `tag` makes the OS replace prior notifications from the same conversation rather than stacking.
- Cross-tab dedup: a shared `BroadcastChannel('agora-notif')`. When a tab is about to fire a native notification, it first posts `{type: 'claim', id: notificationId, at: Date.now()}`. Every tab listens; the first claim to arrive wins. Everyone else suppresses. Falls back to "every tab fires" on browsers without BroadcastChannel (acceptable: browser OS already collapses by `tag`).

### Focus registry

New in-memory structure on the API: `apps/api/src/ws/user-focus.ts`:

```
userFocusRegistry.get(userId)  -> { subjectType, subjectId, lastBeatAt } | undefined
userFocusRegistry.set(userId, subjectType, subjectId)
userFocusRegistry.clear(userId)
```

Populated by a new WS event `client.focus` with payload `{ subjectType: 'room' | 'dm' | null, subjectId: uuid | null }`. Client emits it on route change and on `document.visibilitychange` to `visible`. `null` means "not focused on any conversation".

Multi-tab semantics: the registry is per-user, not per-tab. Whichever tab sent `client.focus` last wins. If any tab is currently focused on the DM, that's "the user is looking at it" for notification purposes, even if other tabs are on other routes. Rationale: the live message already renders in that tab's MessageList, the sidebar badge updates everywhere, and a redundant bell entry is noise.

`publishNotification` consults this registry before writing a `dm.new_message` or `room.mentioned` row, and short-circuits with no row + no WS event if the user is already looking at that subject.

## Flows in prose

**DM arrives while you're away.** wefflerer sends bob a DM. Server hydrates the message and fans out `message.new` on `dm:<id>` as today. Additionally, `messages/ws-handlers.ts` calls `publishNotification(bob, 'dm.new_message', 'dm', <dmId>, {senderUsername, snippet})`. Since bob isn't focused on that DM (registry says he's on `/chat/general`), the row is inserted (or collapse-updated) and `notification.created` fires on `userTopic(bob)`. All three of bob's live tabs receive it. Each tab prepends into its notifications feed and bumps the unread-count. One tab (BroadcastChannel winner) fires a native toast because document is hidden. Bob clicks the native toast, the browser focuses that tab, agora navigates to the DM, `client.focus` fires, server updates focus registry, and the `read_at` endpoint marks the notification read, decrementing the counter.

**Offline for a day, then reconnect.** bob signs back in. Initial HTTP calls: `GET /api/auth/me`, `GET /api/conversations`, `GET /api/notifications/unread-count`. Bell shows the number. When bob opens the dropdown, `GET /api/notifications?limit=30` lazy-fetches the feed. Everything that happened offline is there.

**Mention collapse.** exiliot types `@bob can you check this` in `#general`, repeated three times. First write inserts a new unread row `room.mentioned, room:<id>, aggregateCount: 1`. Subsequent writes conflict on the partial unique index and hit the ON CONFLICT branch, incrementing aggregateCount. The bell shows one entry: "#general · 3 new mentions".

**Bell click + mark-all-read.** Bob clicks the bell, sees 7 unread. Clicks "Mark all read". `POST /api/notifications/read-all`. Server sets `read_at = now()` on every unread row for bob and fans out a single `notification.read_all` WS event back to him. All three tabs decrement unread-count to 0.

## Testing

Unit:
- `notifications/publisher.spec.ts` – collapse behaviour, focus suppression, payload shape.
- `notifications/routes.spec.ts` – paging, unread-count, mark-read, mark-all.

Integration:
- Friend-request → notification → accept → `friend.accepted` notification for the requester.
- Room invitation → notification → accept → invitation row gone, notification stays read.
- DM arrives → notification → open DM → `client.focus` → notification marked read.
- Room mention → collapse on repeat.
- `session.revoked_elsewhere` after password change.

UX smoke (Playwright):
- Bell badge updates on WS event.
- Dropdown shows entries with correct tint rail.
- Native toast permission flow – verify the opt-in link + permission state persist in localStorage.

## Retention and hygiene

- Read rows auto-purge 30 days after `read_at` via a cron task in `apps/api/src/notifications/retention.ts`. One DELETE per hour. Unread rows never purge.
- On account deletion, `notifications.user_id` FK has `on delete cascade` so everything disappears with the user.

## Migration / evolution note

Agora will plausibly grow an events / audit log later – especially if the XMPP federation work in ADR-0005 ships, because replay needs a single append-only stream. When that happens, `notifications` becomes a materialised projection over `events` – the reader API and all UX stays unchanged, only the writer moves from "insert into notifications" to "insert into events + projector updates notifications". Spec'd in advance so we don't paint ourselves into a corner today, but out of scope for v1.

## Estimated scope

- Shared zod schemas for notification kinds + WS events: small.
- DB migration + drizzle schema: small.
- Server publisher + HTTP routes + focus registry: medium.
- Hooking into existing feature modules: small (one call per publisher).
- Client feature folder + Bell + NotificationMenu + NotificationRow: medium.
- Native toast + BroadcastChannel dedup: small.
- Tests: medium.

Order of work is the job of the plan (superpowers:writing-plans).
