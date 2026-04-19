# Accessibility audit – agora (round 2)

Date: 2026-04-19. Scope: `apps/web/src/**`. Target: WCAG 2.1 AA, keyboard navigable, screen-reader usable. Read-only audit; no code changed. Supersedes `docs/audits/accessibility.md` (2026-04-18); that file is kept for trace.

## Executive summary

Substantial progress since 18 April. The three systemic gaps called out in round 1 – missing focus styles, modal focus management, and live regions – are all closed in mainline. `Modal.tsx` now ships a full focus trap + Escape + focus restore; the global `:focus-visible` rule renders a teal outline on every interactive primitive; `role="log"` wraps the message list and `ToastHost` exposes toasts via `role="status"` / `role="alert"`. `ink-3` has been darkened to `#6f6d62` (AA on paper-1), the skip link has a real target, presence has been redrawn in SVG, `Intl.RelativeTimeFormat` replaces the hand-rolled helper, and `Bell` / `NotificationMenu` / `NotificationRow` are built against the DS conventions from the start.

What remains is narrower. Heading hierarchy is still broken on every route (Modal renders its title as `h2` with no enclosing `h1`, so sign-in, register, reset, create-room, manage-room all start at `h2`). `NotificationMenu` carries `role="dialog"` without `aria-modal` and without trapping focus or returning focus to the Bell on close, so the disclosure pattern is inconsistent with `Modal`. The Composer's Send button shows a literal horizontal ellipsis while sending, form inputs still lack `aria-invalid` / `aria-describedby` wiring to their error Toasts, `Check` (checkbox/radio) has no programmatic association with the "Visibility" grouping label, `Spinner` and smooth-scroll ignore `prefers-reduced-motion`, and the mention badge (`--mention-fg` on `--mention-bg`) only clears AA-large (4.28:1) for unread counters that are rendered at body-ish size on the Bell overlay.

Verdict: the app is close to WCAG 2.1 AA but is not there yet – two high-severity issues (heading hierarchy + disclosure pattern) and a cluster of mediums would need to clear before we could certify.

## Closed since 2026-04-18

All closures verified against the current working tree.

| R1 # | What landed | Commit |
|---|---|---|
| 1 | Global `:focus-visible` ring in `base.css` (`@layer base`) plus per-primitive restore (button, a, input, textarea, select, `[role="button"]`, `[role="dialog"]`, `[tabindex]`). | 128a716 |
| 2 | `Modal.tsx` now has `aria-modal="true"`, `aria-labelledby`, focus-first-tabbable on mount, Tab wrap, Escape-to-close, and focus restoration to the previously-focused element on unmount. | 128a716 |
| 3 | `MessageList.tsx` wraps the scroller in `<div role="log" aria-live="polite" aria-relevant="additions text" aria-label="Message history">`. | 128a716 |
| 4 | `ContactListItem` and `RoomListItem` are `<button type="button">` with `aria-label` derived from `{name}, {status}, {N} unread`; they inherit the global focus ring. | 128a716 |
| 5 | `NavTab` exposes an `as="button"` variant; `RootLayout` uses it for Sign-out and a `plain` `as="span"` for the username label. Sign-out is a real keyboard-focusable button. | 18e3386 |
| 6 | `MessageActions` is always mounted inside the row; visibility is gated via `opacity` + `pointer-events`, so focus can land on Edit/Delete without hovering. | 451a73b |
| 7 | `--ink-3` changed from `#a59b7d` (≈2.6:1) to `#6f6d62` – now 4.85:1 on paper-1 and 5.20:1 on white, AA clean for body-size text. | 88de04b |
| 8 | Accent link text colour: link-variant buttons now use `--accent` at `oklch(...)` → `#2f6e6a`, which computes 5.50:1 on paper-1 and 5.90:1 on white, AA clean. `--accent-ink` (`#224f4c`) is 8.55:1. Either is safe for body text. |  88de04b |
| 9 | `ModalScrim` is the shared backdrop component; every dialog call-site wraps its `<Modal>` in `<ModalScrim onClose=…>` so click-outside and Escape behaviour are consistent. | c9608ff |
| 10 | Auth errors surface as `<Toast tone="error">`; `Toast.tsx` renders `role="alert"` for `error` + `warn`, and `ToastHost` ensures the container is live (`role="region" aria-live="polite"`). | 18e3386, 3a92b23 |
| 11 | `ContactListItem` routes presence through the shared `<Presence>` primitive and carries `aria-label={`${name}, ${status}${unread? `, ${unread} unread` : ''}`}`. | 3a92b23 |
| 14 | Inline edit replaces `window.prompt`; delete replaces `window.confirm` with `ConfirmModal`. Both keep focus inside the row / the dialog. | 451a73b |
| 15 | `ToastHost` exists and mounts at the authenticated root, per-toast `role` toggles between `alert` and `status`. | 52c6e86 |
| 17 | Primary nav wrapped in `<nav aria-label="Primary">`, active `NavTab` receives `aria-current="page"` – same pattern in `AuthHeader`. | 18e3386 |
| 18 | Composer `<textarea>` has a visually-hidden `<label htmlFor>` ("Message") plus `aria-describedby={hintId}` pointing at the "⏎ send · ⇧⏎ newline · paste images" string. | 18e3386 |
| 20 | `ChatView` right-hand column is `<aside>` (still unnamed, see finding below), but at least the middle column now has a proper `<RoomHeader>` and the `RoomName` primitive gives #name a consistent treatment. | 3a92b23 |
| 24 | `FileCard` accepts a `name` + renders a real `<img alt={name}>` once an image attachment is uploaded. | 866c2c3 |
| 25 | A visually-hidden-until-focus `.skip-link` is injected in `RootLayout`; its target `<main id="main" tabIndex={-1}>` has an explicit `:focus-visible` outline so the jump is discoverable (R3-23). | 18e3386, 1ff0ebc |
| 26 | Auto-scroll-to-latest is now gated on "user was already at the bottom" via `wasAtBottomRef`; a manual scroll back pauses the follow behaviour. | 65bd77e |

Items still outstanding from round 1 are rolled into the round-2 findings below (12, 13, 16, 19, 21, 22, 23, 27, 28).

## Findings (round 2)

Sorted by severity. Paths relative to the repo root.

