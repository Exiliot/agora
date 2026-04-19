# Product integrity and user-flow audit – agora

Date: 2026-04-19. Scope: full app. Target: every documented flow behaves correctly, consistently, and without friction. Read-only audit; no code changed.

## Executive summary

The app is remarkably close to the spec on the server side – every documented endpoint exists, access checks are consistent, and WS fan-out is wired through a clean in-memory bus. The client, however, has two consequential gaps that break the core loop: the web UI never sends `mark.read`, so server-side unread counters and the sidebar badges never clear when the user actually opens a conversation; and several domain events the API emits (`friendship.removed`, `user_ban.created/removed`, `room.admin_added/removed`, `room.member_left/removed`, `room.deleted` on the room topic) have no client handler, so moderation and friendship state is stale until the next HTTP refetch. Everything else is polish: a dead "Keep me signed in" checkbox, a create-room error path that misses its intended branch, a "no account deletion" hole in the account UI, an always-visible "Invitations" tab on public rooms, and a small family of destructive actions that skip `ConfirmModal`.

## Findings

Sorted by severity. Paths relative to the repo root.

| # | Sev | Flow | Location | Issue | User impact | Suggested fix |
|---|---|---|---|---|---|---|
| 1 | critical | Notifications / unread | `apps/web/src/pages/chat/MessageList.tsx:371` | Client never sends `mark.read`; the server handler exists but is never hit. | Unread badges in sidebar and bell never clear on open; FR-NOTIF-2 fails. | On new visible `latestId`, call `ws.send({ type: 'mark.read', payload: { conversationType, conversationId, messageId } })`. [CLOSED in `cff0f8d`] |
| 2 | critical | Account deletion | `apps/web/src/pages/*` | No UI for `DELETE /api/users/me`; FR-AUTH-13 has a backend but no visible surface. | Users cannot delete their account via the demo – testers will hit a dead-end. | Add a "Delete account" affordance on a settings/profile page behind `ConfirmModal`. [CLOSED in `05ccceb`] |
| 3 | high | Moderation / friends live sync | `apps/web/src/app/WsProvider.tsx:141-168` | WS handlers are missing for `friendship.removed`, `user_ban.created`, `user_ban.removed`, `friend.request_cancelled`, `room.admin_added`, `room.admin_removed`, `room.member_left`, `room.member_removed`, `room.deleted`. | Moderation and friendship changes don't propagate live; dossier/member list/freeze banner stay stale until refetch. | Subscribe to these and invalidate the relevant query keys (`friends`, `user-bans`, `conversations`, `rooms`, `rooms/detail`). [CLOSED in `73f4a8d` (ADR-0009)] |
| 4 | high | Moderation (room ban) | `apps/api/src/rooms/routes.ts:737-766` | Banning a member deletes the membership row but does not call `unsubscribeConnection` on the target's live WS, unlike `/leave` at line 356. | Banned user's open tab keeps receiving `message.new` fan-out for that room until they reconnect. | Mirror the leave path: iterate `connections.forUser(targetId)` and `unsubscribeConnection(conn, roomTopic(id))`. [CLOSED in `73f4a8d` (ADR-0009)] |
| 5 | high | Notifications / focus | `apps/api/src/ws/user-focus.ts:20` | Focus registry is keyed per-user, not per-connection, yet one user can have many tabs. | Opening the bell menu (or any view that clears focus) in tab B wipes tab A's focus – the user gets a bell entry for a DM they're actively reading in tab A. | Key the registry by `connId` and let `matches` return true if any of the user's connections match. |
| 6 | high | Sign-in multi-tab / session revoke | `apps/web/src/lib/apiClient.ts:47-61` | No global 401 handler; `useMe` has a 60s `staleTime` with `retry: false`. | Sessions revoked on another tab leave stale UI for up to a minute and error-toast on mutations before the user gets bounced to sign-in. | On any `ApiError` with `status === 401`, setQueryData(ME_QUERY_KEY, null) and let `ProtectedRoute` redirect. [CLOSED in `4398e4c`] |
| 7 | high | Notifications schema drift | `packages/shared/src/notifications/index.ts:20` | `room.ban` kind is declared and handled by the UI but never published by the server (only `room.removed` fires). | `room.ban` strings in `NotificationRow` and `native.ts` are dead; the spec's distinction between "removed" and "banned" is lost. | Decide: emit `room.ban` on `/rooms/:id/members/:userId` DELETE, or drop `room.ban` from the kind enum and the switch arms. [CLOSED in `3d66e0f`] |
| 8 | medium | Create room | `apps/web/src/pages/chat/Sidebar.tsx:125` | Error branch checks `err.body?.error === 'name_taken'`, but the API returns `error: 'conflict', code: 'room_name_taken'`. | The "name already in use" copy path is dead; user sees the raw server message via the generic fallback – still legible but inconsistent with the other pages. | Compare against `err.body?.code === 'room_name_taken'` (matches the API contract). [CLOSED in `e8dfeb4`] |
| 9 | medium | Sign-in | `apps/web/src/pages/sign-in/SignInPage.tsx:69` | "Keep me signed in" checkbox is `defaultChecked` with no state and no submission field; session cookie is always 14 days. | Decorative input – users trust it and believe they can toggle persistence. | Either remove the checkbox or wire it to a `rememberMe` flag that shortens the cookie's `maxAge` when unchecked. [CLOSED in `653b17e`] |
| 10 | medium | Private invitation UX | `apps/web/src/pages/chat/ManageRoomModal.tsx:231` | "Invitations" tab is rendered on every room; the API rejects invites on public rooms with `not_private`. | Owners/admins of a public room see an Invite form that always errors – and the toast body is the raw `not_private` code, not a sentence. | Hide the tab when `room.visibility !== 'private'`; map error codes to prose in `onError`. [CLOSED in `3f186dc`] |
| 11 | medium | Create room cache | `apps/web/src/features/rooms/useCreateRoom.ts:9` | `onSuccess` invalidates `['rooms']` but not `['conversations']`; `useConversations` still has the stale list. | Newly created room does not appear in the sidebar until another signal (first message) invalidates conversations. | Add `qc.invalidateQueries({ queryKey: ['conversations'] })` alongside the rooms invalidation. [CLOSED in `e8dfeb4`] |
| 12 | medium | Destructive action consistency | `apps/web/src/pages/contacts/ContactsPage.tsx:167-194`, `apps/web/src/pages/chat/ManageRoomModal.tsx:62`, `apps/web/src/pages/sessions/SessionsPage.tsx:77` | `Unfriend`, `Ban user`, `Unban`, `Reject invitation`, `Remove member (= ban)`, and `Revoke session` all fire without a `ConfirmModal`. | A mis-click permanently bans a user (collapses friendship and requests in one transaction) or removes a room member. The spec's "destructive actions confirm via modal" is honoured only for delete-message and delete-room. | Route every red/destructive button through `ConfirmModal`. [CLOSED in `3f186dc`, `759d84a`, `61767d5`] |
| 13 | medium | Toast copy for invite errors | `apps/web/src/pages/chat/ManageRoomModal.tsx:164` | On invite error, the toast renders `err.message` which resolves to the raw `error`/`code` string (e.g. `'not_found'`, `'conflict'`, `'not_private'`). | The owner sees opaque codes rather than sentences. | Map codes: `not_found → "no such user"`, `already_member → "they're already in the room"`, `target_banned → "that user is banned from this room"`, etc. [CLOSED in `3f186dc`] |
| 14 | medium | Deleted-message copy | `apps/web/src/pages/chat/MessageList.tsx:564`, `apps/web/src/ds/MessageRow.tsx:108` | ConfirmModal body promises "Deleting replaces the body with `[deleted]`" but `MessageRow` shows italic `message deleted`. | Inconsistent copy across the confirm and the result; testers notice. | Pick one and use it in both places. [CLOSED – see commit below] |
| 15 | medium | Account-level password change | `apps/web/src/pages/**` | `POST /api/auth/password-change` is implemented with rate limit and session-revocation-elsewhere, but no UI calls it. | Logged-in password change (FR-AUTH-10) cannot be exercised from the app. | Add a small form on `/sessions` or a new `/profile` page. [CLOSED in `61767d5`] |
| 16 | low | Register validation fallback | `apps/web/src/pages/register/RegisterPage.tsx:35` | On `invalid_input` the server returns `issues` but no `message`; UI falls through to `"error 400"`. | Zod-rejected registers (e.g. username starting with a digit) show a cryptic code instead of a hint. | Use `issues[0]?.message` or a curated map keyed off the failing path. [CLOSED – see commit below] |
| 17 | low | Sessions empty state | `apps/web/src/pages/sessions/SessionsPage.tsx:41` | If `data.length === 0`, the page renders only the subtitle – blank below. | Unlikely in practice (caller has at least one session) but visually empty if it happens. | Render `<EmptyState caption="no active sessions" />` in the `else` branch. [CLOSED in `61767d5`] |
| 18 | low | Sidebar empty state | `apps/web/src/pages/chat/Sidebar.tsx:186-252` | When the user has no rooms and no DMs, the sidebar body is entirely blank below the filter. | First-run user sees nothing in the sidebar except the Create button. | Caption "no rooms yet – join one from Public rooms or create one below." [CLOSED in `e8dfeb4`] |
| 19 | low | Backfill watermark regress | `apps/web/src/features/messages/backfill.ts:30` | `note(…, incoming[incoming.length - 1].id)` with `desc` order advances the watermark to the oldest of this batch, not the newest. | Safe (lastSeen only advances), but next reconnect re-fetches messages already in cache. | Use `incoming[0].id` (the newest) – the backend returns `created_at DESC`. [CLOSED – see commit below] |
| 20 | low | Dead route | `apps/web/src/App.tsx:44` | `/profile` routes to `ChatView` with no `roomName`, rendering the "pick a room" empty state. | Nothing currently links to it, but a broken link waiting to happen. | Delete the route or wire a real profile page. [CLOSED in `4398e4c`] |
| 21 | low | Native notifications out of scope | `apps/web/src/features/notifications/native.ts`, `docs/requirements/07-notifications.md:24` | Desktop push is explicitly "out of scope" in the requirements, but the UI implements it and prompts for permission. | Not broken; spec drift. | Remove, or amend the requirements file. |
| 22 | low | Dossier members – no client-side presence ordering | `apps/web/src/pages/chat/ChatView.tsx:42-48` | Members are sorted by role only; presence state is rendered but not used in ordering. | Minor – the right panel looks busy if the room has dozens of offline members. | Secondary sort by presence (online → afk → offline). [CLOSED – see commit below] |

