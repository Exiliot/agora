# UI shell

## Scope

FR-UI-1 to FR-UI-6, NFR-A11Y-1 to NFR-A11Y-3. Implements the scaffolding that every other feature renders into.

## Definition of done

A React + Vite SPA with routing, global providers (auth, query cache, WS client), a top nav, collapsible left sidebar (rooms + contacts), central message column, right-hand context panel, and a modal system. Visual language matches the Claude Design bundle in `docs/design/` — tokens, typography, spacing, component primitives. Works across multiple tabs for the same user (shared session cookie, independent WS connections).

## Acceptance criteria

- **Routing** — `/` (landing → redirect to `/chat` if signed in, else `/sign-in`), `/sign-in`, `/register`, `/reset`, `/chat/:roomName?`, `/dm/:username?`, `/sessions`, `/profile`.
- **Auth gate** — Routes under `/chat`, `/dm`, `/sessions`, `/profile` require a valid session. Redirect to `/sign-in?next=<path>` if not.
- **Global providers** — In order, outer to inner: QueryClientProvider, WebSocketProvider, ThemeProvider (dummy — the theme is static classic-paper), ModalProvider.
- **Top nav (FR-UI-1)** — `agora` wordmark + nav tabs (Public rooms, Private rooms, Contacts, Sessions) + right-aligned (user menu, Sign out).
- **Sidebar (FR-UI-2)** — Sections: Public rooms, Private rooms, Contacts. Each section accordion-expandable. Item rows are dense (row height ~22 px) per the design system.
- **Main chat column** — Header (room name + description + badges) + scrollable message list + composer at the bottom. Empty state when no room selected.
- **Right context panel** — Room info, member list with presence indicators, admin actions (if owner/admin).
- **Autoscroll behaviour (FR-UI-3)** — `isAtBottom` is tracked per-conversation; only append-and-scroll if true. If the user scrolls up, new messages arrive silently and a "new messages" pill appears at the top of the viewport.
- **Modal system (FR-UI-5)** — Single modal slot in the tree, stack-aware (opening a modal from within a modal works). Uses native `<dialog>` or a lightweight custom portal; accessible focus management is mandatory.
- **Design tokens (FR-UI-6)** — `apps/web/src/styles/tokens.css` defines the full token set from `docs/design/Design System.html`. Tailwind consumes these via the preset. No component ever hardcodes a hex colour or a px spacing — always via token.
- **Typography** — Inter for UI chrome, IBM Plex Mono for all chat content (timestamps, usernames, bodies, file sizes, IDs), IBM Plex Serif for the wordmark and auth hero text. Fonts loaded from Google Fonts at page boot.
- **Presence indicator shapes (NFR-A11Y-1)** — Filled square / half-diagonal / outlined square for online / AFK / offline. Implemented once in `apps/web/src/components/Presence.tsx` and used everywhere.
- **Keyboard navigation** — Tab order is sensible across the chat surface; focus ring visible; message list receives focus when arriving via keyboard; composer takes focus by default on conversation open.
- **Colour contrast** — All text/background pairings pass WCAG AA. Tokens were authored under this constraint; enforce by not inventing new tokens.
- **Multi-tab behaviour** — Opening a second tab attaches to the same session cookie; the WS connection is separate (different tab id in `sessionStorage`). State (read markers, unread counts) syncs via `unread_updated` WS events.
- **Reconnect UX** — If the WS drops, a discrete top-of-screen banner says `reconnecting…`; composer is disabled. On successful reconnect the banner disappears and any missed `message_new` events are backfilled via the `/messages?since=<last_seen_id>` query.

## Out of scope

- Dark mode (deferred — the whole design is light "paper" by intent).
- Responsive / mobile layouts (desktop-only MVP; columns collapse gracefully but aren't optimised).
- i18n / localisation.
- Rich-text formatting in the composer (bold, links, etc. — pure plaintext in MVP).
- Emoji picker (type Unicode emoji directly).
- Drag-and-drop reordering of rooms.

## Implementation hints

- State shape: a small Zustand store per slice (auth, rooms, dms, notifications, presence, ui). TanStack Query owns server cache. WS events mutate the cache via `queryClient.setQueryData` rather than invalidating (to avoid refetch storms).
- Route between conversations using URL state; the sidebar pushes `navigate(/chat/<name>)` rather than managing a selected-id locally. This makes multi-tab DX obvious (each tab can show a different room).
- Message list virtualises via `@tanstack/react-virtual`. 10k messages (NFR-PERF-3) is beyond naive rendering.
- Reply mode: clicking "reply" on a message sets the composer's `replyTo` context; a chip above the input shows who you're replying to with an X to cancel.
- Paste handler: on `onPaste` in the composer, detect `ClipboardEvent.clipboardData.files` with an `image/` mime, upload silently, attach to the in-progress composer draft.
- Modals stack by sharing a React context; the latest modal traps focus. Escape closes.

## Open questions

- [ ] Should the sidebar collapse to icons-only at narrow widths, or disappear entirely? Defaulting to icons-only (still navigable, recovers space).
- [ ] Do we expose a keyboard shortcut to switch rooms (Cmd+K command palette)? Desirable for power users but not in MVP acceptance — tag as stretch.
