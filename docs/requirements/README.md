# Requirements

One file per feature area. Each file narrows the spec (`docs/spec.md`) into:

1. **Scope** — which spec IDs this feature covers.
2. **Definition of done** — a one-paragraph completion test.
3. **Acceptance criteria** — concrete, testable steps.
4. **Out of scope** — what we explicitly are *not* building for this feature.
5. **Implementation hints** — library choices, data shapes, edge cases worth calling out.
6. **Open questions** — things we haven't decided yet; resolve before starting the plan.

Build order (when we move to implementation) loosely follows the numbering — auth before everything else, UI shell once routes exist, messaging once rooms exist, etc.

| # | Feature | Covers |
|---|---|---|
| 01 | [Auth and accounts](01-auth.md) | FR-AUTH-* |
| 02 | [Sessions and presence](02-sessions-presence.md) | FR-SESS-*, FR-PRES-* |
| 03 | [Contacts and friends](03-contacts.md) | FR-FRND-* |
| 04 | [Rooms](04-rooms.md) | FR-ROOM-* |
| 05 | [Messaging](05-messaging.md) | FR-MSG-* |
| 06 | [Attachments](06-attachments.md) | FR-ATT-* |
| 07 | [Notifications](07-notifications.md) | FR-NOTIF-* |
| 08 | [UI shell](08-ui-shell.md) | FR-UI-* |
| 99 | [Jabber federation (stretch)](99-jabber-federation.md) | ST-XMPP-* |