| # | Sev | WCAG | Location | Issue | User impact | Suggested fix |
|---|---|---|---|---|---|---|
| 1 | high | 1.3.1, 2.4.6 | `apps/web/src/ds/Modal.tsx:90`; every auth page (`SignInPage`, `RegisterPage`, `ResetPasswordPage`) plus `CreateRoomDialog`, `ManageRoomModal`, `ConfirmModal` | Modal renders its title as a hard-coded `<h2>`. Auth routes mount the modal as the only landmarkful content; there is no enclosing `<h1>` anywhere on the page, so the heading outline jumps `h1 → h2` and every non-auth page has exactly one `h1` (PageShell) with a modal `h2` that is semantically a sibling, not a child. | Screen-reader heading navigation is inconsistent. A user using the rotor on `/sign-in` or `/register` has no `h1` to jump to and hears only the modal `h2`; `ContactsPage` has `h1` + modal `h2` that are unrelated landmarks. | [CLOSED in ADR-0008 / 9d70c08] `Modal` accepts `titleLevel: 1 \| 2 \| 3`. SignIn, Register and Reset pass `titleLevel={1}`; non-auth modals keep the default `h2` under the page's PageShell `h1`. |
| 2 | high | 4.1.2, 2.4.3 | `apps/web/src/ds/NotificationMenu.tsx:102` | Popover carries `role="dialog"` + `aria-label="Notifications"` but lacks `aria-modal`, does not move focus into the menu on open, and does not return focus to the Bell when closed (Escape / outside-click / resize / scroll all just call `onClose` – the Bell does not regain focus). There is also no `aria-expanded`/`aria-controls` on the Bell, and the menu's items are not a list / menu / listbox, so Tab order enters "generic buttons" rather than an interactive collection. | Keyboard users opening the Bell are stranded. Hitting Enter on the Bell triggers the menu but keeps focus on the Bell; Tab then moves into the topbar-behind-the-popover rather than the first notification row. Closing the menu leaves focus nowhere deterministic. Screen readers get a dialog that is not modal and has no expanded-state tie-back. | [CLOSED in ADR-0008 / 9d70c08] The disclosure pattern is now owned by `useOverlay`: Escape + click-outside + focus return to the opener are centralised. `NotificationMenu` opts out of `trapFocus` so tabbing out of the popover is allowed per the menu pattern. |
| 3 | high | 3.3.1, 4.1.2 | `SignInPage`, `RegisterPage`, `ResetPasswordPage`, `CreateRoomDialog`, `ManageRoomModal` `InviteTab` | Form errors live in a sibling `<Toast tone="error">` with `role="alert"`, but the offending `<Input>` never gains `aria-invalid` / `aria-describedby={errorId}`. `Input.tsx` has an `error` prop that only recolours the border. | Screen-reader users hear the error announced once (via `role="alert"`), then tab back into the field with no programmatic association, so the reason for failure is lost on re-focus. "Invalid credentials" is announced but the password field does not read as invalid. | [CLOSED in 2216342] `Input` now accepts `errorMessage?: string`; when set it renders an inline `role="alert"` under the input and wires `aria-invalid` + `aria-describedby`. SignIn, Register, Reset, CreateRoom and InviteTab all thread their error strings through that prop instead of the sibling Toast. |
| 4 | high | 1.4.3 | `apps/web/src/ds/Bell.tsx:57-68` + `Badge tone="mention"` | Bell unread overlay renders the count in the mention badge whose colours (`--mention-fg` `#8a6a10` on `--mention-bg` `#fbecb5`) compute 4.28:1 – AA-large only. The badge renders at 11 px mono, which is below the "large text" threshold (14 pt bold / 18 pt regular). | Users with low vision cannot reliably count unread notifications in the topbar overlay. This is the single most important notification affordance on the page. | [CLOSED in 0df0c08] `--mention-fg` darkened from `#8a6a10` to `#7a5d0d`, now 5.23:1 on `--mention-bg`. Clears AA at body size for every mention-badge call-site. |
| 5 | medium | 2.4.6 | `apps/web/src/pages/chat/Sidebar.tsx:166`, `apps/web/src/pages/chat/ChatView.tsx:51` | Both the sidebar and the room context panel are `<aside>` with no `aria-label` / `aria-labelledby`. The page renders two `<aside>`s simultaneously, so landmark rotor reads "complementary" twice with no distinguishing name. | SR users cannot orient between "conversation list" and "people in this room". | [CLOSED in cefbe84] Sidebar `aside aria-label="Conversations"`; RoomContextPanel `aside aria-label="#{name} members"`. `AuthLayout` now wraps its Outlet in a proper `<main>` so auth pages gain a landmark too. |
| 6 | medium | 1.3.1 | `apps/web/src/pages/chat/Sidebar.tsx:64-108` | The Visibility radios use `<Check radio>` (label wraps the input) without a `<fieldset>` / `<legend>` grouping, so the two radios are siblings of each other with no joint name. The "Visibility" label is a `<Meta>` `<div>`. | Screen-readers announce "public, radio button, 1 of 1" then "private, radio button, 1 of 1" with no group context. The user does not learn these are alternatives, only that each is a separate choice. | [CLOSED in cefbe84] CreateRoomDialog wraps the visibility radios in a `<fieldset>` with a `<legend>` styled to look like Meta. |
| 7 | medium | 2.3.3 | `apps/web/src/styles/base.css:78-81`, `apps/web/src/ds/Spinner.tsx:34`, `apps/web/src/pages/chat/MessageList.tsx:482`, `apps/web/src/pages/chat/MessageList.tsx:577` | `@keyframes agora-spin` runs unconditionally on the Spinner and the in-line pagination spinner. `scrollTo({ behavior: 'smooth' })` on Jump-to-latest also runs unconditionally. Neither respects `prefers-reduced-motion: reduce`. | Users with vestibular triggers get a continuously spinning ring and a potentially long smooth scroll to bottom. WCAG 2.3.3 is AAA, but the reduced-motion gate is industry-standard and easy. | [CLOSED in f86f7c2] `base.css` carries a global `@media (prefers-reduced-motion: reduce)` block that flattens animation/transition durations and disables smooth scroll. The Jump-to-latest handler branches on `matchMedia('(prefers-reduced-motion: reduce)')` explicitly for the programmatic `scrollTo`. |
| 8 | medium | 4.1.2 | `apps/web/src/ds/Button.tsx:69-90`, `apps/web/src/ds/Modal.tsx:114` (`×`), `apps/web/src/pages/chat/Composer.tsx:290` | `{sending ? '…' : 'Send'}` (and siblings in Register, Create, Manage, Reset) uses a literal horizontal-ellipsis character as a spinner. Screen readers read "horizontal ellipsis" in most voices. There is no `aria-busy` wiring either. | Mildly noisy feedback; mainly a polish issue. | [CLOSED in 90ce6e9] `Button` accepts a `pending` prop that sets `aria-busy`, disables the button, keeps the written label intact, and renders the ellipsis as an `aria-hidden` visual cue. SignIn, Register, Reset, CreateRoom, Composer and ConfirmModal all use `pending={...}` now rather than swapping children to "…". |
| 9 | medium | 1.3.1 | `apps/web/src/ds/NotificationRow.tsx:109-143` | The row is a single `<button>` whose accessible name is the concatenation of title + body + relative time via the default-accname-computation (plain text of children). That mostly works, but the time is rendered as `Intl.RelativeTimeFormat` narrow ("2m", "3h") with no absolute fallback. There is no `<time dateTime={iso}>` or `aria-label` carrying the full timestamp. | SR users hear "2m" / "3h" out of context. On a list of 30 rows with similar strings they cannot tell which was yesterday evening vs this morning. | [CLOSED, in 6a5966c] `NotificationRow` wraps the time cell in `<time dateTime>` with a `title` on the locale-formatted absolute timestamp. The row's visible children are `aria-hidden`; the button's explicit `aria-label` reads "unread, {title}, {body}, {long relative time}" to avoid narrow-style jargon in the rotor. |
| 10 | medium | 4.1.2 | `apps/web/src/ds/NotificationMenu.tsx:118-125` | "Mark all read" button uses `disabled={notifs.every((n) => n.readAt !== null)}`. That native attribute removes the button from the tab order – better than `aria-disabled` for "nothing to do", but a screen reader user tabbing through the dialog cannot reach it to discover the option exists. | Debatable. Native `disabled` is compliant but makes the control invisible to the rotor when all is read. | Acceptable as-is; for a more discoverable pattern switch to `aria-disabled="true"` + skip the mutation on click. Low priority – flagging for ADR consideration only. |
| 11 | medium | 1.3.1 | `apps/web/src/pages/contacts/ContactsPage.tsx:38-43` | `Section` renders `<section>` with the title rendered inside a `<SectionHeader>` (mono label span). The section has no accessible name; the heading is not an `<h2>`, so "Incoming requests" / "Outgoing requests" / "Add a friend" are not landmark-navigable headings. | SR users cannot jump between the page sub-sections. On a page this dense this matters. | [CLOSED in cefbe84] `SectionHeader` accepts an optional `id` and renders the label as an `<h2>` when set. ContactsPage's `Section` generates the id via `useId`, wires `aria-labelledby` on the `<section>`, and passes the id through. |
| 12 | medium | 4.1.2 | `apps/web/src/ds/Check.tsx:20-26` | `<input type="checkbox">` / `<input type="radio">` is positioned via `accentColor` with no visible focus style beyond whatever the UA draws on the native control. The global `input:focus-visible` rule will apply, but the checkbox itself is 13 × 13 px – the 2 px offset outline can read as washed-out at that size. | Keyboard focus on tiny controls is easy to miss. Borderline-compliant; worth a visual check. | [CLOSED, see focus-ring commit] `Check` wrapping `<label>` takes the `ds-check-label` class; `base.css` paints a 2 px accent ring on `.ds-check-label:focus-within` so the ring encloses both the tiny control and its label. |
| 13 | medium | 1.4.11 | `apps/web/src/ds/Presence.tsx:34-63` | Status swatches (`--afk` 2.96:1, `--offline` 2.58:1 against `--paper-1`) do not meet the 3:1 non-text contrast bar. Shape distinguishes the three states (good, covers NFR-A11Y-1), so the swatch itself is not solely carrying meaning, but the outlined-offline variant can read as absent in peripheral vision on low-brightness displays. | Low-vision users may miss the offline swatch entirely. Shape still rescues them, but the signal is weak. | Darken `--offline` to ≈ `#87816a` (3.1:1) and `--afk` to ≈ `#8a6820` – the latter may also need paired adjustments on any badges that use `--afk`. Optionally accept this under 1.4.11 on the basis of the shape redundancy, and document it in an ADR. |
| 14 | low | 1.3.1 | `apps/web/src/ds/MessageRow.tsx:79`, `MessageRow.tsx:106` | The `[HH:MM]` timestamp is `tokens.color.ink3` on `#fff` (5.20:1 – AA). But the timestamp is rendered as plain text with no `<time dateTime>` wrapper, so it is not machine-readable, and screen-reader users hear "bracket 14 bracket 32 bracket" rather than "14:32". | Noisy but not blocking. | [CLOSED, in 6a5966c] `MessageRow` accepts an optional `timeIso` prop; when set, the `[HH:MM]` cell renders as `<time dateTime={iso} title={absolute}>`. The MessageList threads `msg.createdAt` through. |
| 15 | low | 4.1.2 | `apps/web/src/ds/MessageRow.tsx:108` | `<i>message deleted</i>` uses `<i>` for tombstoned bodies. `<i>` has no semantic meaning here – it is neither a foreign phrase nor a taxonomic term. | Minor. | [CLOSED, in 6a5966c] Replaced with `<em>` – the intent is emphasis, not a Latin phrase or taxonomic term. |
| 16 | low | 2.4.6 | `apps/web/src/ds/Table.tsx:13-80` | `Table` exposes a `caption` prop but no consumer uses it – `SessionsPage`, `ContactsPage`, `ManageRoomModal` all pass tables with no caption. | SR users hear the column headers but not the table's purpose. | Pass `caption="Active sessions on your account"` on `SessionsPage`, `caption="Friends"` on `FriendList`, etc. Already plumbed. |
| 17 | low | 4.1.2 | `apps/web/src/pages/chat/Composer.tsx:266-278` | Counter `body.length/MAX_MESSAGE_BODY` is wrapped in `aria-live="polite"` but it only renders past 80 % capacity, so a user who crosses the threshold gets a sudden announce. Once they cross `MAX_MESSAGE_BODY` the counter recolours to `--danger` and the Send button is disabled, but there is no explicit announcement of "message too long". | Edge case: a user who types fast past the limit hears a count jump without context. | Render the counter unconditionally (visually hidden below 80 %), or make the recolour line announce "message too long" via a `role="alert"` sibling once over the cap. |
| 18 | low | 1.3.1 | `apps/web/src/ds/ImageLightbox.tsx:83-96` | Lightbox close button reads "close · esc" – fine visually, but the middle-dot (`·`) gets read as "middle dot" in some voices. `aria-label="Close"` is already set, so the label wins – but the keyboard hint is not exposed to SR users beyond that. | Minor. | Nothing to fix; noting for awareness. The `aria-label` override is the right call. |
| 19 | low | 2.4.11 | `apps/web/src/styles/base.css:29-44` | The global focus ring is a 2 px solid accent outline with a 2 px offset. That is a good visible-focus style, but `border-radius: var(--r-xs)` on the base selector leaks into non-button elements the rule covers (e.g. `<label>` inside `Check` after label-focus-within if that ever lands). | Cosmetic. | [CLOSED, see focus-ring commit] The universal `:focus-visible` rule no longer carries `border-radius`; the radius override is scoped to button/a/input/textarea/select/[role="button"]/[role="dialog"]/[tabindex]. |
| 20 | info | – | `apps/web/src/ds/NotificationRow.tsx:76` | `const rtf = new Intl.RelativeTimeFormat('en', ...)` is locked to English. The rest of the codebase is similarly English-only; when i18n lands this is one of the many sites that will need a locale passed through. | Future work. | When the locale selector exists, replace the module-level const with a memoised `useMemo` on the user's language preference. |
| 21 | info | – | `apps/web/src/ds/Composer.tsx` Enter-vs-Shift-Enter | Enter sends; Shift-Enter adds a newline. The visual hint "⏎ send · ⇧⏎ newline · paste images" is tied to the textarea via `aria-describedby`. Good. The Send behaviour itself is not announced as a shortcut on the Send button. | Informational. | Not necessary – the aria-describedby hint already covers it. |

