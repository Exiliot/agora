# WebSocket protocol

The transport contract between `apps/web` and `apps/api`. Event schemas live in `packages/shared` as zod objects so both sides stay in lockstep.

## 1. Connection

- Endpoint: `wss://.../ws` (secure in prod; `ws://` in local docker-compose).
- Authentication: the HTTP upgrade request carries the session cookie. The server resolves the session during upgrade; if invalid or expired, the socket closes immediately with code `4401`.
- Heartbeat: a WS ping frame every 25 seconds from the server; the client replies with pong. A missed pong for >40 seconds closes the socket.

## 2. Envelope

Every message is a JSON object with a discriminator field `type`. Server → client events have `type: 'x.y'` (dotted); client → server events have `type: 'x.y'` as well. An id (`reqId`) is included on client-originated events that expect an ack.

```jsonc
// client → server
{ "type": "message.send", "reqId": "r_01HXX...", "payload": { ... } }

// server → client (ack for reqId)
{ "type": "ack", "reqId": "r_01HXX...", "result": { "id": "msg_..." } }

// server → client (error)
{ "type": "err", "reqId": "r_01HXX...", "code": "not_member", "message": "..." }

// server → client (broadcast, no reqId)
{ "type": "message.new", "payload": { ... } }
```

## 3. Client → server events

| Type | Payload | Expects ack | Notes |
|---|---|---|---|
| `hello` | `{ tabId, openConversationIds }` | yes | Sent as the first message after open. Registers the tab and subscribes to initial topics. |
| `heartbeat` | `{}` | no | Sent on user activity (debounced to once per 5 s). Updates `lastActivityAt` for this tab. |
| `subscribe` | `{ topic }` | yes | Explicit subscription — typically not needed; `hello` + route-based subscriptions cover most cases. |
| `unsubscribe` | `{ topic }` | yes | Complement. |
| `message.send` | `{ conversationType, conversationId, body, replyToId?, attachmentIds? }` | yes | Server validates, persists, broadcasts. Ack returns the canonical message. |
| `message.edit` | `{ id, body }` | yes | Author-only. |
| `message.delete` | `{ id }` | yes | Author or room admin. |
| `mark.read` | `{ conversationType, conversationId, messageId }` | no | Advances `last_read`. |
| `typing` *(stretch)* | `{ conversationId }` | no | Server fans out a `typing` event to others; not MVP. |

## 4. Server → client events

### Delivery

| Type | Payload | Subscription required |
|---|---|---|
| `message.new` | `Message` | member of `conversationId` |
| `message.updated` | `Message` (with `editedAt`) | member |
| `message.deleted` | `{ id, conversationType, conversationId }` | member |
| `unread.updated` | `{ conversationType, conversationId, count }` | this user |

### Rooms

| Type | Payload |
|---|---|
| `room.member_joined` | `{ roomId, user }` |
| `room.member_left` | `{ roomId, userId }` |
| `room.member_removed` | `{ roomId, userId, by }` (sent to the removed user + other members) |
| `room.admin_added` | `{ roomId, userId }` |
| `room.admin_removed` | `{ roomId, userId }` |
| `room.access_lost` | `{ roomId, reason }` (sent only to the affected user) |
| `room.deleted` | `{ roomId }` |

### Contacts

| Type | Payload |
|---|---|
| `friend.request_received` | `FriendRequest` |
| `friend.request_cancelled` | `{ requestId }` |
| `friendship.created` | `{ userId }` |
| `friendship.removed` | `{ userId }` |
| `user_ban.created` | `{ bannerId, targetId }` |
| `user_ban.removed` | `{ bannerId, targetId }` |

### Presence

| Type | Payload |
|---|---|
| `presence.update` | `{ userId, state: 'online' | 'afk' | 'offline' }` |
| `presence.snapshot` | `Array<{ userId, state }>` | sent after `hello` and on subscription to a new conversation |

### Connection-level

| Type | Payload |
|---|---|
| `ack` | `{ reqId, result? }` |
| `err` | `{ reqId?, code, message }` |
| `server.banner` | `{ level, text }` — optional one-off banners (maintenance notices, etc.) |

## 5. Topics and subscriptions

Internally, the server maintains:

- `subsByTopic: Map<Topic, Set<Connection>>`
- `topicsByConnection: Map<Connection, Set<Topic>>`

Topic shape:

- `room:<roomId>` — all events for a room
- `dm:<dmId>` — all events for a personal dialog
- `user:<userId>` — user-scoped events (notifications, presence broadcasts targeted at the user, friendship events)

On `hello`, the server subscribes the connection to:

- `user:<thisUserId>`
- `room:<id>` for every room the user belongs to
- `dm:<id>` for every personal dialog the user participates in

On room join/leave, subscriptions update automatically.

## 6. Backpressure and drop policy

Each socket has an outbound queue of up to 512 messages. If full:

- Drop the oldest `presence.update` for any given user (keep only the latest).
- Never drop `message.new`, `ack`, `err`, `room.access_lost`.
- If even after pruning the queue is still full, close the socket with code `1011` and let the client reconnect + backfill.

## 7. Reconnection

- Client retries with exponential backoff: 1 s, 2 s, 4 s, ..., cap at 30 s.
- On reconnect, `hello` is re-sent. The server re-subscribes topics.
- Backfill: immediately after `hello`, the client requests `/api/conversations/:id/messages?since=<lastSeenMessageId>` for any conversation it has state for and renders the gap in place.
- `presence.snapshot` is re-delivered automatically on subscription.

## 8. Ordering guarantees

- Per conversation, `message.new` events are delivered to subscribers in `id` order (UUIDv7 is k-sortable; broadcast order is preserved in a single node because the bus iterates synchronously).
- Across conversations, no global ordering.
- Events originating in the same tick (e.g. `room.member_joined` + `message.new` shortly after) may arrive out-of-tick order on slow clients; the client handles this by reconciling on payload content, not on arrival order.

## 9. Error codes (non-exhaustive)

| Code | Meaning |
|---|---|
| `unauthenticated` | Session missing/expired. Socket closes with 4401. |
| `not_member` | Caller not a current member of the target conversation. |
| `banned` | Caller banned from the target room, or either side has user-banned the other. |
| `too_large` | Message body >3 KB or attachment exceeds size limit. |
| `not_found` | Target entity doesn't exist. |
| `rate_limited` | Too many messages per second from this connection. |
| `validation` | Payload failed schema validation; `message` contains details. |

## 10. Versioning

The protocol is versioned implicitly by the shared package. Breaking changes bump the package version and both apps update in lockstep — the monorepo guarantees atomicity. No on-the-wire version negotiation in MVP.