## Flow-by-flow notes

### 1. Onboarding

Registration posts to `/api/auth/register`. Valid inputs return 201 with a session cookie; the client sets `me` in the cache and navigates to `/chat`. Duplicate email and username surface as dedicated errors (`email_taken`, `username_taken`) and are mapped to human-friendly copy. Malformed inputs (e.g. username starting with a digit, or password under 8 chars) return `invalid_input` with zod `issues[]` but no top-level `message`, and the UI falls back to `"error 400"` (finding #16). The password-confirm mismatch is caught client-side with a Toast before submit. After a successful register, the user lands on `/chat` with no room selected and sees the "pick a room from the sidebar or browse public rooms" empty state.

### 2. Sign-in

Happy path mutates `me` and navigates to the `next=` param or `/chat`. Wrong password or unknown email both produce a 401 with `error: 'invalid_credentials'`, and the client shows `"invalid credentials"` – intentionally non-enumerating. Deleted accounts (`users.deletedAt IS NOT NULL`) take the same 401 path so account-soft-deletion stays opaque. Auth rate-limit is 10/min per IP via `@fastify/rate-limit` (auth/rate-limit.ts:20); on 429 the UI doesn't special-case, so users see the generic server `message` from `@fastify/rate-limit` ("Rate limit exceeded…").

`location.state.flash` from the reset flow renders through the green Toast – confirmed at SignInPage.tsx:70. The "Keep me signed in" checkbox is purely cosmetic (finding #9).

### 3. Forgot password

`POST /api/auth/password-reset/request` is always 204 regardless of email existence (anti-enumeration). When the email exists and is not deleted, a URL like `http://localhost:8080/reset?token=…` is logged via `req.log.info` and `console.error` with the `[AUTH reset link]` tag (auth/routes.ts:200-204). The UI is honest about the mock: the post-submit screen shows a blue info Toast with the exact `docker compose logs` incantation.

Consuming the token calls `POST /api/auth/password-reset/consume` which rotates the password, revokes every session for that user (`deleteSessionsForUserExcept(userId, null)`), and publishes a `session.revoked_elsewhere` notification – yes, even though the user isn't signed in yet. The notification will surface on the next sign-in. After success, the client navigates to `/sign-in` with `location.state.flash = 'Password updated. Sign in with the new one.'` – which the sign-in page renders correctly. Invalid/expired tokens surface the dedicated `"this reset link is invalid or has expired – request a new one"` message.

### 4. Creating a room

`Sidebar`'s CreateRoomDialog lowercases the name and submits `{ name, description, visibility }`. The server validates against the zod `roomNameSchema` (min 2, max 48, regex `^[a-z0-9][a-z0-9._-]*$`); anything invalid returns 400 with zod issues. Unique violations return 409 with `{ error: 'conflict', code: 'room_name_taken' }`. The Sidebar only branches on `err.body?.error === 'name_taken'` – that string never appears in any response, so the specific branch is dead (finding #8). Because `ApiError` also satisfies `instanceof Error`, the fallback picks up `err.message` which is the server's `"room name already taken"` – acceptable by accident.

On success the server auto-subscribes the creator's live WS connections to `roomTopic(id)` (rooms/routes.ts:168), and the dialog navigates to `/chat/{name}`. The new room doesn't appear in the sidebar immediately because `useCreateRoom.onSuccess` invalidates `['rooms']` but not `['conversations']` (finding #11).

The `#` glyph renders consistently via `RoomName.tsx` (hash for public, `LockIcon` for private) in the sidebar, header, dossier, and invitations list. `RoomListItem` reuses the same convention.

### 5. Joining a public room

`PublicRoomsPage.join` POSTs `/api/rooms/:id/join`, then invalidates `['rooms']` and `['conversations']`, then navigates. On the server side:

- Ban pre-check (`isBannedFromRoom`) – 403.
- Idempotent re-join for existing members – 200 with the current detail.
- New member insert, auto-subscribe the joiner's connections to the room topic, broadcast `room.member_joined` on the room topic.

Existing members subscribed to that topic receive `room.member_joined`; WsProvider invalidates `['rooms']`, and the dossier refetches via `useRoom(id)`. The history backlog is rendered via the ordinary `MessageList` which lazy-fetches `/api/conversations/:type/:id/messages` on mount.

### 6. Private room invitation round-trip

`InviteTab` posts `/api/rooms/:id/invitations`. Server checks visibility (`not_private → 400`), membership (`not_member → 403`), target existence (`user_not_found → 404`), self-invite (`self_invite → 400`), already-member (`already_member → 409`), room ban (`target_banned → 409`), and race on the unique index (`already_invited → 409`). Each is a distinct code but the client only renders `err.message`, which is the raw string (finding #13).

On success the invitee receives both a bus event (`invitation.received`) that the WsProvider consumes to invalidate `['invitations']`, and a durable `room.invitation` notification row. Opening the bell and clicking the row deep-links to `/contacts` (NotificationMenu.tsx:30). Accepting the invitation adds the invitee as a member, publishes `room.member_joined` on the room topic, auto-subscribes the invitee's live connections, and fires a `room.joined_private` notification to every other admin+owner. Both sides see the updated member list after the detail query refetches.

### 7. Messaging – DM

Plain send: `Composer` calls `ws.request('message.send', …)`. Server validates room/DM access, friendship, ban state, inserts, links any pre-uploaded attachments that still have `messageId IS NULL`, publishes `message.new` on the DM topic and `unread.updated` on each recipient's user topic, and emits a `dm.new_message` notification (suppressed by the focus registry if the recipient is actively viewing this DM – see finding #5 for multi-tab edge).

Edit: `ws.request('message.edit', …)`; server checks author, updates body/`editedAt`, re-hydrates, and re-broadcasts. The client receives `message.updated` and patches the in-place cache entry.

Delete: `ws.request('message.delete', …)` after a `ConfirmModal`; server flips `deletedAt`, re-broadcasts, client applies `{ body: '', deletedAt }` in-place. `MessageRow` renders "message deleted" in italics. Finding #14: the ConfirmModal copy promises the "[deleted]" literal which the row never shows.

Attachment-then-send: `uploadAttachment` → `POST /api/attachments` (multipart) returns an `AttachmentSummary`; the id is passed into `message.send`'s `attachmentIds`. Server-side: inside the message-insert transaction, `UPDATE attachments SET messageId = inserted.id WHERE id IN (…) AND uploaderId = caller AND messageId IS NULL`. Orphans fall to the sweeper.

DM to non-friend: `POST /api/dm/open` rejects with 403 `not_friend`. The UI only calls `openDm` from the `FriendList` tab in Contacts, so the path is not reachable from today's surface; but the `useOpenDm` mutation has no error UI at all – any future call that races (e.g. the friend just unfriended you between the list render and the click) silently no-ops for the caller.

### 8. Messaging – room, including @mentions

Mentions are parsed server-side via `extractMentions` (notifications/mention.ts) which correctly requires a leading whitespace or BOL so emails (`bob@agora.test`) don't spuriously mention "agora". For each unique lowercase mention that's also a current member (and not the author), a `room.mentioned` notification row fires. The author never bell-notifies themselves (`ne(users.id, userId)` at ws-handlers.ts:206).

`MessageRow` preserves the `[HH:MM] nick: body` shape, uses IBM Plex Mono, and renders multiline bodies with the room's single-column layout. The Composer's `onKeyDown` sends on Enter and newlines on Shift+Enter. The hint text "⏎ send · ⇧⏎ newline · paste images" is inline.

### 9. Notifications

The round trip is solid on the server: event → `publishNotification` → `INSERT … ON CONFLICT (user_id, kind, subject_type, subject_id) WHERE read_at IS NULL DO UPDATE SET aggregate_count = …` → `hydrateNotification` → `bus.publish(userTopic(userId), {type: 'notification.created', payload: view})`. The UI inserts the row at the head of page 0 or collapses into an existing unread row of the same subject. Bell badge reads `GET /api/notifications/unread-count` (cached, refetch-on-focus).

Deep links:
- `dm.new_message` → `/dm/{senderUsername}` (correct: sender is the counterparty).
- `room.mentioned`, `room.role_changed`, `room.joined_private` → `/chat/{roomName}`.
- `friend.request`, `friend.accepted`, `room.invitation` → `/contacts`.
- `session.revoked_elsewhere` → `/sessions`.
- `room.removed`, `room.deleted`, `room.ban`, `user.ban` → `null` (the row is marked read but the user stays put). Consider adding "/" for these or at least `/contacts` for `user.ban`.

Mark-all-read immediately invalidates the scalar unread count and sets every page of the cached feed to `readAt: now`. Single mark-read does the same per-row. Both publish `notification.read*` on the user topic so other tabs sync.

Focus suppression: per finding #5, single-tab users are fine; multi-tab users can cross-wire each other's focus because the registry key is `userId`, not `connId`.

### 10. Moderation

Ban from room (`DELETE /api/rooms/:id/members/:userId`):
- Inserts `room_bans` + deletes `room_members` in one transaction.
- Publishes `room.member_removed` on the room topic and `room.access_lost` on the target's user topic.
- Publishes a `room.removed` notification (NOT `room.ban` – see finding #7).
- Does NOT unsubscribe the banned user's live WS connection (finding #4). The next `message.new` on that room will still be fanned out to them until reconnect.
- Client side: `room.access_lost` handler invalidates `['rooms']` and `['conversations']`. The detail query still holds the old member list because `room.member_removed` has no client handler (finding #3). The chat view falls back to "you're not a member of #{roomName}" once the mine-rooms query refetches and no longer contains this room.

Ban user (`POST /api/user-bans`):
- Deletes any friend request and friendship between the two, inserts the ban row.
- Publishes `user_ban.created` on both sides' user topics – no client handler (finding #3).
- Publishes `user.ban` notification to the target with sender + reason.
- Client side: banner's `useBanUser.onSuccess` invalidates `user-bans`, `friends`, `friend-requests` but not `conversations` – the sidebar preview for that DM still shows the last message body until the next invalidation. DmView reads `useIncomingBans`/`useMyBans` to decide whether to freeze the composer; target tabs get the freeze only after those queries refetch.

Demote admin / promote admin: server emits `room.role_changed` notification; the role change is visible to the target on next detail refetch. The room's other members see nothing live because `room.admin_added`/`admin_removed` have no client handler (finding #3).

Remove member (= ban): same as "Ban from room" above.

### 11. Session management

`/sessions` lists every session for the caller with `isCurrent`, user agent, IP, created/last-seen/expires. The current session row gets a `Badge tone="accent"` and a dedicated "Sign out here" button; others have "Revoke".

Password change revokes all *other* sessions and fires `session.revoked_elsewhere` if the revoked count > 0. Password reset consume revokes ALL sessions including the current one (user has no live session at that moment) and fires the same notification – it'll land on the next sign-in.

Multi-tab sign-out: tab A signs out → server `deleteSession` → cookie cleared on tab A. Tab B still has the same cookie name but the session is gone. Tab B's next authed request gets 401. But because there's no global 401 handler and `useMe` has `staleTime: 60_000`, tab B can look signed-in for up to a minute and error-toast on any mutation until something else re-fetches `/auth/me` (finding #6).

Revoking your current session via the Sessions page: the DELETE route calls `clearSessionCookie` when `id === session.id`; the client then sits in a half-signed-out state until the same 401 path above.

### 12. Account deletion

`DELETE /api/users/me` is wired with the right cascade semantics: dependent rows go via FK cascade; messages/attachments the user authored/uploaded go to `NULL` via `ON DELETE SET NULL`; the response is 204 and `clearSessionCookie` runs. No UI calls this endpoint (finding #2). If it were called, the user would have to handle the 401 fall-through path (finding #6).

## Cross-cutting observations

**Copy consistency.** Toasts in the sign-in/register/reset flow are lowercase and punctuated (`"invalid credentials"`, `"that email is already registered"`, `"passwords do not match"`). The rest of the app varies: `ContactsPage` uses `"no matches"`/`"no friends yet – search for a user above"` (en dash, lowercase), `PublicRoomsPage` uses `"no rooms found — create one from the sidebar."` (em dash, full stop). The design bundle forbids em dashes – there is one in the Public page (`PublicRoomsPage.tsx:68`). The "Public – …" and "Private – …" copy on CreateRoomDialog uses en dash – good. Minor copy polish worth a sweep before submission.

**Dead affordances.** Only one decorative input remains: the "Keep me signed in" checkbox (finding #9). Everything else checked is wired.

**Race conditions.** The auto-subscribe flow on `hello` (ws/auto-subscribe.ts) queries rooms and DMs after the hello event; until that query resolves, the connection is subscribed only to `userTopic(userId)`. Messages arriving in that window don't fan out to the fresh connection – but the client's `ws.reopen` handler calls `backfillAllConversations`, which closes the gap via HTTP `since=`. Acceptable.

**Empty states.** The Sidebar's body is blank for a user with no conversations (finding #18). The Sessions table has no empty branch (finding #17). Contacts has proper `Meta` captions for every empty list. Notification menu has "Nothing here yet.". Public rooms has a caption.

**Destructive confirmations.** Only `ConfirmModal` is used; no `window.confirm`. But coverage is spotty (finding #12): unfriend, user-ban, room-ban, revoke-session, reject-invitation all fire on click.

**Links that 404.** `/contacts`, `/sessions`, `/public`, `/chat/:roomName`, `/dm/:username` all exist. `/profile` is declared but points at `ChatView` and isn't linked from anywhere (finding #20). Notification deep-links for `room.removed` / `room.deleted` / `room.ban` / `user.ban` resolve to `null` and leave the user where they clicked from – arguably fine, worth a policy choice.

## What's already tight

Server-side access checks are textbook – every HTTP route runs the permission probe per request, no caching. The notifications table's partial unique index and the publisher's `ON CONFLICT … DO UPDATE` neatly collapse floods into a single row per `(user, kind, subject)` while live. The `RoomName` component eliminated the ad-hoc `#` vs `🔒` drift that used to plague the chat header. The presence shape + colour combination (per DS) renders consistently through `ContactListItem` in both sidebar and dossier. The auth + reset + revoke-all-sessions trio is correct down to the `session.revoked_elsewhere` notification with a defensible `revokedCount > 0` gate.

## Recommended ADRs

1. **Client-side WS event coverage policy.** Findings #3 and #4 sit on the same pattern – the API emits a domain event, and the client either handles it or silently drops it. A short ADR enumerating "every bus event defined in `docs/ws-protocol.md` must have either a client handler or an explicit `// no-op client-side` comment in `WsProvider`" would catch future drift.

2. **Confirmation boundaries.** Finding #12 hits six call sites across three pages. A one-page decision – "any mutation that removes a relationship, role, or session goes through `ConfirmModal`, full stop" – collapses the bikeshedding and lets the ContactsPage and SessionsPage refactors be trivial.

3. **Global 401 handling.** Finding #6 is latent across every page. An ADR picking "the `api` wrapper invalidates `me` on 401 and lets `ProtectedRoute` redirect" vs. "every mutation handles 401 itself" avoids the current middle ground.
