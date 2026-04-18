# 2026-04-18 · Attachments feature module

Implementation of the attachments surface: upload, metadata, authenticated
download, orphan sweep, and room-deletion cascade. Built in an isolated
worktree alongside the other feature agents.

## Scope delivered

- `apps/api/src/attachments/storage.ts` – disk helpers. `hashPath` builds the
  `<root>/<hash[0:2]>/<hash[2:4]>/<hash>` layout; `writeStreamToStorage`
  streams a multipart body through a SHA-256 Transform to a temp file, then
  renames to the content-addressed path (or discards on dedupe).
- `apps/api/src/attachments/routes.ts` – `POST /api/attachments` (multipart),
  `GET /api/attachments/:id`, `GET /api/attachments/:id/download`. Multipart
  is registered inside the scoped plugin so `server.ts` stays untouched.
  Access control reuses `canAccessRoom` and `canAccessDm` from
  `messages/permissions.ts` – orphan attachments are visible only to the
  uploader.
- `apps/api/src/attachments/sweeper.ts` – `sweepOrphans()` plus a 15-minute
  `setInterval` scheduled on module import. Skips scheduling under
  `NODE_ENV=test` so the vitest run doesn't leave a timer live.
- `apps/api/src/attachments/bus-handlers.ts` – wraps `bus.publish` to
  intercept `room.deleted` events and delete attachment bytes in the
  background. Wrapper is additive: it always delegates to the original
  `publish` so other subscribers keep receiving events.
- `apps/api/tests/integration/attachments.spec.ts` – 12 tests covering
  `hashPath`, buffer round-trip, orphan/attached access rules, room-deleted
  cascade fires only for the matching event type, and an empty-orphan sweep.
- `apps/api/src/routes/index.ts` – three new side-effect imports
  (`routes.js`, `sweeper.js`, `bus-handlers.js`).

## Key decisions

- **No server.ts edit.** `@fastify/multipart` is registered inside the
  scoped plugin so the feature adds zero top-level wiring. The brief left
  the choice open; keeping the blast radius small wins.
- **Bus cascade via publish-wrapper.** The in-process bus subscribes by
  exact topic (`room:<uuid>`), and rooms publish `room.deleted` on that
  per-room topic. Without a wildcard API we'd have to either enumerate
  every room at boot or modify `bus.ts`. Both are off-limits for this
  feature, so bus-handlers wraps `bus.publish` once on import and routes
  `room.deleted` events into the cascade worker. Delegating to the
  original publish first keeps every existing subscriber working.
- **Temp file + rename for atomicity.** The hasher sits on the pipeline
  between the multipart stream and the temp file so a single pass yields
  both bytes-on-disk and the content hash. `rename` inside the same
  filesystem mount is atomic, so a crashed upload can never land at the
  content-addressed path.
- **Dedupe by content.** If the hash already exists on disk we delete the
  temp file and keep the existing bytes. The DB row for the new upload
  still inserts – two attachments can share a hash. Bytes are only deleted
  once the final row referencing them goes away (see sweeper's re-check
  after row deletion).
- **Image cap enforced after the upload.** `@fastify/multipart` truncates
  at `MAX_FILE_BYTES` (20 MB), so we rely on the post-hoc size check to
  enforce the 3 MB image cap. The write still happens but the response is
  413; dedupe keeps the bytes if someone else earned them, otherwise we
  purge.
- **Cache-Control on download.** `private, max-age=0, must-revalidate`:
  access can be revoked at any time (ban, removal, room deletion), so we
  never let a CDN or browser hold a stale copy past the next request.
- **Test strategy.** Matches the messages and rooms feature modules: mock
  `db/client.js` with a chain object, assert on the permission helpers and
  event wiring. Full DB-backed behaviour is deferred to the Playwright
  smoke once the clients for upload/download land.

## Cross-agent notes

- The messaging WS handler (`message.send`) accepts `attachmentIds` but
  currently doesn't link them to the inserted message – the rooms journal
  calls this out. Attaching happens via a DB update from `messageId: null`
  to the new message id. That write belongs in the messages module's
  transaction and is still pending; ownership check + per-message cap
  (`MAX_ATTACHMENTS_PER_MESSAGE`, shared) enforce on that path.
- Room deletion in `apps/api/src/rooms/routes.ts` deletes the `rooms` row
  but does not cascade the `messages` rows (messages use a polymorphic
  conversation key, no SQL FK). The brief assumed FK cascade; in practice
  the rooms module should add an explicit `delete messages where
  conversation_type = 'room' AND conversation_id = ?` in its transaction.
  Out of scope for this feature; my cascade handler already identifies
  the right set of attachment bytes by that same polymorphic lookup.
- The `bus.publish` wrapper is additive – removing this module has no
  side-effects on other subscribers. If the bus ever grows a real
  wildcard API, swap the wrapper for a clean `bus.subscribePattern('room:*',
  …)` in a one-file change.

## Verification

- `pnpm --filter @agora/api typecheck` – clean.
- `pnpm --filter @agora/api test` – 40 passed (12 new), 5 files.
- Root `pnpm typecheck` is red on `apps/web` only, and that's a pre-
  existing missing-node_modules issue in the web workspace, not anything
  my feature introduced.
- No DB-backed run: end-to-end coverage belongs in the Playwright smoke
  once the web client can drive uploads.

## Takeaways

- Content-addressed storage makes dedupe trivial and recovery after a
  crash obvious: either the path exists or it doesn't, with no in-flight
  state to reconcile. The temp-file staging is one line more than a
  naive direct write and pays for itself the first time a crash happens.
- The scoped plugin pattern already in use for rooms/messages keeps
  feature agents fully decoupled from `server.ts`. Registering multipart
  inside the scope means another agent could add a different multipart
  config for, say, avatars without us tripping over them.
- The bus's lack of a wildcard subscribe is a real limitation the moment
  you want cross-feature event cascades. Wrapping `publish` is pragmatic
  but isn't a pattern I'd repeat for a third consumer – at that point
  the bus grows a `subscribeAny(handler)` method.
