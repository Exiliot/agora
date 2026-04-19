# Architecture Decision Records

Nygard-style ADRs for the decisions whose reversal would be expensive or contentious later. Each one has a status, context, decision, and consequences.

Rules:

- **Immutable once accepted.** If a decision changes, supersede with a new ADR and mark the old one accordingly — don't rewrite history.
- **One decision per ADR.** Don't bundle.
- **Links over prose.** Cross-reference requirements (`docs/requirements/*`) and spec IDs (`FR-*`, `AC-*`) wherever possible.

## Index

| # | Title | Status |
|---|---|---|
| 0001 | [Server-side sessions, not JWT](0001-server-side-sessions.md) | Accepted |
| 0002 | [In-process pub/sub bus over Redis](0002-in-process-bus.md) | Accepted |
| 0003 | [Presence state machine aggregated from per-tab heartbeats](0003-presence-state-machine.md) | Accepted |
| 0004 | [pnpm workspace monorepo](0004-monorepo-layout.md) | Accepted |
| 0005 | [XMPP federation as a sidecar, not a retrofit](0005-xmpp-sidecar.md) | Accepted |
| 0006 | [`message.send` idempotency via client-supplied reqId](0006-message-send-idempotency.md) | Proposed |
| 0007 | [WebSocket `Origin` validation and cross-origin policy](0007-ws-origin-validation.md) | Accepted |
| 0008 | [Modal and popover heading + focus contract](0008-modal-popover-contract.md) | Proposed |
| 0009 | [Client WS event-handler coverage contract](0009-ws-event-handler-coverage.md) | Proposed |
| 0010 | [Password-reset link logging in demo mode](0010-demo-mode-reset-link-logging.md) | Accepted |
