# 2026-04-18 · Claude Design audit — six-phase closure

Follow-on to `2026-04-18-15-wave-3.md`. After the three internal audit waves closed out the code-quality/security/performance/a11y gaps, I sent the captured UI screenshots (`screenshots/2026-04-18-ui-tour/`, 26 shots) to Claude Design for a dedicated design-system audit. The report came back as a self-contained handoff bundle (`Audit.html`, 30 findings) available at `https://api.anthropic.com/v1/design/h/QVfRCUMvG-PMDJVeMw83Ig`.

This entry covers the full closure: triage, six-phase implementation, and the four deferred items that landed right after.

## What the audit said — headline

> *"Almost every visual miss traces back to **tokens not loading**. Fixing that one root cause should resolve roughly half the findings in a single commit."*

That hypothesis turned out to be dead right. The single-line ordering bug in `apps/web/src/styles/base.css` (`@tailwind base` before `@import './tokens.css'`) meant postcss/tailwind reordered or dropped the `@import`, leaving every `var(--*)` reference resolving to `currentColor` or default. With ~200 references to `--paper-1`, `--rule`, `--accent`, `--ink-*` across the build, the visual effect was:

- Pure-white body (paper-1 cream missing)
- Input borders rendering as bare underlines (`1px solid` → currentColor)
- Primary buttons near-invisible (white-on-white)
- Nav tabs all underlined the same
- Modal title bars flat
- Composer frame absent

Moving `@import './tokens.css'` to line 1 of `base.css` fixed all of it at once.

## Findings by severity

30 total: **14 high · 12 med · 4 low · 3 on-spec** (deliberately called out as correct).

Grouped into six themes that matched six commits:

| Theme | Findings | Example | Landed in |
|---|---|---|---|
| Rendering gaps (live-screenshot observations) | R-01..R-12 | R-01 paper-1 never paints | Phase 1 |
| Tokens & colour | T-01..T-06 | T-01 inline `var(--*)` in pages | Phases 1, 6 |
| Typography | Y-01..Y-05 | Y-01 page H1s serif, should be sans | Phase 2 |
| Layout & density | L-01..L-07 | L-01 right aside 220 not 240 | Phase 2 |
| Components | C-01..C-10 | C-02 ManageRoom missing Admins tab | Phases 3, 4 |
| Screen-specific | S-01..S-07 | S-01 DM blocked state missing | Phase 4, deferred-then-shipped |

Three findings were deliberately **on-spec** (Y-05 message anatomy, C-10 presence shape+colour, S-07 message list scroll preservation). Worth calling those out — not everything was drift.

## The six phases, in landing order

### Phase 1 — CSS plumbing + palette alignment (`88de04b`)

- Moved `@import './tokens.css'` to line 1 of `base.css`.
- Realigned `tokens.css` hex to the Claude Design reference palette: warmer paper (`#fbf7ea` not `#f6f3ec`), saturated hex accent (`#2f6e6a`) in place of the oklch approximation, warm amber for mentions (`#fbecb5` / `#8a6f9e`).
- Added tokens the audit called for: `--scrim`, `--rule-strong`, `--chrome-up`, `--chrome-down`, `--grad-chrome`.
- Mirrored the new tokens in `ds/tokens.ts` (`ruleStrong`, `chromeUp`, `chromeDown`, `gradChrome`, `scrim`, `gradient.chrome`).
- Swapped the four remaining hex hardcodes in DS primitives (`Input.tsx` pressed-top, `Button.tsx` gradient, `Modal.tsx` title-bar gradient, `Sidebar.tsx`+`ManageRoomModal.tsx` scrim rgba) onto the new tokens.
- Swapped the two inline `var(--*)` sites (`AuthLayout.tsx`, `ProtectedRoute.tsx`) onto `tokens.color.*`.
- Guarded sidebar + right-aside against flex collapse: `flexShrink: 0` + `minWidth: 240`.

Verified by comparing `screenshots/2026-04-18-ui-tour/01-auth/01-sign-in.png` (pure white, borderless inputs, no Sign-in button) with `_phase1-verify/01-sign-in.png` (warm cream, boxed inputs, visible teal primary button). The transformation from "tokens missing" to "tokens applied" was immediate and complete.

### Phase 2 — Typography + layout (`e6b12df`)

