# 2026-04-19 · Design audit round 3

Claude Design came back with 26 new findings against commit `9bdb42e`. Round 2's bundle was closed out: R2-02, R2-07, R2-08 and R2-S2 landed in the previous round; R2-01 was local-doc drift (the audit document's own `:root` still carrying stale tokens) – same class of finding appeared again this time and was ignored for the same reason.

## Batch structure

Primitives first, surfaces second, a11y and DS adoption third, a small polish trail fourth. Rule of thumb: if a later finding would be cleaner once a DS primitive existed, promote the primitive in batch 1 and let batches 2 and 3 consume it. That avoided a "now rewrite it" step twice.

## Findings

- R3-01 ImageLightbox paper moved onto a new `paperOnScrim` token; no more raw `#fff` on the overlay.
- R3-02 Jump-to-latest pill rebuilt on `Button variant="primary" size="sm"`; drops the hand-rolled div.
- R3-03 DeleteConfirm dialog deleted; message delete now routes through `ConfirmModal` with the standard prose shape.
- R3-04 RoomHeader slimmed to `# name` plus the private padlock; dossier in the right aside carries the description.
- R3-05 `#` and `@` sit flush against the name everywhere (IRC convention) – header, dossier, sidebar invitations, DM header, ManageRoom tabs, public rooms list, notification rows in-app and native.
- R3-06 Composer reply chip and attachment chip close buttons switched to `IconButton` (20 px).
- R3-07 "Start of conversation" marker is now the DS `DaySeparator` with a label slot; day breaks share the primitive.
- R3-08 InlineEditor for message edits moved onto the `Textarea` primitive.
- R3-09 E2E selectors updated for the flush-glyph prose.
- R3-10 NotificationMenu's permission-prompt anchor became a `Button variant="link"` instead of a raw anchor.
- R3-11 Notification menu closes on window resize or any ancestor scroll – the fixed `anchorRect` was drifting otherwise.
- R3-12 New `--row-hover` token and a shared `.ds-row-hoverable` class; Contact/Room list items and `ListRow` all pick up the same wash.
- R3-13 `LockIcon` promoted to DS; new `RoomName` primitive unifies the glyph across ChatView header, dossier, sidebar and the invitations list. Dropped the redundant "private" `Badge` in invitations.
- R3-14 Sidebar filter placeholder trimmed to `Filter…` from the longer prose.
- R3-15..R3-18 landed as part of the batch-1 primitive drop: `Textarea`, `IconButton`, `EmptyState`, `Spinner`, and `DaySeparator` now live in the DS with proper exports.
- R3-19 Logo badge stopped leaning – italic dropped so both halves read upright.
- R3-20 Bell shrunk to a 28×28 square; unread badge is absolutely positioned at the top-right corner rather than shoving the icon wider.
- R3-21 AFK presence swatch redrawn in SVG (outlined square + filled top-left triangle); border no longer wraps the transparent half.
- R3-22 NotificationRow relative-time now comes from `Intl.RelativeTimeFormat`; the hand-rolled helper is gone.
- R3-23 `<main id="main">` picks up `tabIndex={-1}` plus a focus ring so the skip-link actually lands visibly.
- R3-24 Composer gained a subtle `body.length/MAX_MESSAGE_BODY` counter once past 80% of the 3072-char cap; flips to `danger` and disables Send once over. `MAX_MESSAGE_BODY` now exported from `@agora/shared` so client and server can't drift.
- R3-25 Modal body padding defaults to 20 (up from 16); new `dense` prop drops back to 12 for compact forms. No consumers opted in yet – the 20 default looked right everywhere.
- R3-26 CreateRoomDialog added a mono-11 helper line under each visibility radio spelling out what Public and Private mean.

R3 also flagged two local-doc drifts (audit markup still carrying stale tokens, same class as R2-01) which stay ignored.

## Takeaways

- The moment a helper has a second caller, promote it to the DS. `DaySeparator` and `LockIcon` were both local for a single view; round 3 wanted each in two more places and pulling them up first made the consumer edits trivial. Round 2 had the same pattern with `ContactListItem` pulling `Presence` inline.
- `Intl.RelativeTimeFormat` removes a whole class of coarseness bugs. The hand-rolled "3 minutes ago / 4 hours ago / yesterday" ladder had subtle off-by-one windows at every boundary; one `rtf.format(-n, unit)` call picks the right unit honestly without any threshold table to maintain.
- The 44×28 Bell from round 2 was a local fix that papered over the real bug: the unread badge was sitting in the flow and pushing the icon over. 28×28 with `position: absolute` on the badge is the right shape – the badge floats above the icon instead of shoving it.

## Commits

- `a034575` – Batch 1: DS primitives (Textarea, IconButton, EmptyState, Spinner, DaySeparator).
- `dd2d156` – Batch 2: chat surface polish (R3-01..R3-09).
- `1ff0ebc` – Batch 3: DS adoption + a11y (R3-10..R3-14, R3-19..R3-23).
- `2d53258` – Batch 4: composer counter, modal padding, room visibility hint (R3-24..R3-26).
