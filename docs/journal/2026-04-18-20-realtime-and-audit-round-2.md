# 2026-04-18 · Real-time message bug + design audit round 2

Two threads in one session.

First: a user-reported bug that "posting a message with an image, I can't see it in chat until I reload" turned into a real-time delivery defect affecting every message authored in any tab, not just ones with attachments. Root cause was on the API side.

Second: Claude Design returned a round-2 audit (`Audit.html`, 18 new findings) against the post-round-1 codebase. 17 app-side items landed; 1 (R2-01) was a correction to the audit doc itself, not the app. User then asked for two UX additions on top of the audit: a password-reveal toggle on the auth forms, and a lightbox for image attachments.

## Thread 1 – the real-time delivery bug

### Symptom

User typed a message, clicked send, the composer cleared (so `message.send` RPC resolved), but the new row never appeared in the chat list. A hard reload showed the message present. Plain text reproduced it the same as attachment-bearing messages, so the attachment was a red herring.

### Walk-through

Confirmed via Postgres that the message *did* persist, and `GET /api/conversations/room/<id>/messages?limit=5` returned it with the expected `attachments: 1`. So server write path + REST layer were fine. The issue had to be in the WS-driven cache update.

Client side, `WsProvider`'s `message.new` handler called `queryClient.invalidateQueries({ queryKey: ['messages', type, id] })`. For an infinite-query with many pages already loaded (the room had 500 seeded messages and the user had scrolled back through ~10 pages), v5 invalidate refetches each page with its original cursor, which is brittle for live-append. Moved both `message.new` and `message.updated` (plus `message.deleted`) from invalidate to `setQueryData` that prepends / patches page 0 in place, idempotent by id. Also added a `MessagesPage` export from `useMessages` so the WS layer can type the shape.

Still not enough. After rebuild the symptom reproduced identically. Added temporary client + server `[DIAG:*]` console logs and sent one more message. The client-side `message.new` handler never fired. Server log:

```
[DIAG:publish] {
  topic: 'room:019da1d3-47cf-72b6-b35e-77c7d02e73a3',
  msgId: '019da226-c974-7384-9958-90e0b4f2b874',
  body: 'probe-server-log',
  subscribers: 0
}
```

Zero subscribers to the room topic the user was actively looking at. The server was publishing into the void.

### Root cause

`apps/api/src/ws/auto-subscribe.ts` ran on the `hello` lifecycle event:

```ts
connectionLifecycle.on('hello', (conn) => {
  if (conn.subscriptions.size > 0) return;   // ← guard
  // …fetch rooms + DMs, subscribe…
});
```

But `apps/api/src/ws/plugin.ts` *already* pre-subscribes every new connection to its `userTopic` at socket-open time (line 43). That made `subscriptions.size === 1` before `hello` ever arrived, so the guard always hit and the room/DM fetch never ran. The author was not subscribed to their own room. `message.new` broadcasts fanned out to an empty subscriber set.

Guard was originally written as an optimisation to avoid a duplicate DB query on `hello` re-sends during reconnect churn. But a re-send on the same `conn` isn't a real scenario for the client today, and even if it were, `subscribeConnection` is already idempotent. The guard was load-bearing for nothing and catastrophic for correctness.

### Fix

Narrowed the guard to check specifically for room/DM subscriptions:

```ts
const hasConversationSub = Array.from(conn.subscriptions.keys()).some(
  (topic) => topic.startsWith('room:') || topic.startsWith('dm:'),
);
if (hasConversationSub) return;
```

User-topic preloading no longer trips the early-return. Combined with the earlier client-side `setQueryData` refactor, the full real-time pipeline now works end-to-end: WS broadcast → `setQueryData` into page 0 → React re-renders → if the user was at bottom, auto-follow scrolls to the new row.

Added that auto-follow behaviour to `MessageList` at the same time: a ref mirror of `isAtBottom` plus a per-conversation count watcher. When the count grows and the user was already at bottom, one `requestAnimationFrame` + `scrollToIndex(length - 1, 'end')`. Skipped on initial load (the existing initial-scroll effect handles that) and on conversation switch (ref reset).

### Takeaways

1. **Auto-subscribe silently failing is exactly the kind of correctness bug the system prompt can't help you find.** `publishNewMessage` succeeded every time; the bus just had nobody listening. The only way to notice was the symptom six layers away ("reload to see the message"). Worth keeping `bus.countSubscribers(topic)` around as a cheap assertion in future hot-path publishers – maybe even log it at warn when it's zero.
2. **Don't early-return on coarse signals.** The guard was "is this connection already set up?" but the signal used (`subscriptions.size > 0`) didn't answer that question after the plugin started pre-subscribing.
3. **`invalidateQueries` on a long infinite query is a trap for live-append.** `setQueryData` is the right pattern anywhere you already hold the full view of the new row.

## Thread 2 – Claude Design audit round 2

Triggered against commit `9bdb42e` (the state right after thread-1 and the scroll-UX pass landed). 18 new findings. R2-01 is the audit document's own `:root` still carrying the old `--ink-3` value – not the app. The remaining 17 sorted into DS primitives, new primitives, and page-level cleanup.

### What landed

**DS primitives**