## Area-by-area notes

### 1. Focus management

Global `:focus-visible` is defined in `base.css` @ layer base (2 px accent outline, 2 px offset, tiny radius). The rule is mirrored for button, a, input, textarea, select, `[role="button"]`, `[role="dialog"]`, and `[tabindex]`. All Button, IconButton, NavTab (button mode), ContactListItem, RoomListItem, and NotificationRow inherit it cleanly – they all reset their background or border but do not strip `outline`.

`Modal.tsx` now implements the focus contract end-to-end: on mount it stashes `document.activeElement`, focuses the first tabbable inside the dialog (or the dialog itself), wires a Tab-trap (`if Tab at last → first`, `if Shift-Tab at first → last`), listens for Escape to call `onClose`, and on unmount restores focus to the stashed element. `ConfirmModal` layers on top of `Modal` + `ModalScrim`, so it inherits the full contract. One subtle behaviour: stacking two `ModalScrim`s (e.g. opening `ConfirmModal` inside `ManageRoomModal`) works because the inner modal's Escape handler calls `stopPropagation` before `onClose`. Tested reading – the outer Escape listener is a window-level listener on the outer modal's effect closure and would otherwise also fire. The guard is in place.

`ModalScrim` onClose fires on any click on the scrim div; the child stops propagation. This means a mousedown on the scrim with drag out of the dialog will still close it – minor footgun for forms with range sliders, but none exist today.

