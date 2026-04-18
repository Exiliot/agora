# Messaging

## Scope

FR-MSG-1 to FR-MSG-10, NFR-PERF-1, NFR-PERF-3, NFR-PERS-1, AC-QUEUE-1, AC-REALTIME-1.

## Definition of done

Users send plain/multiline text (UTF-8, ≤3 KB) to rooms and personal dialogs in real time over WebSockets. Messages appear for other clients within 3 seconds. History is persistent and loads via infinite scroll. Authors can edit and delete their own messages; room admins can delete any message in their room. Offline recipients see missed messages on reconnect.

## Acceptance criteria

- **Send message** — WS event `message_send` with `{conversation_id, conversation_type, body, reply_to_id?, attachment_ids?}`. Server validates permission (see below), inserts a `messages` row, publishes to the in-process bus, broadcasts `message_new` to all connected members. Ack returns the canonical message.
- **Permission check** — For rooms: caller must be a current member (`role` in owner/admin/member), and not in `room_bans`. For personal dialogs: FR-MSG-10 — friendship exists and no `user_ban` in either direction.
- **Delivery SLA (NFR-PERF-1)** — Round-trip from `message_send` to `message_new` arrival on another client ≤3 seconds at nominal load. Measured in Playwright e2e with two parallel browser contexts.
- **Message shape** — `{id, conversation_id, conversation_type, author_id, body, created_at, edited_at?, deleted_at?, reply_to_id?, attachments: [...]}`. UTF-8 body, server-enforced 3 KB limit.
- **Multiline** — Newlines preserved. Leading/trailing whitespace trimmed.
- **Emoji** — Native Unicode emoji in body. No reaction/sticker system in MVP.
- **Reply** — `reply_to_id` references another message in the same conversation. The referenced message MUST exist at send time. If the referenced message is later deleted, the reply still carries the reference; UI renders it as a greyed-out `message deleted` quote.
- **Edit** — `message_edit` WS event with `{id, body}`. Only the author can edit. Sets `edited_at = now()`. Broadcasts `message_updated`. Edits older than 15 minutes are still allowed (no timebox in MVP).
- **Delete** — `message_delete` WS event with `{id}`. Author or admin of the containing room may delete. Sets `deleted_at = now()` (soft delete, body cleared). Broadcasts `message_deleted`. In personal dialogs, only the author can delete. Deletion of a message with attachments clears the attachment rows but does not delete the files on disk (consistent with FR-ATT-7 — bytes persist, access is removed).
- **Ordering** — Messages are ordered by `created_at`, ties broken by `id` (UUIDv7 or ULID recommended so they're k-sortable).
- **History fetch** — `GET /api/conversations/:id/messages?before=<messageId>&limit=50` returns up to 50 messages strictly older than the cursor. Infinite scroll keeps calling this as the user scrolls up.
- **Initial load** — Opening a conversation fetches the most recent 50 messages. The UI renders bottom-anchored; autoscroll only fires when a new message arrives AND the scrollview is at the bottom (FR-UI-3).
- **Large history** — A conversation with 10k messages remains usable. No full-table scans on open; queries hit an index on `(conversation_id, created_at DESC)`.
- **Offline delivery (FR-MSG-9)** — Messages land in the DB regardless of recipient presence. On reconnect, the client fetches unread indicators + a small backfill; it does not need a replay log.
- **Read markers** — Each (user, conversation) pair stores `last_read_message_id`. Opening the conversation advances the marker to the newest rendered message. The unread count is derived as "messages newer than last_read".

## Out of scope

- Reactions (👍, ❤️ etc.).
- Message search.
- Threads beyond simple replies.
- Typing indicators.
- Read receipts per-user (we only track my own last-read marker, not who has read what).
- Message pinning, stars, bookmarks.
- Export / archive.

## Implementation hints

- One `messages` table, with a `conversation_type` discriminator (`room`, `dm`) and a `conversation_id` (room_id or dm_id). Keeps the query surface uniform.
- `dm_conversations` table: (user_a_id, user_b_id) ordered, one row per pair. Created lazily on first message.
- `reply_to_id` is a self-FK. Do NOT cascade delete on author deletion — we keep the thread intact.
- `last_read` table: (user_id, conversation_id) PK, last_read_message_id, updated_at.
- The in-process bus has three topic prefixes: `room:<id>`, `dm:<id>`, `user:<id>` (for per-user notifications like friend requests). Each WS connection subscribes to the union of topics relevant to its user.
- Each WS connection has an outbound message buffer to absorb bursts; slow clients get their buffer drained via backpressure without dropping the socket.
- Server-side rate limit: 5 messages/second per connection as a safety valve (not documented to users; prevents runaway loops).

## Open questions

- [ ] Do edits keep a version history we can show? Defaulting to **no** — only current body and an `edited` flag.
- [ ] Can a user delete their *own* message in a room they've been banned from retroactively? Defaulting to **no** — once banned, the banned user has no access to that room's API surface.
