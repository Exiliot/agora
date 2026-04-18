# Notifications

## Scope

FR-NOTIF-1, FR-NOTIF-2, FR-NOTIF-3.

## Definition of done

Rooms and contact dialogs carry a visible unread indicator whenever they contain messages newer than the user's last-read marker. Friend requests and room invitations arrive as in-app notifications with accept/reject actions. Opening a room or dialog clears its unread indicator. No desktop or email notifications.

## Acceptance criteria

- **Unread indicator** — A room/dialog with `unread_count > 0` shows a small warm badge (`accent-soft` background, see design system) near its name in the sidebar. A mention (`@username`) shows a stronger badge (`mention` tone).
- **Unread count source** — Derived from `messages` WHERE `conversation_id = :id AND id > :last_read_message_id`. Server sends the count on initial subscription; increments live via the `message_new` event; drops when `last_read` is advanced.
- **Mark as read** — Opening a conversation fires a WS `mark_read` event with the newest visible message id. Server updates `last_read` (idempotent; only advances forward). Broadcasts `unread_updated` back to other tabs of the same user.
- **Friend request notifications** — A pending incoming friend request produces an in-app notification. Accepting/rejecting uses the same endpoints as the dedicated requests UI.
- **Room invitations** — Pending invitations produce an in-app notification with room name, inviter username, room description (if any), and accept/reject buttons.
- **Persistence** — Notifications persist across reconnect. They are not ephemeral toasts — they live in a notifications panel until actioned.
- **Dismissal** — A notification disappears once its action is taken (friend accepted/rejected, invitation accepted/rejected). No "mark as read" for notifications separately.
- **Count in chrome** — The top-nav shows an aggregate indicator if there are pending notifications: a dot next to the profile menu.

## Out of scope

- Desktop push notifications (browser Notification API).
- Email notifications (no SMTP per FR-AUTH-9).
- Mobile push.
- Notification preferences / per-room mute.
- System-level sounds.
- Do Not Disturb mode.

## Implementation hints

- The notifications panel reuses the in-app WS bus; each notification is a specialised message of type `notification:*` (`notification:friend_request`, `notification:room_invitation`).
- Don't model a separate `notifications` table in MVP — the incoming-requests table and invitations table already provide the source of truth. The UI queries those plus `unread_count` via the conversation list.
- Keep the unread-count computation cheap: store it denormalised as `conversation_unreads(user_id, conversation_id, count)` incremented on `message_new`, reset to 0 on `mark_read`. Avoids a COUNT query on every sidebar render.

## Open questions

- [ ] Should `@username` mentions bypass read markers (i.e., stay flagged even after opening the room)? Defaulting to **no** in MVP — opening the room clears everything.
- [ ] Do admins see moderation-event notifications (e.g. "bob banned carol")? Not in MVP; moderation events flow through room events only.