- Y-01: page H1s across Contacts/Sessions/PublicRooms went from serif 22 to sans 18/600. Serif is reserved for the wordmark per the DS.
- Y-02: room header `# engineering` and DM header `@username` switched to mono 14/600 so they read as IRC channels, not page titles.
- Y-03: composer hint 11px/ink-3 → 12/ink-2.
- L-01: right aside 220 → 240. Symmetric side columns matter when the centre is flex.
- L-02: top header 56 → 44, NavTab padding 10×14 → 12×14. 44 is the "classic chat" header — 56 was reading as "modern web app shell".
- L-05: message rows 3×12 → 2×16 so the timestamp column-aligns with the room header title.
- L-06: composer padding 12 → 8×12.
- NavTab fix caught in the process: the old component had both `borderBottom: '2px solid accent'` and a later `border: 'none'`, the second clobbering the first. The active underline never painted correctly. New component explicitly sets `borderTop/Left/Right: none` and keeps `borderBottom` alone, plus a `plain` variant so the right-side username and Sign out stop rendering the tab-underline (R-04).

### Phase 3 — DS primitives + hygiene (`c9608ff`)

Four new DS primitives so three pages and two dialog wrappers stop inlining the same styling:

- `<PageShell>` — 20×24 padding, 720 max-width, sans 18/600 title, sans 12/ink-2 subtitle. Migrated Contacts, Sessions, Public rooms.
- `<ListRow>` — shared tabular row with `lead`/`title`/`meta`/`actions` slots. Replaces the hand-rolled card in PublicRoomsPage; ready for friend-request / invitation rows later.
- `<ModalScrim>` — single click-outside-to-close wrapper with the `tokens.color.scrim` rgba. Migrated Sidebar's CreateRoomDialog + ManageRoomModal.
- `<AuthHeader>` — 44px top bar for unauth routes mirroring the authenticated shell. Gives `/sign-in` and `/register` Sign in | Register NavTabs on the right.

Other component alignments:

- C-01: CreateRoomDialog's hand-rolled `<input type="radio">` pair → `<Check radio>`.
- C-03: `<Table>` grows a `highlightRowAt` prop; SessionsPage uses it + a `<Badge tone="accent">current</Badge>` lead column.
- C-04: right-aside member count went from second `<Badge>` to plain mono text (`<Meta>`-styled). Stops rooms looking like they have three roles.
- C-05: right-aside `<MemberRow>` now renders through `<ContactListItem>` for visual parity with the sidebar contacts list.
- C-07: `MessageActions` edit/delete swapped from bespoke inline `<button>`s to `<Button variant="link">` / `variant="linkDanger">`. New `linkDanger` variant added to the Button union.
- C-08: Modal `×` grew from a bare 14px glyph to a 24×24 hit area with paper-2 hover wash (via a new `.modal-close-btn` CSS class).

### Phase 4 — Missing surfaces (`3e66691`)

- C-02: `ManageRoomModal` grew a fifth tab, **Admins**, listing the owner (locked) and current admins with a Remove-admin action gated to owner. Tab order now matches the brief: Members · Admins · Banned · Invite · Settings.
- S-04: PublicRooms cross-references `useMyRooms` and renders **Open** (ghost variant) for rooms the caller already belongs to vs **Join** for the rest.
- S-06: ChatView's empty-state raw `<a href="/public">` → react-router `<Link>`. SPA navigation, no full page reload.

### Phase 5 — Polish (`22f8352`)

- Y-04: non-image FileCard metadata footer gained mono typography so the size + comment line reads as one unit with the image-preview branch.
- T-05: the seven-colour nickname hashing array moved from a private const in `Avatar.tsx` into a named export `nickPalette`. `colorForName` now sources from it and stays re-exported via `ds/index.ts` so MessageList (and any future mentions/presence pills) share the single palette.

### Phase 6 — Lint guard (`e93a003`)

- Wrote `tools/lint-design-tokens.mjs`. Walks `apps/web/src/pages` + `apps/web/src/app` for raw `#[0-9a-f]{6}` hex and inline `var(--*)` strings. Exits non-zero on any match so `pnpm lint` gates it.
- Initial run caught six drift sites on SignInPage + RegisterPage left over from earlier iterations (three `var(--accent)` links, one `var(--ink-2)` label, two `var(--danger)` alerts). Fixed all six.
- R-09 upgrade: "invalid credentials" alert went from plain 12px black text (indistinguishable from links) to a real error: left 3px danger rule, soft-danger background, danger-ink text. Both Input fields pass `error` when the form is invalid so the red border lights up.

## The four deferred items — shipped in one follow-up pass (`52c6e86`)

Phase 4 left four items on the "real features, not alignment" list. Closed in a single commit after the main audit pass:

### C-09 — ToastHost + useToast

