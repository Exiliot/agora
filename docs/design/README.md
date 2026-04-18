# Design bundle — Claude Design handoff

This directory is the raw export from a Claude Design (Opus 4.7) session. It is **reference material**, not source code. The Vite app in `apps/web/` ports from this, it does not consume it directly.

## What's here

| File / dir | Purpose |
|---|---|
| `Design System.html` | Standalone page rendering the full design system canvas. Open in a browser. |
| `Screens.html` | Standalone page rendering every major screen. Open in a browser. |
| `design-canvas.jsx` | Shared canvas scaffolding for both pages (sections, artboards). |
| `ds/primitives.jsx` | Tokens + atoms: `Button`, `Input`, `Badge`, `Avatar`, `Presence`, `Check`, `Swatch`, layout helpers. |
| `ds/components.jsx` | Composite components: message rows, file cards, composer, lists, modals, toasts, table, tabs. |
| `ds/app.jsx` | Top-level design system composition — principles, brand, colours, type, spacing, lists, modals. |
| `screens/` | Full page layouts: `auth.jsx`, `main.jsx`, `modals.jsx`, `sessions.jsx`, `chrome.jsx`, `app.jsx`. |
| `uploads/` | The original task materials that fed the design session (requirements PDF, wireframes, task notes). |

## The design language — non-negotiable constraints

Six principles enforced throughout. These are not preferences; they are rules the implementation must respect.

1. **Text first** — a chat is a river of text. Type leads, chrome follows.
2. **Density honestly** — power users re-read history. 3px row padding, not 14px.
3. **No bubbles** — message rows are `[HH:MM] nick: message`. The invariant the last 40 years of chat clients chose.
4. **One accent, one hue** — oxidized teal `oklch(0.52 0.07 190)` for all emphasis. Status has its own flat palette. Everything else is ink or paper.
5. **Hairlines > shadows** — 1px rules do the layout work. Shadows only for floating surfaces (popovers, dialogs).
6. **Mono for truth** — timestamps, IDs, file sizes, counts are all mono. Never lie with proportional digits.

## Tokens to port into `apps/web/`

The full token set lives in `Design System.html` (`:root` CSS vars). Every token is named and OKLCH-specified for accessibility-safe lightness. Port verbatim into `apps/web/src/styles/tokens.css` — do not invent new values.

Fonts: **Inter** (UI chrome), **IBM Plex Mono** (all chat content, timestamps, IDs, file sizes), **IBM Plex Serif** (wordmark and empty-state display only).

## Status cues — shape + colour, not colour alone

A subtle detail worth protecting during implementation:

- **online** = filled square
- **AFK** = half-filled diagonal square
- **offline** = outlined empty square

Colour reinforces shape; shape carries the signal. This survives colour-blindness and low-contrast displays without extra thought.

## How to view locally

```sh
cd docs/design
python3 -m http.server 8000
# open http://localhost:8000/Design%20System.html
# open http://localhost:8000/Screens.html
```

Or just open the two `.html` files with a `file://` URL in any browser — no build step, fonts load from Google Fonts CDN, React and Babel load from unpkg.
