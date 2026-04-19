# ADR-0008 · Modal and popover heading + focus contract

- **Status**: Accepted, 2026-04-19
- **Relates to**: NFR-A11Y-1 (WCAG 2.1 AA), accessibility audit 2026-04-19 (H1 – heading hierarchy, H2 – NotificationMenu focus contract)

## Context

The accessibility audit flagged two distinct-looking problems that share a root cause: there is no single contract for "overlay surface". `Modal` hard-codes the title as `<h2>`, which means routes that only render a Modal (auth: `/sign-in`, `/register`, `/reset`) have no `<h1>` at all – screen-reader rotor navigation is stunted and the heading outline is broken. `NotificationMenu` declares `role="dialog"` but does not trap focus, does not move focus on open, does not return focus to the Bell on close, and does not announce itself as modal.

Product audit added that NotificationMenu does not reposition or close on window resize across all browsers – which also suggests "overlay surface" is not a well-specified concept.

The DS already ships `Modal`, `ConfirmModal`, `NotificationMenu`, and `ImageLightbox` – four overlay surfaces, four informally-different contracts. This ADR pins the contract.

## Decision

Adopt a single **overlay contract** for every DS component that paints above the page:

1. **Heading level is configurable.** `Modal` and any derivative accept `titleLevel?: 1 | 2 | 3` (default 2). Auth pages pass `titleLevel={1}`. `ConfirmModal` inherits. `aria-labelledby` points at the rendered heading.

2. **`aria-modal="true"`** on every overlay that demands exclusive focus. `Modal` yes. `NotificationMenu` no – a disclosure dropdown is not a modal; it uses `role="menu"` + `aria-orientation="vertical"` on the list and keeps `aria-expanded` on the trigger.

3. **Focus trap.** When an overlay is `aria-modal="true"`:
   - On open, save `document.activeElement`, move focus to the first `[autofocus]` or the first tabbable descendant.
   - Intercept `Tab` at the boundary: shift-tab on first element wraps to last, tab on last wraps to first.
   - On close, restore focus to the saved element.
   - `Escape` calls `onClose`.

4. **Disclosure popovers (NotificationMenu).** Not a focus trap. Instead:
   - Tab moves naturally in/out of the panel; the trigger button has `aria-expanded={open}` and `aria-controls={menuId}`.
   - `Escape` closes and returns focus to the trigger.
   - Click-outside closes.
   - Window resize or scroll either reposition or close (current code closes; that is the chosen behaviour here).

5. **Visible focus** on every focusable descendant of every overlay, regardless of the global `:focus-visible` policy. Overlays own their focus ring.

6. **Single DS hook.** A new `useOverlay({ onClose, trapFocus })` hook implements points 3 (trap) and 4 (escape + click-outside). `Modal`, `ConfirmModal`, `ImageLightbox`, and `NotificationMenu` all consume it. Consumers can't drift.

## Consequences

**Positive**

- Closes accessibility H1 (heading hierarchy) and H2 (NotificationMenu focus contract) in one design pin.
- New overlays get the contract for free. No more copy-paste-adjust.
- The `useOverlay` hook is a small testable unit; focus-trap logic is notoriously subtle (tabbable order, portals, `inert` attribute, `dialog` element semantics) and centralising it means a single place to get it right.

**Negative**

- Touches four existing components. Each consumer migration is non-trivial to visual-test.
- Native `<dialog>` + `showModal()` would be the cleanest primitive but has browser support quirks (custom scrim, body scroll lock, iOS viewport bug). We are not adopting `<dialog>` in this ADR; the hook owns the behaviour on a plain `<div role="dialog">`. Reconsider when the open items for native `<dialog>` settle.

**Alternatives considered**

- *Fix each overlay in isolation*: rejected. Four copies of focus-trap logic will drift again in three weeks.
- *Adopt React Aria / Radix UI for overlays*: would solve this comprehensively, but a dependency addition of that weight belongs in a separate "pull in a headless component library" ADR, not here. For the hackathon the hand-rolled hook is cheaper.

## Implementation

Landed in commit <SHA> on 2026-04-19. New internal hook `apps/web/src/ds/useOverlay.ts` centralises Escape + click-outside + focus-trap + focus-return. `Modal` accepts `titleLevel` and renders `aria-modal="true"` with `aria-labelledby`. `ConfirmModal` forwards `titleLevel`. `ImageLightbox` and `NotificationMenu` consume the hook. Auth pages (SignIn, Register, ResetPassword) pass `titleLevel={1}` so the page has a real `<h1>`.
