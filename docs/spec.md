# agora · product specification

Canonical source of truth for what the application does. Distilled from the task PDF (`docs/design/uploads/2026_04_18_AI_herders_jam_-_requirements_v3.pdf`) and the 2026-04-18 kickoff Q&A. When this spec and any other document disagree, this spec wins; flag the drift and update deliberately.

Every requirement has a stable ID. Other documents — requirements files, plans, ADRs, commit messages — reference these IDs. Do not renumber. If a requirement is deleted, leave the ID retired rather than reusing it.

ID scheme:

- `FR-<area>-<n>` — functional requirement
- `NFR-<area>-<n>` — non-functional requirement
- `AC-<n>` — architectural constraint (forced by brief or Q&A, not a free choice)
- `DR-<n>` — delivery requirement
- `ST-<n>` — stretch goal

---

## 0. Product in one paragraph

A classic web chat server in the lineage of IRC and rocket.chat. Registered users can create and join public or private rooms, send personal messages to friends, share files and images, reply to or edit messages, and see who is online. Chat history is persistent and infinite-scrollable. Moderation is room-level (owner/admins) and user-level (friend-list bans). The aesthetic is deliberately classic — a river of text, no bubbles, mono-for-truth — rather than a modern social network or collaboration suite.

## 1. Glossary

| Term | Meaning |
|---|---|
| User | An account registered by email + username + password. Username is the public identifier. |
| Session | A server-side record of one signed-in browser. Individually revocable. |
| Room | A named chat space. `public` or `private`; always has exactly one owner and ≥0 admins and members. |
| Personal dialog | A chat between exactly two users who are friends. Functionally equivalent to a room with fixed membership. |
| Presence | A per-user state: `online` / `afk` / `offline`. Aggregated across the user's browser tabs. |
| Heartbeat | A client-originated signal indicating tab activity. Drives presence transitions. |
| Attachment | A file or image posted to a room or personal dialog. |
| Friend | A user who has accepted another user's friend request. |
| Ban (user-to-user) | One user blocking another from personal messaging. |
| Ban (room) | A room's admin blocking a user from rejoining that specific room. |
| AFK | Away from keyboard — presence state between `online` and `offline`. |

## 2. Functional requirements

### 2.1 Accounts and authentication

- **FR-AUTH-1** — Users can self-register with email, password, and a unique username.
- **FR-AUTH-2** — Email must be unique across all users.
- **FR-AUTH-3** — Username must be unique across all users.
- **FR-AUTH-4** — Username is immutable after registration.
- **FR-AUTH-5** — Email verification is not required.
- **FR-AUTH-6** — Users sign in with email and password.
- **FR-AUTH-7** — Users can sign out. Signing out invalidates only the current browser's session; other sessions remain valid.
- **FR-AUTH-8** — Sign-in state persists across browser close and reopen.
- **FR-AUTH-9** — Users can request a password reset. An email delivery step is **mocked** (no real SMTP); the reset link must be visible in the server log for testability. *(Confirmed in kickoff Q&A.)*
- **FR-AUTH-10** — Logged-in users can change their password.
- **FR-AUTH-11** — No forced periodic password change.
- **FR-AUTH-12** — Passwords are stored only in salted-hashed form using a modern KDF (Argon2id).
- **FR-AUTH-13** — Users can delete their account. On deletion:
  - their account record is removed;
  - rooms they own are deleted (and all messages, files, images in those rooms are permanently deleted);
  - their membership in other rooms is removed;
  - messages they authored in other rooms remain (displayed as from a deleted user).

### 2.2 Sessions and presence

