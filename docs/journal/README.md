# Journal

A running log of decisions, detours, and lessons. Written as we go so the train of thought survives the end of the event.

The point isn't just a submission artefact. It's so that after the hackathon we (and anyone reading) can follow the exact sequence of questions, options weighed, choices made, and reversals — not just the final state of the code.

## Conventions

- One file per session, named `YYYY-MM-DD-topic.md`.
- Present-at-the-time voice. If we got something wrong and learned later, annotate with a later `**Update (YYYY-MM-DD):**` line, don't rewrite history.
- Each entry ends with a **Takeaways** section — the bit worth reading even if you skim.
- Decisions that have consequences beyond a single session get promoted to an ADR in `docs/adrs/` and are cross-linked.

## Entries

| Date | Session | File |
|---|---|---|
| 2026-04-17 | Pre-event prep and audit | *(covered inline in first kickoff entry)* |
| 2026-04-18 | Kickoff and ADLC setup | [2026-04-18-kickoff.md](2026-04-18-kickoff.md) |
| 2026-04-18 | Build day — features, integration, smoke | [2026-04-18-build.md](2026-04-18-build.md) |
| 2026-04-18 | Auth + sessions (subagent) | [2026-04-18-auth.md](2026-04-18-auth.md) |
| 2026-04-18 | Rooms (subagent) | [2026-04-18-rooms.md](2026-04-18-rooms.md) |
| 2026-04-18 | Messages (subagent) | [2026-04-18-messages.md](2026-04-18-messages.md) |
| 2026-04-18 | Presence (subagent) | [2026-04-18-presence.md](2026-04-18-presence.md) |
| 2026-04-18 | Friends (subagent) | [2026-04-18-friends.md](2026-04-18-friends.md) |
| 2026-04-18 | Attachments (subagent) | [2026-04-18-attachments.md](2026-04-18-attachments.md) |

## The philosophy underneath

**Context first, code second.** The hackathon is explicitly an experiment in *agent-herded* development. The quality of the context we set up — specs, requirements, architecture, design language, operating manuals — bounds what the agent can plausibly build. Jumping straight to implementation without that scaffolding is how past participants lost the plot. So the first working day is almost entirely spent on documents, not code. The agent then has something authoritative to consult for every decision that would otherwise become a guess.

This journal itself is part of that scaffolding: it's where rationale lives. Code tells you *what* and *how*; the journal tells you *why*, and more importantly, *why not the alternatives*.