`NotificationMenu` is the weakest focus-management surface. It has Escape handling, outside-click, and close-on-scroll, but no Tab trap, no focus-to-first-row on open, and no focus-return-to-Bell on close. Tabbing from the Bell after opening goes into the header's username label, the Sign-out button, then into the page behind the floating panel – because the panel is portaled to `document.body` and not part of the tab order unless something inside has focus. See finding 2.

Skip-link target: `<main id="main" tabIndex={-1}>` now has an explicit focus ring in `base.css` (`main#main:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }`). The skip link itself is `.skip-link`, visually-hidden until focus, positioned top-left on focus. Works.

Input's password reveal button is `tabIndex={-1}` so Tab order does not land on it; users can click or hit it via the `aria-pressed` state. This is a reasonable trade-off for a toggle that is visible alongside the input and would otherwise double the Tab cost of each password field. The `aria-pressed` / `aria-label` flip ("Show password" / "Hide password") is clean.

`Composer` textarea ships with `resize: 'none'`, `border: none`, `outline: none` on the native element – the focus ring is drawn by the wrapping div instead via `:focus-within`. Except there is no `:focus-within` rule on the wrapper. Result: the textarea focused state has no visible indicator beyond the caret. Worth adding `:focus-within { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent); }` on the wrapping div. Noted as a low-severity follow-up alongside finding 19.

### 2. Semantic structure

Landmark layout: `<header>` / `<nav aria-label="Primary">` / `<main id="main">` in `RootLayout`. Auth routes use `AuthHeader` with its own nav, but `<main>` is not wrapped – `AuthLayout` is a plain `<div>`. Worth adding `<main>` to `AuthLayout`; otherwise the skip-link target concept does not apply to the auth routes.

Headings: exactly one `<h1>` per route when the route uses `PageShell`. Sign-in, Register, Reset, and all in-chat modal dialogs inject a bare `<h2>` via `Modal` with no enclosing `<h1>` on the page. `ContactsPage` (via PageShell) has an `h1` "Contacts" but its internal section titles render via `SectionHeader` – which is a styled `<span>`, not `h2`. So an SR user using heading navigation on `/contacts` hears "Contacts" then nothing. See findings 1 and 11.

Buttons vs links: clean across the board. Every onClick target reviewed is either `<button>`, `<a>` / `<Link>`, or `<NavLink>`. The one remaining `<div onClick>` is the scrim-stop-propagation wrapper inside `ModalScrim`, which is inert (just stops propagation) – acceptable; aria-hidden would also be defensible but the scrim is behind everything relevant.

`<aside>` lacks accessible names on the two sidebars – finding 5.

