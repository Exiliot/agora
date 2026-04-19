# ADR-0006 · `message.send` idempotency via client-supplied reqId

- **Status**: Proposed, 2026-04-19
- **Relates to**: FR-MSG-1, FR-MSG-2, performance audit 2026-04-19 (H1), product-integrity audit 2026-04-19 ("sent twice after reconnect")

## Context

The WS `message.send` handler at `apps/api/src/messages/ws-handlers.ts` generates a fresh `uuidv7` server-side for every incoming event and inserts the row unconditionally. A WS retry under flaky network – which the client's reconnect + backfill flow is allowed to trigger – produces two rows.

This surfaces in two ways:

1. **Exact-double-send**: user hits Enter, socket stalls, client reconnects, Composer's retry buffer re-sends the same payload. Two rows, same author, same body, consecutive timestamps.
2. **Near-double-send on backfill**: after reconnect the client fetches `/api/conversations/:type/:id/messages?since=<last>`. If the original `message.send` ack arrived but the `message.new` fan-out was lost across the reconnect window, the client sees the message for the first time via the backfill *and* the Composer's retry, and renders both.

Product audit called this user-visible but not catastrophic; performance audit called it high-severity because it's also the vector for trivially spamming the messages table.

The Composer's client-side `ws.request('message.send', ...)` already generates a correlation `reqId` per call. That reqId is reused on retry inside the client `wsClient.ts` – but the server does not consult it for idempotency. Simple to fix: key a short-TTL dedupe on `(author_id, reqId)`.

## Decision

Adopt **client-supplied reqId as an idempotency key** for `message.send`. Server behaviour:

1. The WS `message.send` payload schema is extended: the `reqId` on the envelope is already there; add a dedicated `clientMessageId: string` optional field on the payload itself (UUID string). If absent, server generates one and returns it in the ack (same as today).
2. On insert, the server records `(author_id, client_message_id)` with a short TTL in an in-memory LRU (`Map<key, { messageId, expiresAt }>`, 1000 entries, 60 s TTL). A second send with the same key inside the TTL returns the **original** `messageId` in the ack – no new row.
3. A unique index `messages(author_id, client_message_id) WHERE client_message_id IS NOT NULL` backstops the LRU. If two replicas ever race, Postgres wins and the duplicate gets `23505`; server catches, looks up the original by `(author_id, client_message_id)`, and returns its hydrated view.
4. `clientMessageId` is never exposed outside the author's ack. It is NOT part of `MessageView` – recipients don't see it.
5. Client `wsClient.ts` already has retry-with-same-reqId semantics; surface `clientMessageId` in the Composer's send call so retries carry the same key.

## Consequences

**Positive**

- Retry-safe sends with no user-visible duplicates under any normal flaky-network condition.
- Backstopped by a DB constraint, so race-between-nodes never produces dupes even if the LRU is cold.
- One new column + one unique index; zero changes to the `MessageView` shape; zero changes to recipient-side handling.
- Composes cleanly with the existing ack-carries-hydrated-view pattern.

**Negative**

- New column with its own unique index (partial – `WHERE client_message_id IS NOT NULL`). Trivial storage cost.
- One new in-memory structure; needs size cap and TTL expiry. Not a scaling issue at MVP.
- Clients that ignore the server's ack and don't reuse `clientMessageId` on retry still get a new row. We don't fix that at the server; we fix the one client we ship.

**Alternatives considered**

- *Server-dedupe by `(author_id, body_hash, conversation_id)` in a 5 s window*: rejected – collides on the perfectly-legitimate "yes" followed by "yes" from the same user. The author controls what counts as "the same send" via reqId; that's a clearer contract.
- *Best-effort in-memory only, no DB backstop*: rejected – in an HA world without a shared LRU the race window grows with replica count. The unique index is cheap insurance.
