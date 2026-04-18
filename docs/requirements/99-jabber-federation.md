# Jabber / XMPP federation (stretch)

## Scope

ST-XMPP-1 to ST-XMPP-4.

## Prerequisite

§2 and §3 of `docs/spec.md` are green end-to-end on a single server. No pickup of this feature before the core passes.

## Definition of done

A second backend instance runs alongside the first in docker-compose. Both instances expose an XMPP endpoint through a Prosody sidecar. A standard XMPP client can connect to either server, chat with a user on the *same* server, and chat with a user on the *other* server (federation via s2s). An admin UI tab shows connection and federation-traffic statistics. A load-test script demonstrates 50+ clients on each server messaging across.

## Acceptance criteria

- **XMPP sidecar** — A Prosody container runs next to each `api` service. Configured for:
  - `c2s` on 5222 (client-to-server)
  - `s2s` on 5269 (server-to-server federation)
  - `MUC` (multi-user chat) for rooms
  - A minimal auth backend that accepts the same users as agora (via internal HTTP to our api's `/internal/xmpp/auth` endpoint, or by mirroring users into Prosody's auth store at registration/login).
- **User ↔ JID mapping** — `user@<server-domain>`. Usernames were already constrained at registration to JID-safe format (see requirements file 01).
- **Room ↔ MUC mapping** — Each agora room maps to an MUC room on the same Prosody. Messages sent via agora's WS are mirrored to MUC; messages sent via MUC are mirrored back into agora.
- **Federation** — Two Prosody instances trust each other via shared certs or a test CA in the compose file. DNS resolution inside the compose network points `server-a.agora.test` and `server-b.agora.test` at the respective containers.
- **Message flow** — A user on server A can send a direct message to a user on server B; the message appears in both users' agora UIs. A user on server A can join an MUC on server B (where supported).
- **Presence flow** — Presence from a JID on server A is visible to subscribed users on server B.
- **Admin UI tab (ST-XMPP-4)** — A new top-level admin route shows: list of active s2s connections (peer server, established_at, bytes in/out), list of c2s connections (jid, bytes in/out), federation event log (last 100 events), aggregate counters.
- **Load test (ST-XMPP-3)** — A script under `tools/load-test-federation/` spins up 50+ XMPP clients on each server using a Node XMPP library, joins them to a shared MUC, and broadcasts messages. Test passes if 95% of messages arrive at 95% of recipients within 5 seconds.

## Out of scope

- Full XEP compliance beyond MUC + s2s + basic presence.
- PubSub, MAM (archive management), carbons — nice-to-have, not required.
- XMPP over BOSH / WebSocket for browser clients (we use our own WS).
- Server discovery beyond hard-coded DNS in compose.
- TLS to real CAs — use a self-signed test CA committed to the repo.

## Implementation hints

- **Prosody** is the friendliest XMPP server for a short event: Lua config, easy Docker image, modular (`mod_muc`, `mod_s2s`), good OSS docs. ejabberd is more capable but significantly more config.
- **Bridging strategy** — Treat Prosody as the source of truth for wire-level XMPP. Our api is the source of truth for agora's database. The bridge is a one-way subscription per direction:
  - **Outbound**: api subscribes to its own in-memory bus and for each room/dm message, issues an XMPP stanza via a small XMPP client in the api process.
  - **Inbound**: api exposes an HTTP webhook that Prosody calls (via `mod_rest` or similar) whenever an MUC receives a message originating from a remote server; api persists and broadcasts.
- **Certs** — Use `mkcert` or a tiny script to generate a test CA + two server certs, check into `tools/pki/`. Prosody trusts the test CA. Clear comment: "test CA, never use in production".
- **Load test** — `@xmpp/client` has a reasonable Node client. Script spawns N clients concurrently against each server; measures latency and loss.

## Open questions

- [ ] Do we federate full-duplex, or is one-way enough for the demo? Target full-duplex.
- [ ] Should messages originating from federated JIDs be flagged visually in agora's UI ("federated")? Yes — a small `federated` badge next to the author name helps demo understandability.