Tab order review for the chat view: Skip link → Logo (unfocusable span) → Chat tab → Public rooms tab → Contacts tab → Sessions tab → Bell → Sign-out → (into main) → Sidebar filter input → Sidebar Create Room button → Sidebar list items (N of them) → Message log (not tabbable) → individual message Edit/Delete buttons (when row has focus-within) → Composer Attach → Composer textarea → Composer Send → RoomContextPanel `Manage room` button. Usable but long; skip link is the rescue.

### 3. Live regions and announcements

Message list: `role="log" aria-live="polite" aria-relevant="additions text" aria-label="Message history"` on the virtualised scroller. This is as strong as it gets without a full Braille/log role dance. Note: `role="log"` on a virtualised container has a known quirk – rows that are unmounted (scrolled off-screen) and then re-mounted can be announced as additions. `aria-relevant="additions text"` is a sane default; changing to `aria-relevant="additions"` alone would suppress re-announces of remounted rows but also suppress edit-in-place updates. The current setting favours correctness over verbosity.

Toasts: `ToastHost` wraps all toasts in `role="region" aria-label="Notifications" aria-live="polite"`. Individual toasts get `role="alert"` for error/warn and `role="status"` for info/success. The per-toast role is applied both in `Toast.tsx` and in `ToastHost.tsx`; because AT picks up the innermost role, the effective value is correct. Double-role is a code-smell but not a functional bug. Consider cleaning up by removing `role` from `Toast.tsx` and letting the host assign it based on tone – fewer sources of truth.

Double-landmark note: the `ToastHost` region is labelled "Notifications", and the `NotificationMenu` popover is also labelled "Notifications". Two "Notifications" regions readable on the same page – the Bell popover name should probably change to "Notification inbox" or "Notifications menu" to disambiguate from the toast host.

Notification bell: when the unread count changes the Bell's `aria-label` flips between "Notifications" and "Notifications, N unread". There is no live region reading the change itself – a rising unread count is silent until the user interacts with the Bell. This is an acceptable trade-off (avoids hijack), but is not an announcement. An alternative pattern is a visually-hidden `<span aria-live="polite">` sibling that pushes a string when `unreadCount` increases; it is very easy to get this one wrong (announcing on every render) so the current silence-is-safe approach is defensible.

Form submission errors: the error Toast has `role="alert"`, so the text announces on mount. The underlying inputs remain `aria-invalid="false"` – finding 3.

Pagination load: when older messages are being fetched, `MessageList.tsx` renders an inline spinner + "loading older messages…" inside the log scroller (line 483). Because the scroller is `role="log" aria-live="polite"`, that text announces when it enters the DOM – which is usually what the user wants ("something is loading"). The spinner itself is `aria-hidden="true"`, so only the text reads. Neat by accident.

### 4. Colour + contrast

All primary ink/paper pairs clear AA with margin. Recomputed against current tokens:

| Pair | Ratio | AA normal | AA large | Notes |
|---|---|---|---|---|
| `--ink-0` on `--paper-1` | 15.75:1 | pass | pass | Primary body text |
| `--ink-1` on `--paper-1` | 10.92:1 | pass | pass | Secondary body |
| `--ink-2` on `--paper-1` | 5.01:1 | pass | pass | Timestamps on paper |
| `--ink-3` on `--paper-1` | 4.85:1 | pass | pass | Previously-failing pair, now fixed |
| `--ink-3` on `#fff` | 5.20:1 | pass | pass | Message timestamps inside the list |
| `--accent` on `--paper-1` | 5.50:1 | pass | pass | Link-variant button text |
| `--accent-ink` on `--paper-1` | 8.55:1 | pass | pass | Link emphasis |
| `--accent` on `#fff` | 5.90:1 | pass | pass | Primary button text / focus ring |
| `--accent-ink` on `--accent-soft` | 7.58:1 | pass | pass | Accent badge |
| `--danger` on `--danger-soft` | 5.61:1 | pass | pass | Error border / text |
| Toast error fg `#6b2a20` on `--danger-soft` | 8.70:1 | pass | pass | Error toast body |
| Toast success fg `#2a4a2a` on `#f1f8ef` | 9.19:1 | pass | pass | Success toast body |
| Toast warn fg `#5a4a2a` on `#fbf5e4` | 7.88:1 | pass | pass | Warn toast body |
| Badge private fg `#5a4a2a` on `#efe9d8` | 7.07:1 | pass | pass | Private badge |
| `--mention-fg` on `--mention-bg` | 4.28:1 | **fail** | pass | Bell unread overlay – finding 4 |
| `--online` (`#3f7a3a`) on `--paper-1` | 4.83:1 | pass | pass | When tinted to text |
| `--afk` (`#b48a2a`) on `--paper-1` | 2.96:1 | n/a (swatch) | n/a | Non-text – finding 13 |
| `--offline` (`#a59b7d`) on `--paper-1` | 2.58:1 | n/a (swatch) | n/a | Non-text – finding 13 |
| Focus ring `--accent` on `--paper-1` | 5.50:1 | n/a (UI) | pass | 3:1 required for UI – comfortably clear |

Text-pair compliance is solid. The two non-text items (mention badge for small-count indicator text, presence swatches at low brightness) are the only real colour findings.

### 5. Forms

`Input.tsx` uses `useId` + explicit `htmlFor` association; every call-site passes `label=`. Auth pages set appropriate `autoComplete` (`email`, `username`, `new-password`, `current-password`) and `required`. Password fields opt into `reveal` to get a native-feeling show/hide toggle (which is `aria-pressed` + `aria-label`).

Concrete spot checks:

