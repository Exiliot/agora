# ADR-0003 · Presence state machine aggregated from per-tab heartbeats

- **Status**: Accepted, 2026-04-18
- **Relates to**: FR-PRES-1..6, AC-PRESENCE-1, NFR-PERF-2

## Context

The spec's presence model is non-trivial:

- `online` if *any* tab has had user interaction in the last minute.
- `afk` if all tabs have been idle >1 min but at least one tab is open.
- `offline` if all tabs have closed or been offloaded.
- Must propagate within 2 s (NFR-PERF-2).

Denis explicitly noted in the kickoff that tracking presence in the DB causes heavyweight queries and doesn't scale. AC-PRESENCE-1 forbids DB-backed presence.

A naive per-connection online/offline model fails:

- If we mark the user offline on socket close, opening a second tab temporarily flips them offline then back to online (flicker).
- If we rely on the DB for per-tab state, we churn writes on every heartbeat.

## Decision

Presence is maintained as an in-memory data structure per user, populated from per-tab heartbeats. The derived state is computed by a periodic sweeper and broadcast via the pub/sub bus.

### State shape

```ts
type TabId = string;
type UserId = string;

interface TabState { lastActivityAt: number }       // ms since epoch
const presence: Map<UserId, Map<TabId, TabState>> = new Map();
const lastBroadcast: Map<UserId, 'online'|'afk'|'offline'> = new Map();
```

### Transitions

Happen on:

- **WS connect** (`hello`): register `(userId, tabId)` with `lastActivityAt = now`. Tab ids are client-generated GUIDs persisted in `sessionStorage`; reconnects re-use the same id, so a bounce within a short window doesn't count as "tab closed".
- **WS `heartbeat`** event: update `lastActivityAt`. Clients debounce to once every 5 seconds.
- **WS close**: schedule the tab for removal with a 30-second grace period. If a `hello` with the same tab id arrives within that grace, cancel the removal.
- **Sweeper** every 2 s: for each user, recompute the aggregate state:
  - no tabs left → `offline`, emit event, clear the user from the map.
  - at least one tab with `(now - lastActivityAt) <= AFK_THRESHOLD` → `online`.
  - else → `afk`.

### Broadcast

Publish `presence.update` on the bus with topic:

- `user:<subscriberId>` for each subscriber interested in this user's presence — computed as: users who have this one as a friend, or who share an open room with this one.

Subscribers maintain their own map; the initial `presence.snapshot` is sent after `hello`.

## Consequences

**Positive**:

- Meets the 2 s latency target comfortably — sweeper runs every 2 s, events fan out through the bus in microseconds.
- Zero DB traffic for presence.
- Multi-tab semantics correct by construction: aggregate over the tab map, flicker prevented by the grace period on close.

**Negative**:

- In-memory state is lost on process restart. On boot, all users start as offline until their tabs reconnect (which happens within seconds via WS reconnect backoff).
- Single process assumption (see ADR-0002). If we scale out, presence aggregation crosses processes and needs reconciliation.

**Edge cases covered explicitly**:

- Rapid open/close of the same tab id within 30 s is a no-op for presence.
- A client with a hung tab (browser throttling background tabs) stops sending heartbeats; the user transitions to AFK after 60 s. That's the intended signal.
- A client that goes offline entirely (laptop lid close) triggers WS close; after 30 s grace + sweep, presence goes offline.

## Tuning knobs

Exposed as env variables so tests can tighten them:

- `PRESENCE_SWEEP_INTERVAL_MS` (default 2000)
- `PRESENCE_AFK_THRESHOLD_MS` (default 60_000)
- `PRESENCE_TAB_GRACE_MS` (default 30_000)
