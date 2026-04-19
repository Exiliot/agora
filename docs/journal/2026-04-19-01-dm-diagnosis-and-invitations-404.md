# 2026-04-19 · DM "not allowed" report + phantom invitations 404s

Two bugs the user surfaced from a single screenshot: (a) bobthebuilder trying to send a DM to wefflerer and getting "Send failed – not allowed", and (b) the DevTools console showing a steady stream of `GET /api/invitations → 404` entries.

## Bug 1: DM send reported "not allowed"

The screenshot showed bob composing `mama myla ramu lol omg` after receiving wefflerer's `ahahahaha`. Send failed with the in-app Toast `Send failed – not allowed`. The API side's error path is `apps/api/src/messages/ws-handlers.ts`: a failed permission check goes through `sendErr(ctx, reqId, permission.code, 'not allowed')`. The server sends back `{ type: 'err', payload: { reqId, code, message: 'not allowed' } }` and the client `wsClient.ts` reads `err.message` only, so the Toast body was the generic string without the code.

Database state at diagnosis time:
- `friendships` row between bob and wefflerer, `established_at 2026-04-18 21:56:48+00`.
- `dm_conversations` row between them, `created_at 21:56:52+00` (four seconds after the friendship, as expected – `/api/dm/open` requires `canSendDm` which requires the friendship).
- No `user_bans` row in either direction.

With that state, `canSendDm(bob, wefflerer)` should return `{ ok: true }`. And the symmetric direction worked at the same moment (wefflerer's message got through just fine). So the reported failure wasn't reproducible from the current DB state.

What landed anyway, because "not reproducible" isn't "fine":

- `apps/api/src/messages/ws-handlers.ts`: added a `console.error('[message.send denied]', { userId, conversationType, conversationId, code })` at the permission-denial branch. Mirrors the reset-link logging pattern – operator-visible even under `NODE_ENV=production`.
- `apps/web/src/lib/wsClient.ts`: the rejected `Error` from a failed RPC now reads both `message` and `code` from the server's err payload and builds `"{message} ({code})"`. If this ever recurs the Toast will say `Send failed – not allowed (not_friend)` or similar and we'll have the exact branch in the log.

Attempted a live reproduction after those changes landed. Reset bob's password via the fresh forgot-password flow, signed in, sent a DM to wefflerer. It worked. No denial fired. The original screenshot's failure remains unexplained – best guesses are a transient WS session race (bob's socket was authenticated against a session that got deleted mid-flight by the password reset we'd just been exercising), or one of the two users had a previously deleted friendship and a stale DM row – but neither hypothesis matched the DB state at the time of diagnosis.

Diagnostic path is in place if it comes back.

## Bug 2: the phantom `/api/invitations` 404 flood

Easier. `apps/web/src/features/rooms/useRoomAdmin.ts:19`:

```ts
const body = await api.get<{ invitations: RoomInvitationView[] }>('/invitations');
```

Nothing on the server answered that path. The API only had `POST /api/invitations/:id/accept` and `POST /api/invitations/:id/reject`. Every tab that mounted `ContactsPage` or any route that polled `useMyInvitations` hit a 404; React Query retried a few times, multiplying the noise.

Added `GET /api/invitations` to `apps/api/src/rooms/routes.ts` alongside the existing accept / reject handlers. It lists pending room invitations for the caller, joined with the inviter's `userPublic`, with a correlated `memberCount` subquery to satisfy `roomSummary`. Newest first (`createdAt DESC`).

Verified via curl:

```
$ curl -s -b <bob-cookies> http://localhost:3000/api/invitations
{"invitations":[]}
```

and the console flood is gone.

## Committed together

One commit, `7257a69 fix: add missing /api/invitations list endpoint and improve WS error surface`. Three files: the new route, the server log line, the client Error assembly. Not split because they share a single framing ("better diagnostics for the two things the user saw in one screenshot") and splitting would have meant three PR-sized commits for a demo.

## Takeaways

- The WS RPC error plumbing was losing the `code` on the way to the UI. Surfacing it cost two lines and makes every future "Send failed – why?" report self-diagnosing.
- `useMyInvitations` predated the HTTP endpoint it called. A dev smoke that exercised every query hook on app load would have caught this. Left as a note for a later "health-check" pass.
- The DM report is a reminder that "not reproducible" is a legitimate state. Instead of chasing a ghost, upgrade the diagnostic surface and move on.
