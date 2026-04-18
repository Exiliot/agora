---
name: spec
description: Re-synthesise docs/spec.md from the task PDF, Q&A, and any clarifications captured since
---

# /spec

Rebuild the canonical product spec from source material when new information lands (kickoff Q&A, mid-event clarifications, organiser updates).

## Arguments

- `refresh` — re-synthesise from scratch.
- `amend <note>` — append a clarification and re-number only if the user asks. Prefer `refresh` for anything beyond a typo.

## Inputs

- `docs/design/uploads/2026_04_18_AI_herders_jam_-_requirements_v3.pdf` — the task brief.
- `docs/journal/*.md` — journal entries that record Q&A exchanges and verbal clarifications.
- Organiser chat transcripts if available under `docs/design/uploads/` or elsewhere.

## Steps

1. Re-read every input.
2. Preserve existing requirement IDs. Retire rather than renumber.
3. For each requirement:
   - If it stayed the same: leave the ID and wording untouched.
   - If it was clarified: keep the ID, update wording, note the clarification in parentheses + source (e.g. "*(kickoff Q&A)*").
   - If it was removed: mark as `[retired]` but do not delete.
4. Non-functional and architectural-constraint sections follow the same rule.
5. Run `git diff docs/spec.md` and walk through material changes in a short commit message body.
6. Update any per-feature requirements files whose content drifted from spec.
7. Commit: `docs: refresh spec from <source>`.

## What to avoid

- Renumbering requirement IDs (breaks every plan and commit that references them).
- Silently adding new requirements (every addition needs a source).
- Collapsing spec into requirements files (spec is the single source of truth — requirements narrow it).
