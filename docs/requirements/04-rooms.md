# Rooms

## Scope

FR-ROOM-1 to FR-ROOM-16, FR-UI-5 (admin UI is delivered as part of this feature).

## Definition of done

Users can create public or private rooms, discover public rooms via a searchable catalogue, join/leave rooms, invite others to private rooms, and (if owner/admin) moderate via a modal dialog with tabs for members, admins, banned users, invitations, and settings. Room deletion cascades messages and attachments permanently.

## Acceptance criteria

- **Create room** — `POST /api/rooms` with name, description, visibility. 201 + room. Creator is inserted as `owner` member with `role = owner`. Admins list contains the owner implicitly.
- **Name uniqueness** — Name is globally unique (public + private combined). Attempted duplicate returns 409.
- **Public catalogue** — `GET /api/rooms?visibility=public&q=<search>` returns up to 50 public rooms with name, description, member_count. Default sort: member_count desc.
- **Join public room** — `POST /api/rooms/:id/join`. If not banned, adds caller as a member with role `member`; broadcasts `room_member_joined`. If banned, 403.
- **Private rooms not in catalogue** — `GET /api/rooms?visibility=public` never returns a private room, even if the caller is a member. `GET /api/rooms/mine` returns all rooms I belong to (public + private).
- **Leave room** — `POST /api/rooms/:id/leave`. Owner cannot leave — returns 409 with a machine code. Members can leave freely; broadcasts `room_member_left`.
- **Delete room** — `DELETE /api/rooms/:id` permitted only to the owner. Transaction: deletes messages, deletes attachment file rows, schedules file bytes for async deletion from disk (to keep the request fast), deletes invitations, deletes memberships, deletes the room. Broadcasts `room_deleted` to all members.
- **Invite to private room** — `POST /api/rooms/:id/invitations` with `target_username`. Creates a pending invitation, broadcasts to the target as a notification.
- **Accept invitation** — `POST /api/invitations/:id/accept`. Adds caller as a member of the target room, deletes the invitation.
- **Reject invitation** — `POST /api/invitations/:id/reject`. Deletes the invitation. No further notification.
- **Admin promote** — `POST /api/rooms/:id/admins` with `user_id`. Permitted to owner only. Target must be a current member. Inserts the user's membership `role` transition to `admin`.
- **Admin demote** — `DELETE /api/rooms/:id/admins/:userId`. Owner may demote any admin. Admins may demote other admins. Nobody may demote the owner.
- **Member remove = ban** — `DELETE /api/rooms/:id/members/:userId`. Permitted to owner and admins. Inserts a `room_ban` row (banner_id, target_id, room_id, created_at) and deletes the membership. Target receives a `room_member_removed` event. Treated identically to a ban going forward (FR-ROOM-13).
- **Unban** — `DELETE /api/rooms/:id/bans/:userId`. Removes the ban row. Target can now rejoin (if public) or be re-invited (if private).
- **Ban list view** — `GET /api/rooms/:id/bans` returns banned users with banner's username and timestamp. Permitted to owner + admins.
- **Moderation modal** — Frontend exposes the room-management UI as a modal with tabs (Members, Admins, Banned, Invitations, Settings) per the Claude Design screen in `docs/design/screens/modals.jsx`.
- **Access loss side effects** — When a user is banned, removed, or their account is deleted, their client receives a `room_access_lost` event for that room. The UI immediately closes the room view, removes attachments from any cached state, and refreshes the room list.

## Out of scope

- Room categories / tags.
- Pinned messages.
- Thread channels within rooms.
- Soft-delete / room archival.
- Ownership transfer.
- Scheduled messages.
- Room search by member (only name + description).

## Implementation hints

- `rooms` table: id, name (UNIQUE), description, visibility ENUM('public','private'), owner_id, created_at, deleted_at (nullable but MVP never soft-deletes — it's there only if we relax later without migration).
- `room_members` table: (room_id, user_id) PK, role ENUM('owner','admin','member'), joined_at. The owner's membership is inserted at room creation; their role is `owner` and is the only one with that value per room (check constraint).
- `room_bans` table: (room_id, target_id) PK, banner_id, reason (nullable), created_at.
- `room_invitations` table: id, room_id, target_id, inviter_id, created_at. On accept, insert membership and delete the invitation row.
- The public catalogue query should be: `SELECT r.*, (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) AS member_count FROM rooms WHERE visibility='public' AND name ILIKE '%q%' ORDER BY member_count DESC LIMIT 50;`. Consider a materialised `room_member_counts` table if we see slow queries at 1000-member scale.
- All join/leave/ban operations emit events to the in-process bus; WS clients with the room open update their member list and the side panel without a refetch.

## Open questions

- [ ] Do admins see other admins' IP addresses anywhere? No — the sessions view is strictly "my own" per FR-SESS-2.
- [ ] Does the invitation row survive if either user deletes their account? On account deletion of the inviter, invitations they sent are dropped. On account deletion of the target, their invitations disappear with them.
- [ ] Should banning from a room also trigger a user-to-user ban? No. Room ban scope is per-room; personal-messaging ban is explicit (FR-FRND-6).
