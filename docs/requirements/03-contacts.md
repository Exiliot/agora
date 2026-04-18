# Contacts and friends

## Scope

FR-FRND-1 to FR-FRND-6, FR-MSG-10 (personal message permission check).

## Definition of done

A user can search other users by username, send a friend request (optionally with a note), and receive requests as actionable notifications. Accepted requests create a bidirectional friendship; either side can unfriend. A user can ban another user; the ban blocks new personal messages in both directions, preserves existing history as read-only, and silently tears down the friendship.

## Acceptance criteria

- **Send request by username** — `POST /api/friend-requests` with `target_username` and optional `note`. Returns 201 + the request id. Idempotent: sending again before acceptance returns the existing pending request, not a second one.
- **Send request from room** — Clicking a member in a room's member list opens the same flow.
- **List incoming requests** — `GET /api/friend-requests?direction=incoming` returns pending requests addressed to me with sender + note + created_at.
- **List outgoing requests** — `GET /api/friend-requests?direction=outgoing` returns my pending requests.
- **Accept request** — `POST /api/friend-requests/:id/accept` creates two rows in a `friendships` table (or one row with a symmetric lookup, see implementation hints) and deletes the pending request. Broadcasts a `friendship_created` event to both users.
- **Reject request** — `POST /api/friend-requests/:id/reject` deletes the request. Sender is not notified (silent decline, per FR-FRND-4).
- **Cancel outgoing request** — `DELETE /api/friend-requests/:id` removes a pending request I sent. Recipient's notification disappears.
- **Unfriend** — `DELETE /api/friendships/:otherUserId` removes the friendship. Both users see the change; existing personal dialog becomes read-only on both ends (but is still visible) — matches the ban behaviour.
- **Ban another user** — `POST /api/user-bans` with `target_user_id`. Effects applied atomically in a transaction:
  - Insert a `user_ban` row (banner → target, directional).
  - Delete any pending friend requests between the two in either direction.
  - Delete the friendship if one exists.
  - Mark the personal dialog (if one exists) read-only for both users.
  - Broadcast a `user_banned` event to both users.
- **Unban** — `DELETE /api/user-bans/:id` removes the ban row. Does not automatically restore the friendship — users must re-send a friend request.
- **Personal message permission check (FR-MSG-10)** — Before accepting a new personal message between A and B, the server verifies (friendship exists) ∧ (no `user_ban` row in either direction). Checked at send time, not subscribe time — history already visible remains visible when a ban is applied later.
- **Search users** — `GET /api/users/search?q=foo` returns up to 25 users whose username starts with the query. Exclude users who have banned me (from my view) to avoid friend-request spam loops. Include users I have banned (I need to see them in order to unban).

## Out of scope

- Nickname aliases or display names (username is the identifier).
- Friend suggestions / recommendations.
- Groups / friend lists.
- Block-list import.
- Rich profile pages. `GET /api/users/:username` returns minimal shape: username, online presence, joined_at, optional short bio (not in MVP unless trivial).

## Implementation hints

- Friendship table: single row `user_a_id < user_b_id` with both ordered, or two rows (one per direction). Chose **single row with ordered UUIDs**: simpler consistency, one row per pair, enforced by a CHECK constraint.
- `user_ban` table is directional: `(banner_id, target_id)` is the PK. Directional matters because either side can be the initiator, and unbanning only removes *that* side's block. (The spec language in FR-FRND-6 treats the ban as asymmetric by nature: A bans B — not a mutual block.)
- Implement the personal-message permission as a single SQL view (`v_can_dm`) returning `(user_a_id, user_b_id, allowed: bool)` so the server has one authoritative check.
- Friend request events and ban events go through the same WS pub/sub bus as messages — see `docs/ws-protocol.md`.

## Open questions

- [ ] Do we show "X rejected your request" to the sender? Spec says silent decline. Sticking with silent for MVP.
- [ ] Does banning make me invisible in the target's search results? Spec hedges (FR-FRND-6 marks "optional hardening"). Default: yes, hide from the banned user's search — prevents harassment loops. Banner still sees target (to unban).