- `SignInPage`: email → `type="email" autoComplete="email" required`; password → `type="password" autoComplete="current-password" required reveal`. Both carry the `error` prop which colours the border. Good.
- `RegisterPage`: email, username, password, confirm all `required`; password + confirm both use `autoComplete="new-password"` so password managers offer a generated password (correct). `minLength={8}` is wired too.
- `ResetPasswordPage`: `ConsumeForm` mirrors RegisterPage; `RequestForm` has a lonely email input. Good.
- `CreateRoomDialog` (Sidebar): name + description inputs have labels but no `required`, `aria-required`, or format hints. Since the server validates, this is acceptable, but a simple `required` on name (which is enforced in the button's disabled state) would tighten keyboard UX.
- `InviteTab` (ManageRoomModal): single username input, labelled. Same pattern.

Gaps:
- `aria-invalid` / `aria-describedby` wiring to error Toasts is missing – finding 3.
- `Check.tsx` radios/checkboxes do not group-label – finding 6.
- `Textarea.tsx` has no `label` prop; Composer opts in manually via a `sr-only label`. Future Textarea consumers need to remember this pattern – consider lifting it into the primitive.
- `ResetPasswordPage` has both `password` and `confirm` as `autoComplete="new-password"` which is correct for browser password managers.
- No form uses `<fieldset>` anywhere in the app. The CreateRoom visibility radios are the clearest case, but a generic form-fieldset pattern would be useful for future multi-field groupings.

### 6. Non-text affordances

Presence glyphs: shape + colour, `aria-hidden="true"` on the SVG, accessible name flows through the containing `ContactListItem`'s `aria-label`. Good. Standalone presence on the room context panel gets the same treatment – `<MemberRow>` in ChatView renders `<ContactListItem>`, so the name+status pattern is consistent.

Avatar: no `aria-label`, no `alt`, nothing marking it decorative. When shown next to a username it is effectively redundant; when shown alone (rare) the single letter is read out. Round 1 item 16 remains unaddressed in Avatar itself but is mitigated because the component is only used via message/presence rows that already carry the username. Low priority. For future robustness, default `Avatar` to `aria-hidden="true"` and accept a `title`/`aria-label` prop for standalone uses.

Bell icon: `aria-label="Notifications"` / `"Notifications, N unread"`. Inner SVG is `aria-hidden="true"`. Good. The unread count display inside `Badge tone="mention"` is also `aria-hidden="true"` via `pointerEvents: 'none'` on the outer span (which removes it from interaction). Good.

Image attachments: `<img alt={originalFilename}>` via `FileCard` for real images; the button that opens the lightbox has `aria-label={`Open ${name} in full view`}`. Good. The lightbox has `role="dialog" aria-modal="true" aria-label={alt}` so the image name is announced; the close button is `aria-label="Close"` rather than the visible "close · esc" which would otherwise read oddly. Download link has a sensible "download original" label.

Non-image attachments: the `FileCard` fallback renders an `<a href={href}>` with a 4-char kind pill + filename + size. The anchor has no `aria-label` override, so the accessible name is the concatenated text of the three spans ("PDF spec.pdf 1.2 MB"). Readable but slightly noisy. Consider wrapping the kind/size in a single `aria-label` on the anchor.

LockIcon: `aria-hidden="true"` inside the SVG. `RoomName` wraps it in a `<span aria-label="private room">` when the room is private, which is correct – the lock carries meaning because the `#name` does not itself communicate visibility. In the sidebar `RoomListItem` the row's own `aria-label` includes "Private room", and the lock SVG is inside a `<span aria-hidden="true">` wrapper, so the lock is just a visual reinforcement there. Consistent and correct – the pattern "one canonical `aria-label` on the row, decorative SVG hidden" is exactly what APG recommends.

Mention badge inside message rows (not the Bell overlay): when a message mentions the current user, `MessageRow` adds a left rail tinted with `--mention-fg` and a wash of `--mention-wash`. The rail + wash are not the only cue – the mentioned username inside the message body is styled in bold via the markdown-ish render path. Non-visual users hear the username in context; sighted-low-vision users get the wash. Colour-alone check: no – shape rail + username styling provide redundancy.

### 7. Keyboard shortcuts

Composer: Enter sends, Shift-Enter newlines. The hint "⏎ send · ⇧⏎ newline · paste images" is associated via `aria-describedby`. Good. Ctrl-V / Cmd-V with images on the clipboard triggers the paste handler and auto-uploads; the handler swallows the default paste to avoid stuffing image data URLs into the text body. Users with image-heavy workflows benefit. No Ctrl-Z / undo semantics on the pasted attachments – each has a remove × button rendered via `IconButton aria-label={`Remove ${filename}`}`.

Inline edit: `⌘⏎` / `Ctrl⏎` saves, Escape cancels. The hint is a plain `<span>` sibling of the buttons – not `aria-describedby`-wired to the textarea. Because the hint sits directly below the textarea in reading order it still reads before the Save/Cancel buttons, but a formal association would not hurt. The auto-focus to end-of-value on mount is correct: `setSelectionRange(el.value.length, el.value.length)` is what assistive tech expects for "start editing here".

Jump-to-latest pill: `<Button variant="primary">`, so it is keyboard-reachable and focus-ringed. It appears only when `!isAtBottom && messages.length > 0`, which is fine. There is no `aria-label` – the visible text "Jump to latest" is the accessible name; the button does not announce its hidden-when-at-bottom state (which is correct – it is simply removed from the tree). Smooth scroll on activation does not respect `prefers-reduced-motion` (finding 7).

Message list scrolling: a keyboard user can Tab into the log, but the log is not a focusable element (`role="log"` on the scroller without `tabindex`). Arrow-key scrolling inside `<div>` requires focus; today the only way in is to Tab onto one of the message-action buttons inside a row. Acceptable for MVP; consider `tabindex="0"` on the scroller if keyboard scroll of history is a priority. Some screen readers expose virtual-cursor navigation through a `log` region regardless, so the experience is less bad than it sounds, but a keyboard-only user without an SR cannot easily scrollback.

Global shortcuts: none implemented. No Ctrl-K / Cmd-K command palette, no search shortcut, no "/" to focus filter. Fine – the app is small enough. If/when those land, documented in a keyboard-help dialog (`?` trigger) per WAI-ARIA APG's keyboard-shortcut guidance.

### 8. Time and localisation

`Intl.RelativeTimeFormat('en', {style: 'narrow', numeric: 'always'})` in `NotificationRow.tsx:76`. Module-level constant, locked to `en`. Fine for MVP; noted in finding 20. The cached formatter is memoised by closing over it once at module load, which means a later locale switch would not pick up the new language – when i18n lands this will need to move inside a `useMemo` keyed on the user's language preference.

`SessionsPage.tsx:19` has its own bespoke relative-time helper that returns strings like "in 12h" / "3d ago" / "just now". Also English-only and also not routed through `Intl.RelativeTimeFormat` – consider unifying. Two formatters doing similar jobs is a minor duplication that invites drift.

No `mm:ss` rendering in the app (the only time format is `HH:MM` in MessageRow and relative strings in NotificationRow and SessionsPage). `MessageRow` timestamps should ideally be `<time dateTime>` – finding 14. For SessionsPage the absolute timestamps rendered via `shortDate` ("17 Apr, 09:12") are already locale-aware (undefined locale = user's, `day: '2-digit'`, `month: 'short'`, etc.) – the wrap in `<time>` is the only gap.

`DaySeparator.tsx` uses `Intl.DateTimeFormat` via `toLocaleDateString` with an undefined locale, so it follows the browser preference. "Today" and "Yesterday" are hardcoded English strings; an i18n pass would need to localise those two strings while keeping the date-format logic intact. The `role="separator"` + `aria-label={text}` on the outer element is correct – SR users hear the label, not the two hairline spans flanking it.

### 9. Motion and animation

`Spinner.tsx` runs `animation: agora-spin 0.8s linear infinite` unconditionally. Same for the in-line pagination spinner (`MessageList.tsx:482`, 700ms). No `@media (prefers-reduced-motion: reduce)` rule anywhere in the codebase.

`scrollTo({ behavior: 'smooth' })` in `MessageList.tsx:577` (Jump-to-latest). Unconditional.

See finding 7.

### 10. Notifications

`NotificationMenu`: `role="dialog"` + `aria-label="Notifications"`. Lacks `aria-modal`, focus trap, initial focus, focus return. See finding 2.

Bell trigger (`Bell.tsx`): `<button>` with an `aria-label` that flips between "Notifications" and "Notifications, N unread" based on `unreadCount`. The inner SVG is `aria-hidden="true"`. The unread count renders inside a `Badge tone="mention"` absolutely positioned at the top-right – this is the contrast miss flagged in finding 4. The Bell never sets `aria-expanded` / `aria-haspopup` / `aria-controls`, so the trigger/popover relationship is opaque to AT. When the menu opens there is no state change announced; a user who hit Enter on the Bell only knows the menu opened because their subsequent Tab behaviour changes.

`NotificationRow`: real `<button>` with grid-of-spans children. Accessible name defaults to concatenated text content – title, body, relative time. Acceptable but a bit noisy ("@bob, hello there, 2m" reads in one burst). For mentions, the title is `#general - mention` and the body is the snippet; that reads "hash general space hyphen space mention" before the body. Consider building an explicit `aria-label` per row in `NotificationRow` that reads "{kind in prose}: {snippet}, {relative time}" – e.g. "Direct message from bob: hello there, 2 minutes ago".

Mark-all-read button: `disabled={notifs.every(n => n.readAt !== null)}`. Removes from tab order when all read – see finding 10. The button is inside the menu panel's top strip; when disabled, a user who tabs through the panel skips it entirely, which is correct native `disabled` semantics but reduces discoverability. An `aria-disabled="true"` with a no-op onClick keeps the control in the tab order and announces its state.

Desktop permission prompt: "Enable desktop notifications" is a `Button variant="link"` in a strip at the bottom of the menu. Focusable, labelled, fine. It only renders when `nativePermissionState()` returns `'default'`, so after the user has accepted or denied once it is gone – no aria-live announcement of that transition, but the user initiates the state change so no announcement is strictly needed.

Tab order inside the menu (once focus is inside): Mark-all-read → each NotificationRow → Enable-desktop-notifications. Acceptable. The rows are not grouped via `role="list"` / `role="listitem"`, which is a WAI-ARIA APG nit for a disclosure menu. If we reclassify the panel as `role="menu"` + each row as `role="menuitem"` (per finding 2's preferred direction), the APG-style arrow-key navigation also becomes available.

## Contrast check

Reproduced here for easy scanning. All ratios computed via the WCAG 2.1 relative luminance formula on the current hex values in `apps/web/src/styles/tokens.css`.

| Token pair | Ratio | AA small | AA large | UI (3:1) | Verdict |
|---|---|---|---|---|---|
| ink-0 on paper-1 | 15.75:1 | pass | pass | pass | clean |
| ink-1 on paper-1 | 10.92:1 | pass | pass | pass | clean |
| ink-2 on paper-1 | 5.01:1 | pass | pass | pass | clean |
| ink-3 on paper-1 | 4.85:1 | pass | pass | pass | clean (was failing in R1) |
| ink-3 on paper-2 | 4.39:1 | fail | pass | pass | acceptable for MetaHeader aside only |
| ink-3 on paper-0 | 5.14:1 | pass | pass | pass | clean |
| ink-3 on #fff | 5.20:1 | pass | pass | pass | clean |
| ink-2 on paper-2 | 4.54:1 | pass | pass | pass | clean |
| accent on paper-1 | 5.50:1 | pass | pass | pass | link text safe |
| accent-ink on paper-1 | 8.55:1 | pass | pass | pass | strong link emphasis |
| accent on #fff | 5.90:1 | pass | pass | pass | clean |
| accent-ink on accent-soft | 7.58:1 | pass | pass | pass | accent badge |
| danger on danger-soft | 5.61:1 | pass | pass | pass | danger border + border-side |
| Toast success fg (#2a4a2a) on #f1f8ef | 9.19:1 | pass | pass | pass | clean |
| Toast warn fg (#5a4a2a) on #fbf5e4 | 7.88:1 | pass | pass | pass | clean |
| Toast error fg (#6b2a20) on danger-soft | 8.70:1 | pass | pass | pass | clean |
| Badge private fg (#5a4a2a) on #efe9d8 | 7.07:1 | pass | pass | pass | clean |
| mention-fg on mention-bg | 4.28:1 | **fail** | pass | pass | **finding 4** |
| online on paper-1 (text) | 4.83:1 | pass | pass | pass | if used as text |
| afk swatch on paper-1 (non-text) | 2.96:1 | – | – | **fail** | **finding 13**, shape rescues meaning |
| offline swatch on paper-1 (non-text) | 2.58:1 | – | – | **fail** | **finding 13**, shape rescues meaning |

## New surfaces since 2026-04-18

Between round 1 and today, several new primitives and features landed. Their accessibility status is tabulated here so future audits can see what arrived in this window and whether it arrived clean.

- `Spinner` (R3 DS addition, `apps/web/src/ds/Spinner.tsx`): `role="status"` + accessible `aria-label` defaulting to "Loading". Misses `prefers-reduced-motion` gate – finding 7.
- `IconButton` (R3 DS addition, `apps/web/src/ds/IconButton.tsx`): enforces `aria-label` in its TS signature – the `'aria-label': string` type is required. Prevents future icon-only buttons from shipping unlabelled. Excellent hygiene.
- `EmptyState` (R3 DS addition, `apps/web/src/ds/EmptyState.tsx`): plain text caption + optional hint; no ARIA. Not needed – the content is static and announced as part of page flow. Uses `ink-3` for the hint (5.14:1 on paper-0, fine).
- `DaySeparator` promoted from inline to DS; `role="separator"` + `aria-label`.
- `RoomName` primitive (R3-13, `apps/web/src/ds/RoomName.tsx`): wraps LockIcon in `aria-label="private room"` when private. Unifies the four previously-ad-hoc padlock sites. Good.
- `Bell` redesign (R3-20): 28×28 hit target, badge absolutely positioned top-right. Hit target clears WCAG 2.5.5 AAA (24 × 24 minimum, 44 × 44 recommended) – 28 × 28 is above the minimum.
- `NotificationMenu` (new feature): see findings 2 and 10.
- `NotificationRow` (new feature): see finding 9.
- `ImageLightbox` (round 2, `apps/web/src/ds/ImageLightbox.tsx`): `role="dialog" aria-modal="true" aria-label={alt}`. Escape handler wired. Close button labelled.
- `ConfirmModal`: inherits from Modal.
- List-row hover wash (`--row-hover`, R3-12): background-only, no interaction with focus rings. Does not interfere with the focus-visible outline, verified by mental simulation.
- `Intl.RelativeTimeFormat` replaces hand-rolled helper (R3-22): see area 8 note. Regression risk: locale lock – finding 20.
- Native-notification permission prompt (`NotificationMenu:151-168`): shows only when `'default'`. Button is keyboard-reachable.
- Desktop notification fire path (`features/notifications/native.ts`): each notification is a native OS toast that does not appear in the in-app DOM. AT behaviour is delegated to the OS – acceptable as the in-app `NotificationMenu` provides the primary accessible view.

No unambiguous regressions. The `NotificationMenu` disclosure pattern (finding 2) is a new-surface issue rather than a regression – it did not exist in round 1. The mention-badge contrast miss (finding 4) existed in round 1 but was less visible because the Bell did not yet render a count there; the Bell feature amplified an existing latent issue.

## What's already solid

- The focus contract is consistent and testable. Every primitive reachable by keyboard shows the accent ring; every modal traps focus, handles Escape, and restores focus on close. This is the single biggest delta from the round 1 audit and it has been executed properly – including the subtle Tab-wrap at both ends, and the `previouslyFocused?.focus?.()` guard on cleanup so a modal that opens from a transient element does not throw.
- Landmarks are real: `<header>`, `<nav aria-label="Primary">`, `<main id="main">`, `<aside>`, `<section>` are HTML elements with appropriate attributes on them. The only naming gap is the two `<aside>`s and the unlabelled `<section>`s in ContactsPage.
- Live regions exist for the three dynamic surfaces that matter: message list (`role="log"`), toasts (`role="alert"` / `role="status"`), and the Composer char counter (`aria-live="polite"`). Noise is low – neither the toast nor the log announces on every keystroke.
- Text contrast on warm-paper surfaces is AA-clean end to end, including the previously-failing `ink-3` timestamps. The single remaining text-contrast miss is the mention badge on the Bell overlay. Auxiliary Toast colours (success/warn/error) all clear 7:1, comfortably AAA for a non-blocking case.
- Presence is shape + colour, not colour alone. Offline outlined, AFK half-filled triangle, online filled square – covers NFR-A11Y-1. The SVG re-draw (R3-21) fixed the stroke-wrap bug that made AFK read as outlined with a streak.
- The skip-link has a real target with a visible focus ring (R3-23). This is usually an afterthought and it has been done properly.
- Input has correct `useId` + `htmlFor` wiring, password reveal is `aria-pressed`, `autoComplete` hints are present on every auth field, and the field-error `error` prop drives the danger border without relying on colour alone (the border changes thickness subtly via `ruleStrong` vs rule).
- The `ConfirmModal` primitive replaces `window.confirm` consistently. Destructive actions route through it (delete message, delete room) and the focus returns to the element that opened the dialog. This was a round 1 systemic issue.
- `RoomListItem` has `aria-current` when it is the active room – the same treatment as the top-nav NavLinks. Subtle but right.

## Verdict

Not AA today, but very close. Two high-severity items (heading hierarchy inside Modal across every auth route; NotificationMenu disclosure pattern) and one high-severity contrast item (mention badge) are the blockers. A morning's work closes all three. The medium cluster (aside names, radio-group fieldset, form-error aria wiring, reduced-motion, ellipsis-spinner) is a subsequent half-day. Nothing architectural is missing – the primitives are in place, it is mostly wiring.

## Recommended ADRs

1. **Disclosure pattern for topbar popovers (Bell, future profile menu, future settings)** – pin whether we use `role="menu"` + roving tab index, or `role="dialog" aria-modal`. Today `NotificationMenu` sits between the two. A short ADR fixes the convention so future popovers do not drift. Implementation should cover: Esc, outside-click, return-focus-on-close, keyboard navigation inside the panel.

2. **Form error announcement contract** – define how `<Input>` couples to its error message. Proposal: `Input` accepts an `errorMessage?: string`; when present it renders a `<div role="alert" id={errorId}>{errorMessage}</div>` directly under the input and threads `aria-invalid="true"` + `aria-describedby={errorId}` onto the `<input>`. Auth pages, Create-room, Invite, and any future form drop the Toast-as-error pattern in favour of this.

3. **Heading hierarchy through Modal** – either Modal accepts a `titleLevel` prop, or every route that uses a Modal as primary surface wraps it in a visually-hidden `<h1>` first. Either way, the tree should never contain a bare `h2` without an ancestor `h1`.

4. **Reduced-motion policy** – a single CSS block in `base.css`:
   ```
   @media (prefers-reduced-motion: reduce) {
     * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; scroll-behavior: auto !important; }
   }
   ```
   plus a small `usePrefersReducedMotion()` hook for scroll-to-latest. Avoids the whack-a-mole pattern.

5. **Non-text contrast for status glyphs** – document the decision to lean on shape for presence (AFK, offline). An ADR pins the rationale so future designers do not try to "fix" the swatches by darkening them toward homogeneity with ink-2 and losing the distinct-palette identity.
