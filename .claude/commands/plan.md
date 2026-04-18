---
name: plan
description: Turn a requirements file into an executable plan under docs/plans/
---

# /plan

Transform `docs/requirements/<area>.md` into `docs/plans/<area>.md`. Do not start implementation in this command; only produce the plan.

## Arguments

- `<requirements-file>` — path under `docs/requirements/`.

## Steps

1. Read the target requirements file top to bottom. Confirm no "Open questions" remain unresolved; if they do, stop and run `/feature` instead.
2. Read:
   - `docs/spec.md` — for requirement IDs.
   - `docs/architecture.md` and `docs/data-model.md` — for module / table layout.
   - `docs/ws-protocol.md` — for wire contracts when the feature touches WS.
   - All ADRs whose titles mention the area.
3. Use `superpowers:writing-plans` to produce the plan document.
4. The plan MUST include:
   - **Goal** — one paragraph, what success looks like.
   - **Files touched** — grouped by app / package.
   - **Ordered steps** — each has a verification point (test, curl, or browser check) and an "abort if" clause.
   - **Migrations** — if DB changes needed, the exact drizzle-kit invocation.
   - **Tests** — unit and e2e to add.
   - **Delivery-contract check** — when to run `/smoke` (typically once mid-plan and once at the end).
5. Save as `docs/plans/<area>.md`. Commit: `docs(plans): add <area> implementation plan`.

## Format

Follow `superpowers:writing-plans` structure. Keep total length under ~200 lines; split into sub-plans if longer.
