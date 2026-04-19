# ADR-0009 · Client WS event-handler coverage contract

- **Status**: Accepted, 2026-04-19
- **Relates to**: FR-MSG-*, FR-FRND-*, FR-ROOM-*, NFR-RELIABILITY-1, product-integrity audit 2026-04-19 (critical #3 – nine dropped events)

## Context

Product audit found that the server publishes nine WS event types the client never subscribes to:

- `friendship.removed`
- `user_ban.created`
- `user_ban.removed`
- `friend.request_cancelled`
- `room.admin_added`
- `room.admin_removed`
- `room.member_left`
- `room.member_removed`
- `room.deleted`

The symptom: moderation and friendship changes don't propagate live in the UI until a hard reload. Ban a user, the DM frozen banner doesn't appear until they reload. Remove someone from a private room, their sidebar still lists the room and WS still delivers new-messages to them until their socket reopens. That last one is also a privacy leak, not just a UI lag – the banned user keeps seeing the room's chat until their WS disconnects.

This happened because the server's event catalogue grew organically while the client's `WsProvider` subscribes to an explicit enumerated list. There is no mechanism that forces a new event type to register on both sides. The shared zod schemas in `@agora/shared/ws/events.ts` list the server-to-client events but are not wired to anything that would *require* a handler.

## Decision

Adopt a **handler-coverage contract** enforced by the type system:

1. The set of server-to-client WS event types is the single source of truth in `packages/shared/src/ws/events.ts`. Add a `ServerToClientEvent` discriminated-union type (sibling to `ClientToServerEvent` that already exists).

2. The client `WsProvider` exposes a handler registry typed as `Record<ServerToClientEvent['type'], (ev: Extract<ServerToClientEvent, { type: K }>) => void>`. The TS compiler rejects a `WsProvider` that is missing a handler for any member of the union.

3. For each of the nine uncovered events, decide on the minimum correct action:
   - `friendship.removed` → invalidate `['friends']`, `['friend-requests']`, `['conversations']`.
   - `user_ban.created` / `removed` → invalidate `['friends']`, `['user-bans']`; if the ban is *incoming* to the current user, invalidate `['conversations']` so the DM frozen banner paints.
   - `friend.request_cancelled` → invalidate `['friend-requests']`.
   - `room.admin_added` / `removed` → invalidate `['rooms','detail', roomId]`.
   - `room.member_left` / `removed` → invalidate `['rooms','detail', roomId]`; if the target is the current user, also invalidate `['conversations']` and `['rooms']`.
   - `room.deleted` → invalidate `['conversations']`, `['rooms']`; remove any open route pointing at the deleted room.

4. On the **server side**, a removed or banned user's open WS connections must `unsubscribeConnection(conn, roomTopic(roomId))` as part of the remove/ban transaction. The current code publishes `room.access_lost` but does not unsubscribe the socket – so the topic keeps fanning out to the banned user until their socket drops. Add the unsubscribe to `rooms/routes.ts` remove + ban handlers and to the `deleteRoom` flow.

5. Tests:
   - A shared-package unit test enumerates `ServerToClientEvent['type']` and asserts every member has a handler registered in `WsProvider`.
   - An integration test bans a user mid-session and asserts their socket receives no further `message.new` events on the room topic.

## Consequences

**Positive**

- Moderation, friendship, and room-lifecycle changes all propagate live. Product audit's critical finding is closed.
- The "banned user still receives room messages" privacy leak closes along with it.
- The compile-time coverage check means future server event types can't silently go unhandled; the type error is at the `WsProvider` definition site, not production.

**Negative**

- Each of the nine handlers is boilerplate. Acceptable; the boilerplate is the point – a handler is required, even if it's a one-liner `invalidateQueries`.
- The type-level enforcement requires `@agora/shared` to export the discriminated union, which it already does for `ClientToServerEvent`. Mirror work for the server-to-client side. Small.

**Alternatives considered**

- *Runtime check on WS `onmessage` – log a warning for unhandled types*: rejected – a warning in a prod log no-one reads is not enforcement. Catch it at compile time.
- *Generic "invalidate everything on every unknown event" fallback*: rejected – invalidating everything on every event is precisely what round 3's notification handler did not do (it set cache data directly because invalidate was too heavy). Keeping the contract explicit keeps invalidation scoped.

## Implementation

Landed in commit `<SHA>` on 2026-04-19. `@agora/shared` now exports a `serverToClientEvent` discriminated union plus the `ServerToClientEvent` / `ServerToClientEventType` inferred types. `apps/web/src/app/WsProvider.tsx` handles the nine previously-uncovered events (`friendship.removed`, `user_ban.created`/`removed`, `friend.request_cancelled`, `room.admin_added`/`removed`, `room.member_left`/`removed`, `room.deleted`) and a module-scope exhaustive switch over `ServerToClientEvent['type']` fails the build if a new event type lands upstream without a matching case (verified by temporarily adding a fake event to the union – tsc rejected `WsProvider.tsx`). Server side, `apps/api/src/rooms/routes.ts` now calls `unsubscribeConnection` on every live socket of the target user when a member is removed or banned, and on every prior member when a room is deleted – closing the privacy leak where a banned user kept receiving room messages until their WS naturally reconnected.
