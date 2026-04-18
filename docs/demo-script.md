# Demo script

A five-minute walk-through for reviewers. Use two browser windows (normal + Incognito) so they can exchange messages in real time.

## 0. Boot

```sh
git clone https://github.com/Exiliot/agora.git
cd agora
docker compose up --build
```

Open `http://localhost:8080` in both windows.

## 1. Register two users — Alice and Bob (1 min)

- Both windows start at `/sign-in`. Click **Register** in each.
- Fill email / username / password, click **Create account**. You land on `/chat` signed-in.
- Note: the wordmark, the minimalist paper-and-ink palette, the sparse top nav.

## 2. Create a room, chat in real time (1 min)

- Alice clicks **+ Create room**, names it `engineering`, sets visibility **public**.
- Alice is redirected into the room. Type `hello team` and send.
- Bob clicks the **Public rooms** nav tab, finds `engineering`, clicks **Join**.
- Bob also lands in the room. Alice's message is already there.
- Bob types `hi alice`. Alice sees it instantly — WebSocket real-time fan-out.

## 3. Moderate the room (1 min)

- Alice (owner) sees a **Manage room** button in the right panel.
- Click it; the modal opens on the Members tab.
- Alice clicks **Make admin** on Bob. Bob now has the admin badge in real time.
- Switch to **Invite** tab; show the invite-by-username field.
- Switch to **Settings** tab; show the red **Delete room** button (don't click unless demoing).

## 4. Friends and DMs (1.5 min)

- Alice goes to **Contacts**. Searches for Bob's username.
- Clicks **Add friend** next to Bob.
- Bob's top-nav shows a badge next to **Contacts**. He navigates there, sees the incoming request, clicks **Accept**.
- Alice refreshes Contacts; Bob is in her Friends list. She clicks **Message**.
- Alice is dropped into `/dm/bob` with a ready composer.
- Alice sends `hey bob, got a minute?`. Bob (still on his side) clicks the **bob** contact in his sidebar — message is already there.
- Bob replies; Alice sees it in real time.

## 5. Presence + sessions + attachments (30 s)

- In the room's right-hand panel, members show live presence (online / AFK / offline).
- If you leave one window idle for a minute, that user flips to AFK (half-filled diagonal square) for the other.
- Close one of Bob's tabs; he goes offline on Alice's view once the grace period passes.
- Click **Sessions** in the top nav. See the active browser session(s). The current one is marked.
- Back in the room, drop a file (any small file) onto the composer, or paste an image. Send. It renders inline with a download link.

## What this demonstrates

- Realtime multi-tab chat over WebSockets with in-process pub/sub, no Redis.
- Server-side DB-backed sessions with per-browser revocation.
- Multi-tab presence with shape+colour cues (online/AFK/offline).
- Friend-gated DMs and user-to-user bans (try banning each other to see history freeze).
- Room-level owner/admin moderation with member bans and invitations.
- File upload via button or clipboard paste with ACL-gated download.
- Classic web-chat aesthetic (Inter + IBM Plex Mono + IBM Plex Serif, warm paper/ink, no bubbles, hairlines over shadows).

## Things to have ready for questions

- **"Show me the spec"**: open `docs/spec.md` — FR-* and NFR-* IDs used throughout.
- **"Why not JWT?"**: `docs/adrs/0001-server-side-sessions.md`.
- **"Why no Redis?"**: `docs/adrs/0002-in-process-bus.md`.
- **"How does multi-tab presence work?"**: `docs/adrs/0003-presence-state-machine.md`.
- **"What about Jabber/XMPP?"**: `docs/adrs/0005-xmpp-sidecar.md` and the `phase2-xmpp` branch.
- **"How was this built?"**: `docs/journal/` — every decision as it happened, agents + coordinator.