- **R2-13 Toast**. Dropped the 1 px outer outline. Accent-bar-only now (3 px left tone bar, 1 px top/bottom hairlines). Added `role="alert"` on error/warn tones.
- **R2-12 Modal**. Title strip from 9×12 padding / 12 px → 7×10 / 11 px. Keeps the chrome gradient and bottom hairline. Reads closer to the classic web-chat window-chrome strip.
- **R2-17 ContactListItem**. Now calls `<Presence size={9} />` instead of re-drawing the swatch inline. Two places can't drift any more.
- **R2-14 RoomListItem**. Unread pill uses `<Badge tone="mention">` so rooms and contacts read the same way.
- **R2-15 MessageRow mention wash**. New `--mention-wash: rgba(251, 236, 181, 0.55)` token; the hard-coded `rgba(240,210,120,.2)` gradient now derives from it.
- **R2-16 MessageRow self-marker**. Dropped the nickname underline (too close to link semantics). Own rows get a 2 px `accentSoft` left rail instead; mention still wins priority over self for the rail colour.
- New `SectionHeader`. Mono uppercase label with a hairline rule beneath. Keeps pages to two sans tiers (page h1 + Meta labels) – no third tier.
- New `ConfirmModal`. Replaces `window.confirm` for destructive actions. Accepts `title`, body children, `confirmLabel`, `tone='danger'|'primary'`, `pending` state. Uses `ModalScrim` + `Modal` so focus trap / Esc / scrim-click all come free.

**Pages**

- **R2-02 ManageRoomModal tabs**: `['Members', 'Admins', 'Banned users', 'Invitations', 'Settings']`. Noun tabs, not verbs.
- **R2-18 AdminsTab**: extracted a `renderRow(member, badge, action)` helper. Owner-row fallback and admin-row share the shape.
- **R2-08 delete-room flow**: `window.confirm` replaced with `ConfirmModal`. Body wording spells out what's destroyed ("the room, its messages and its attachments").
- **R2-03 ChatView right aside**: broken-out `RoomContextPanel`. Mono `# roomname` title, single visibility `Badge`, member count as `Meta` (not Badge – counters aren't roles). Owner / admins / members sorted by role, each a `ContactListItem` with live presence via `usePresenceOf`. Manage-room button pinned to the column bottom.
- **R2-04 inline error blocks**: five sites (SignIn, Register, CreateRoomDialog, InviteTab success, InviteTab error) replaced with `<Toast tone="error">` / `"success"`. The 6-line hand-rolled alert div pattern is gone.
- **R2-05 / R2-06 Contacts**: private `Section` helper rewired to `SectionHeader`. Four hand-rolled row cards (UserSearch, IncomingRequests, OutgoingRequests, Invitations) replaced with `<ListRow>`.
- **R2-07 Composer**: 📎 emoji dropped. Attach button is just "Attach" (word already carried meaning). Pending chips prefix with the mime's 4-letter `kind` in a mono chip instead of an emoji.
- **R2-09 OutgoingRequests Cancel**: `variant="danger"` → default. Cancelling a pending friend request is reversible, so it shouldn't look like a ban.
- **R2-10 Sidebar search**: wired up. Case-insensitive substring filter over publicRooms / privateRooms / dms. Section labels hide when their list is empty under a filter. No-results state when nothing matches.
- **R2-11 SessionsPage**: six columns → three. Session cell stacks browser + IP with the "current" badge inline. When cell has three `Meta` lines – created / last seen / expires – with relative-time formatting for the latter two. Actions cell holds the revoke/sign-out button. Fits the 720 px `PageShell` column without wrapping.

### Two follow-on UX requests the user had after the audit landed

**Password reveal on auth forms.** Added a `reveal` prop to `ds/Input`. When the input is `type="password"` and `reveal` is set, a mono text button ("show" / "hide") sits at the right edge of the field and toggles the type. Text, not an icon – matches the DS "no emoji, mono-forward" rule and the R2-07 precedent for attach. Applied to `SignInPage` and both password inputs on `RegisterPage`.

**Lightbox for image attachments.** Previously, clicking an image card ran the download endpoint's `Content-Disposition: attachment` behaviour and started a save. The image was visible inline but opening it full-size meant saving first. New `ImageLightbox` primitive: portal-to-body scrim + centered `<img>` up to 92 vw / 82 vh, "download original" link in the top-right for users who still want the bytes, "close · esc" button, Esc + scrim-click both close. `FileCard` image branch now renders a button that opens the lightbox instead of an anchor that triggered the download; non-image branch still uses the anchor for real download.

The portal matters: `MessageList` uses `@tanstack/react-virtual`, each virtual row gets `transform: translateY(...)`, which per CSS spec becomes the containing block for `position: fixed` descendants. First cut of `ImageLightbox` rendered the scrim inside the row, which pinned the "full-viewport" fixed layer to a 24 px row. `createPortal(..., document.body)` escapes the transformed ancestor. Verified in DevTools: scrim went from `1233 × 93` (row-bounded) to `1728 × 888` (viewport) after the portal.

## Takeaways

- The `subscribers: 0` from the diag log was the whole investigation in five bytes. Would have been hours of client-side debugging otherwise.
- `setQueryData` into page 0 of an infinite query is the right pattern for live-append anywhere the WS broadcast carries the full `MessageView`. Keep `invalidateQueries` for events that only carry ids, as a deliberate choice.
- `position: fixed` is not absolute. Any transformed / filtered / perspective'd ancestor becomes its containing block. Any overlay rendered inside a virtualiser must portal to body – and that's probably worth saying explicitly in a DS doc or a lint rule if the pattern recurs.
- British understated "show" and "hide" outperform an eye icon for password reveal in this DS. Keeps the classic-terminal tone consistent with everything else.
