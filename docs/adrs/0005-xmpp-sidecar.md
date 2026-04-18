# ADR-0005 · XMPP federation as a sidecar, not a retrofit

- **Status**: Accepted (for Phase 2), 2026-04-18; **In progress on the `phase2-xmpp` branch**
- **Relates to**: ST-XMPP-1..4, AC-QUEUE-1, requirements file 99

## Context

The spec offers an optional stretch: Jabber/XMPP support with two-server federation and a load test. Two strategies exist:

1. **Retrofit**: make our own WS protocol speak XMPP. Our identity model, presence model, and message model conform to XMPP semantics. The api process becomes (or hosts) an XMPP server.
2. **Sidecar**: run a real XMPP server (Prosody or ejabberd) beside the api. Bridge messages/presence between the two via a narrow interface.

The retrofit path means every MVP design decision must be defensible under XMPP semantics (JID escaping, resource binding, stanza routing, s2s auth, DNS SRV, etc.). Massive scope creep for a two-day event — and if we don't get to Phase 2 at all, the main app pays the abstraction tax for no benefit.

## Decision

Go sidecar. The MVP makes two cheap concessions up front so the sidecar path stays clean; the actual XMPP implementation is deferred until the core is green end-to-end.

### Concessions made up front in the MVP

1. **Usernames are JID-safe at registration**. `[a-z0-9._-]{3,32}`, must start with a letter, no reserved glyphs. Zero cost in the MVP; saves a migration when Phase 2 lands.
2. **The in-process bus has a stable interface.** `publish(topic, event)` + `subscribe(topic, handler)`. A Phase 2 XMPP bridge becomes one more subscriber. No invasive refactor.

### Phase 2 topology

- Add a Prosody container per backend in docker-compose. Prosody exposes 5222 (c2s) and 5269 (s2s).
- Prosody's auth module delegates to the api via HTTP (`POST /internal/xmpp/auth` with `username+password` → 200/401).
- The api subscribes to its own bus and mirrors room/dm messages into Prosody via a small in-process XMPP client (`@xmpp/client`).
- Prosody forwards inbound MUC/DM messages to the api via `mod_rest` (or a custom module) hitting `POST /internal/xmpp/inbound`. The api persists them and publishes to the bus for local WS subscribers.
- Two Prosody instances trust each other via a committed test CA + certificates. Compose networking provides stable DNS names (`server-a.agora.test`, `server-b.agora.test`).

### Load test

A separate `tools/load-test-federation/` script using `@xmpp/client` in Node spawns 50+ clients against each server and measures message latency/loss across the federation.

## Consequences

**Positive**:

- MVP stays cleanly scoped. Phase 2 adds features without breaking existing ones.
- Prosody is a mature, well-documented XMPP server; we inherit correctness for free.
- The sidecar bridge is the only code we write for XMPP semantics; everything else is configuration.

**Negative**:

- Two sources of truth during Phase 2: agora's DB and Prosody's runtime state (rosters, MUC membership). We accept eventual-consistency for federation — the agora DB is authoritative, Prosody mirrors a subset.
- Test CA + s2s certificates are annoying to set up the first time. Mitigation: commit a working set of certs under `tools/pki/`, with a regeneration script.

**Tradeoffs not taken**:

- **Full XMPP compliance** — we aim for MUC + basic presence + s2s + 1:1 messaging. MAM (archive), PubSub, BOSH, and carbons are out of scope.
- **Using XMPP as our primary protocol** — would require a massive redesign and is not the brief.

## Upgrade path

If the hackathon ends without Phase 2 being implemented, this ADR remains `Accepted` as the agreed strategy. A future Phase 2 opens a plan file (`docs/plans/phase2-xmpp.md`) that executes the topology above with no ADR revision needed.

## Implementation progress on `phase2-xmpp` branch

Captured in `docs/journal/2026-04-18-xmpp-spike.md`. Summary: Prosody container + HTTP-auth hook into agora is a ~day of work; full two-server federation with load test is 2–3 days including debugging.
