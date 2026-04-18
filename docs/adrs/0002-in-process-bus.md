# ADR-0002 · In-process pub/sub bus over Redis

- **Status**: Accepted, 2026-04-18
- **Relates to**: AC-QUEUE-1, AC-SINGLENODE-1, NFR-PERF-1, NFR-CAP-1..3

## Context

We need a mechanism to fan out messages, presence transitions, and room events from the api to every interested WebSocket connection within seconds. NFR-CAP-1 asks for 300 concurrent users. NFR-PERF-1 asks for 3-second message delivery.

Two obvious options:

1. **In-process `EventEmitter`-style bus** — A `Map<topic, Set<subscriber>>` living in the Node process.
2. **Redis pub/sub** — An external service carrying the same semantics, enabling multi-process scale-out.

## Decision

Use an in-process pub/sub bus for the MVP. No Redis. Single-node deployment (AC-SINGLENODE-1).

- Single module `bus/bus.ts` exposes `publish(topic, event)` + `subscribe(topic, handler)`.
- Backed by `Map<string, Set<Handler>>`.
- Synchronous iteration on publish (cheap at MVP scale).
- Topic conventions: `room:<uuid>`, `dm:<uuid>`, `user:<uuid>`.

## Consequences

**Positive**:

- Zero external infra — one fewer container in compose, one fewer failure mode.
- Microsecond-level fan-out. Nowhere near saturating at 300 users.
- No serialisation hop for events consumed locally — handlers receive the same JS object the publisher produced.
- The Bus interface matches a trivial Redis adapter, so we can swap implementations later without changing call sites.

**Negative**:

- Does not scale past a single Node process. Two `api` instances would see disjoint event streams.
- No durability: a message published during a crash is lost (but that's an acceptable MVP trade-off — durable messages live in Postgres, delivery is best-effort).

**Escape hatch**:

- If ST-XMPP-* is implemented (multi-server federation) or if we need to scale beyond a single process, introduce a Redis-backed Bus implementation. The Bus interface stays. Consumers don't change. See ADR-0005 for how this plays with XMPP federation specifically.
