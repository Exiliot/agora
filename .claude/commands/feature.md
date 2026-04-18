---
name: feature
description: Start a new feature by running the full ADLC loop (brainstorm → requirements → plan → execute → verify → journal)
---

# /feature

Kick off a new feature cleanly from a blank slate. Use this every time an implementation task starts — never skip.

## Arguments

- `<area>` — the feature area, one of: `auth`, `sessions`, `presence`, `contacts`, `rooms`, `messages`, `attachments`, `notifications`, `ui`, or a new area (in which case create a new requirements file).

## Steps

1. **Re-read the truth**: `docs/spec.md`, `docs/requirements/<area>.md`, relevant ADRs. If the requirements file doesn't exist, stop and write it first.
2. **Brainstorm** using `superpowers:brainstorming`. Resolve every "Open questions" item in the requirements file before moving on. Update the file with the resolutions.
3. **Plan** using `superpowers:writing-plans`. Output: `docs/plans/<area>.md`. Each step ends with a verification point (a test, a curl command, a browser check). Include a "how to abort" section if a step fails.
4. **Execute** using `superpowers:executing-plans` or, if the plan has 3+ independent subtasks, `superpowers:subagent-driven-development`.
5. **Test**: for anything with non-trivial logic (auth flows, session lifecycle, presence state machine, permission rules), use `superpowers:test-driven-development`. Pure UI rendering can lean on Playwright e2e.
6. **Verify** using `superpowers:verification-before-completion`. BEFORE claiming done, run `/smoke`. Confirm the app still boots, health is 200, existing e2e tests pass.
7. **Review** using `superpowers:requesting-code-review` if the feature touches more than one module.
8. **Journal**: append a brief entry to `docs/journal/YYYY-MM-DD-<topic>.md`. One paragraph of context, bullets for decisions and detours, one-paragraph "Takeaways" at the end.
9. **Commit**: conventional commits, one logical commit per meaningful unit. Scope matches `<area>`.

## Anti-patterns to refuse

- Writing code before the plan exists.
- Skipping the journal because "it's a small change".
- Invalidating an ADR without authoring a new one.
- Adding a dependency not justified in the plan.