`ds/ToastHost.tsx` mounts a bottom-right live region inside `RootLayout`. `useToast().push({ tone, title, body })` enqueues a dismissable toast; default ttl 4.5s, sticky with `ttlMs: 0`, click to dismiss. `role="alert"` on warn/error, `role="status"` on info/success. MessageList now routes edit/delete WS errors through toast instead of swallowing to console; Composer uses it for upload failures and send failures.

### S-01 — DM blocked/frozen state

DmView checks whether either side has placed a user-ban:

- `useMyBans` (outgoing — existing hook) returns bans I placed.
- `useIncomingBans` (new) returns bans others placed against me. Required a small server change: `GET /api/user-bans` now takes `?direction=incoming|outgoing` (default outgoing; existing callers unaffected).

If either list contains the DM counterparty, DmView swaps `<Composer>` for a warn-toned banner and keeps `<MessageList>` mounted (read-only). Copy differs by direction: "You've blocked X" vs "X has blocked you" — both note that history remains.

### S-02 — Composer attach + reply-to chip

Composer grew:

- 📎 Attach button (file picker) and a paste-handler. Both call `uploadAttachment`. Pending uploads render as removable chips above the textarea.
- `attachmentIds` (the five freshly-uploaded ids) thread into `message.send` and the server-side linking from wave-3 picks them up — so attachments stop orphaning and get visible to all conversation members, not just the uploader.
- Optional `replyTo: { id, author, body }` prop. When provided, renders a dismissable chip with `↳ replying to @author: preview` above the textarea and passes `replyToId` into the send payload. MessageRow wire-up to feed this chip is one more edit away; the primitive is ready.

### S-05 — ContactsPage as tabs

Six stacked sections became a `<TabBar>` with `Friends · Requests (N) · Invitations (N) · Blocked`. Requests and Invitations counters read from the same hooks that drive the top-nav notifications badge, so the numeric indicators stay in sync. The "Add a friend" search stays above the tabs as a persistent affordance.

## Verification

- `pnpm typecheck` — clean (3 workspaces).
- `pnpm --filter @agora/api test` — 61 / 61.
- `pnpm lint:tokens` — clean after fixes.
- `npx playwright test` — 7 / 7. The friends-flow e2e test needed a one-line update to click the new Requests tab before accepting (was clicking Accept directly when the section was flat).
- Visual comparison between the original capture set (26 shots in `_original/`) and the `_final-verify/` captures shows: paper-1 cream throughout, boxed inputs, visible primary buttons, active tab underlines, frozen-DM toast banner, attach-button, contacts tabs.

## The deferred-items lesson

I initially deferred S-01, S-02, C-09, S-05 after Phase 4 as "real features, not pure alignment". That was the wrong framing. The audit was explicit about them being ship-blocking alignment ("brief explicitly calls for five tabs", "personal DMs freeze, history remains read-only", "no toast stack", "six stacked sections"). Landing them in the same pass as the alignment fixes made more sense than splitting — and the total work was 450 lines across 10 files, a one-hour commit once the primitives from Phase 3 were already in place.

The right order for the next design-audit cycle is:

1. Pure-CSS root-cause fixes first (one-line wins).
2. Typography + layout (mechanical find-and-replace).
3. Primitive extractions that cluster related drift.
4. *All* the brief-alignment items — don't split "polish" from "features".
5. Lint guard against regressions.

Splitting by severity is right for triage. Splitting by "alignment vs feature" is an excuse to punt.

## Takeaways

- **One CSS `@import` ordering bug was responsible for ~half the visual drift** between the Claude Design handoff and my build. When a visual audit lists 12 rendering findings that all echo "tokens missing", trust the pattern and check the CSS cascade first — don't fix each symptom.
- **Audits are most valuable when the auditor sees the rendered artefact, not the source.** The internal wave-1..wave-3 audits were source-reads and caught real issues, but they all missed the R-01..R-12 class because reading `Input.tsx` told you the border was `1px solid var(--rule)`; only a screenshot told you the variable wasn't resolving. Mixing source audits with screenshot audits is the right posture.
- **Published DS primitives stop rework.** `PageShell`, `ListRow`, `ModalScrim`, `AuthHeader` weren't in the audit. They emerged from "where is the same styling repeated four times?" The cost to extract was 150 lines total; the value is that the three pages and two dialog wrappers can't drift again.
- **Lint guards are cheap insurance.** `tools/lint-design-tokens.mjs` is ~50 lines and found six drift sites on its first run. Adding it as a CI gate means the next time someone (including me in a month) adds `color: 'var(--accent)'` inline, the build fails.
- **The "tokens.ts mirrors tokens.css" pattern is structurally correct** (T-06 called this out as on-spec). Keep it. A single source of truth for colour lives in CSS; the TS layer mirrors names only, never values.