- **FR-SESS-1** — Each sign-in creates a distinct server-side session bound to one browser.
- **FR-SESS-2** — Users can view their active sessions, including browser type, IP address, last-seen timestamp, and the current session marker.
- **FR-SESS-3** — Users can log out any single active session from the list. Other sessions remain valid.
- **FR-SESS-4** — No forced logout due to inactivity is required.
- **FR-SESS-5** — Sessions expire on an absolute timeout (14 days after last activity) and are pruned server-side.
- **FR-PRES-1** — The system exposes three presence states: `online`, `afk`, `offline`.
- **FR-PRES-2** — A user is `afk` if no open browser tab has had user interaction in the last 60 seconds.
- **FR-PRES-3** — A user is `online` if at least one tab has been active within the last 60 seconds.
- **FR-PRES-4** — A user is `offline` when all tabs have closed or been offloaded by the browser.
- **FR-PRES-5** — The application correctly handles the same user opening multiple tabs simultaneously.
- **FR-PRES-6** — Presence changes propagate to other users with low latency (see NFR-PERF-2).

### 2.3 Contacts and friends

- **FR-FRND-1** — Each user has a personal contact/friend list.
- **FR-FRND-2** — A user can send a friend request by entering a username or by clicking a user's name in a room's member list.
- **FR-FRND-3** — A friend request may carry an optional text message.
- **FR-FRND-4** — A friendship is established only after the recipient accepts. Declining discards the request silently from the sender's perspective.
- **FR-FRND-5** — A user can remove another user from their friend list at any time.
- **FR-FRND-6** — A user can ban another user. Effects:
  - new personal messages between the two users are blocked in both directions;
  - existing personal-message history is preserved but becomes read-only;
  - any friendship between them is implicitly terminated;
  - neither user can see the other in searchable friend-by-username results (optional hardening — behaviour to confirm via AC-BAN-1).

### 2.4 Chat rooms

- **FR-ROOM-1** — Any registered user can create a chat room.
- **FR-ROOM-2** — A room has: name, description, visibility (`public` | `private`), owner, admins, members, banned-users list.
- **FR-ROOM-3** — Room names are unique across the system (including both public and private rooms). *(Confirmed in kickoff Q&A.)*
- **FR-ROOM-4** — The system provides a catalogue of public rooms showing name, description, and current member count. The catalogue supports simple text search across name and description.
- **FR-ROOM-5** — Any authenticated user can join any public room they are not banned from.
- **FR-ROOM-6** — Private rooms are not listed in the public catalogue. A user joins a private room only via an accepted invitation.
- **FR-ROOM-7** — Users can leave any room they belong to. The owner cannot leave — the owner must delete the room instead.
- **FR-ROOM-8** — Room deletion permanently removes all messages, files, and images in that room.
- **FR-ROOM-9** — Each room has exactly one owner. Ownership cannot be transferred within the MVP scope.
- **FR-ROOM-10** — The owner is implicitly always an admin and cannot lose admin status.
- **FR-ROOM-11** — Admins can: delete messages in the room, remove members, ban members, view the banned-users list, see who banned each banned user, remove users from the ban list, remove admin status from other admins (except the owner).
- **FR-ROOM-12** — The owner can do everything an admin can do, plus: remove any admin, remove any member, delete the room.
- **FR-ROOM-13** — Removing a user from a room is treated as a ban — the user cannot rejoin until an admin removes them from the ban list.
- **FR-ROOM-14** — When a user loses access to a room (removed/banned/account-deleted), they lose access to the room's messages, files, and images through the UI immediately.
- **FR-ROOM-15** — Users can invite other *registered* users to private rooms by username. *(Kickoff Q&A: inviting unregistered users is out of scope — it would require an SMTP server.)*
- **FR-ROOM-16** — An invitation to a private room produces a notification for the invitee with accept/reject options.

### 2.5 Messaging

- **FR-MSG-1** — Personal dialogs behave identically to rooms from the UI and feature perspective. Conceptually a personal dialog is a chat with a fixed two-user membership; only moderation is different (admins don't exist in personal dialogs).
- **FR-MSG-2** — A message can contain: plain text, multiline text, emoji, zero-or-more attachments, and an optional reference to another message (reply).
- **FR-MSG-3** — Maximum text size per message: 3 KB. UTF-8 only.
- **FR-MSG-4** — A reply visibly quotes the referenced message in the UI.
- **FR-MSG-5** — A user can edit their own messages. An edited message displays a gray `edited` indicator.
- **FR-MSG-6** — Messages can be deleted by their author or by an admin of the containing room. Personal dialogs have no admins — only authors delete.
- **FR-MSG-7** — Deleted messages are not required to be recoverable.
- **FR-MSG-8** — Messages are persistent, stored in chronological order, and displayed with infinite scroll for older history.
- **FR-MSG-9** — Messages to an offline user are persisted and delivered when that user next connects.
- **FR-MSG-10** — Personal messages between two users are permitted only when both are friends and neither has banned the other. Moment-of-send is the check.

### 2.6 Attachments

- **FR-ATT-1** — Users can attach images and arbitrary file types to messages.
- **FR-ATT-2** — Attachments can be added via an explicit upload button or by clipboard paste.
- **FR-ATT-3** — The original file name is preserved and displayed on download.
- **FR-ATT-4** — Each attachment supports an optional user-supplied comment (separate from the message text).
- **FR-ATT-5** — Downloading an attachment is permitted only if the requester is a current member of the containing room or an authorised participant of the personal dialog at the time of the request.
- **FR-ATT-6** — When a user loses access to a room, they lose access to the room's files and images immediately.
- **FR-ATT-7** — Files persist after upload unless the containing room is deleted. A user who loses access cannot see, download, or manage their previous uploads, but the files themselves remain on disk until the room is deleted.

### 2.7 Notifications

- **FR-NOTIF-1** — The UI shows an unread-messages indicator next to a room or contact when that room or dialog has messages received after the user last opened it.
- **FR-NOTIF-2** — Opening a room or dialog clears its unread indicator.
- **FR-NOTIF-3** — Friend requests and room invitations produce in-app notifications with accept/reject actions.

### 2.8 UI

- **FR-UI-1** — The main layout is: top navigation bar, central message area, message input at the bottom, and a collapsible sidebar listing rooms and contacts. A right-hand panel shows room info and member list with online statuses.
- **FR-UI-2** — The sidebar compacts into accordion sections once a user enters a room, to maximise chat real estate.
- **FR-UI-3** — The chat window auto-scrolls to new messages only if the user is already at the bottom. If the user has scrolled up to read older history, new messages do not force a scroll.
- **FR-UI-4** — The message input supports multiline entry, emoji input, file/image attachment, and reply-mode.
- **FR-UI-5** — Administrative actions (ban/unban, remove member, manage admins, view banned users, delete messages, delete room) are available via menus and implemented through modal dialogs.
- **FR-UI-6** — The visual language matches the Claude Design handoff in `docs/design/`. Tokens, typography, spacing, radii, and message-row anatomy are not discretionary.

## 3. Non-functional requirements

### 3.1 Capacity and scale

- **NFR-CAP-1** — The system supports 300 simultaneously connected users.
- **NFR-CAP-2** — A single room may contain up to 1000 members.
- **NFR-CAP-3** — A user may belong to an unlimited number of rooms. Sizing baseline: typical user has ~20 rooms and ~50 contacts.

### 3.2 Performance

- **NFR-PERF-1** — A sent message is delivered to recipients within 3 seconds of send under nominal load.
- **NFR-PERF-2** — Presence changes propagate within 2 seconds.
- **NFR-PERF-3** — The chat view remains usable with at least 10,000 messages in a room's history.

### 3.3 Persistence

- **NFR-PERS-1** — Messages are durably persisted and retained for years (no defined retention window in the MVP — implement indefinite retention).
- **NFR-PERS-2** — The backing store is a relational database. *(Kickoff Q&A: RDBMS strongly preferred; NoSQL makes data integrity harder.)*

### 3.4 File storage

- **NFR-FILE-1** — Files are stored on the local filesystem of the backend container (mounted as a Docker volume).
- **NFR-FILE-2** — Maximum file size: 20 MB.
- **NFR-FILE-3** — Maximum image size: 3 MB.

### 3.5 Session behaviour

- **NFR-SESS-1** — Login state persists across browser close/open (see FR-AUTH-8).
- **NFR-SESS-2** — Multi-tab behaviour is correct for the same user across tabs (see FR-PRES-5).
- **NFR-SESS-3** — No auto-logout due to inactivity (see FR-SESS-4).

### 3.6 Reliability and consistency

- **NFR-REL-1** — The system preserves consistency of: room membership, room bans, file access rights, message history, admin/owner permissions.

### 3.7 Accessibility (implicit from design system)

- **NFR-A11Y-1** — Presence cues use both shape and colour, never colour alone (square filled/half/outlined). Required to preserve signal for colour-vision deficiencies.
- **NFR-A11Y-2** — Keyboard navigation works for every interactive element. Focus is visible.
- **NFR-A11Y-3** — Text colour contrast meets WCAG AA on all surfaces (verified by design tokens).

## 4. Architectural constraints

These are not free choices; they come from the kickoff call Q&A and the scale numbers in §3.

- **AC-SESSIONS-1** — Session state is server-side, stored in the RDBMS, keyed by an opaque ID issued in an `HttpOnly; Secure; SameSite=Lax` cookie. **JWT is not used** because FR-AUTH-7, FR-SESS-3, FR-FRND-6, and FR-ROOM-13 all require immediate revocation that JWT cannot provide without reintroducing a server-side denylist — at which point it is strictly worse than sessions. *(Explicit Denis recommendation on kickoff.)*
- **AC-QUEUE-1** — Message fan-out does not go through the database as a write-then-poll loop. A server-side in-memory pub/sub bus fans out new messages to connected WebSocket clients. The database is the durable record; the bus is the delivery path.
- **AC-PRESENCE-1** — Presence state is computed from per-tab heartbeats in memory, not queried from the database. The database holds session records (for active-sessions view) but not the tab-level presence map.
- **AC-REALTIME-1** — Real-time delivery uses WebSockets. REST-poll is insufficient at NFR-CAP-1 scale.
- **AC-SINGLENODE-1** — The MVP runs as a single backend process per deployment. No Redis, no cluster pub/sub, no sticky-session load balancer. This is a deliberate scope choice consistent with NFR-CAP-1 (300 concurrent users fits comfortably in one Node process).

## 5. Delivery requirements

- **DR-1** — Public GitHub repository, `main` branch as submission.
- **DR-2** — Fresh checkout + `docker compose up` must bring the entire application up end-to-end: database, migrations applied, backend service, frontend service, ready to exercise the core flow via a browser on `localhost`.
- **DR-3** — No environment variables required to run the demo. Any defaults live in `docker-compose.yml` or a checked-in `.env.example` that Compose loads.
- **DR-4** — No cloud-dependent functionality. The app must be runnable on an offline machine. *(Denis: "runnable on a spaceship on Mars orbit by doing `docker compose up`, period.")*
- **DR-5** — `GET /health` returns 200 once the stack is up.
- **DR-6** — A short `README.md` at repo root explains what the app does, the run command, the URL to open, and the 3–5 main flows to try. Human testers do not read more than a page.

## 6. Stretch goals

Only pick up once §2 and §3 are green end-to-end.

- **ST-XMPP-1** — Users can connect to the server with an XMPP/Jabber client (level of protocol support is a choice; presence + MUC + 1:1 messaging covers the bulk).
- **ST-XMPP-2** — Two instances of the server can federate: messages and presence flow between server A and server B. Requires a more involved `docker-compose.yml` with two backends and their databases.
- **ST-XMPP-3** — A load test demonstrating 50+ clients on each server messaging across the federation.
- **ST-XMPP-4** — Admin UI for XMPP connection dashboard and federation traffic statistics.

## 7. Notes and clarifications

- The product is a *classic* web chat, not a modern social network or collaboration suite. Design: dense, text-first, no bubbles, no emoji reactions as a core feature, no stories, no video calls.
- Room names are globally unique across public and private visibility.
- Personal dialogs support the same message features as rooms (attachments, replies, edits, deletes).
- After a user-to-user ban, existing personal history is visible but read-only on both sides.
- When a room is deleted, all messages and attachments go with it.
- Files stay on disk after their uploader loses access; only room deletion removes the bytes.
- Offline recipients receive messages on next connection.
- Multi-tab presence: a user is online if any tab has interacted in the last minute, AFK if none has, offline when all tabs close.
- Sign out ends one browser's session only. Other sessions and devices remain.
