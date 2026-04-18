# Journal

A running log of decisions, detours, and lessons. Written as we go so the train of thought survives the end of the event.

The point isn't just a submission artefact. It's so that after the hackathon we (and anyone reading) can follow the exact sequence of questions, options weighed, choices made, and reversals — not just the final state of the code.

## Conventions

- One file per session, named `YYYY-MM-DD-NN-topic.md`. The numeric `NN` fixes chronological ordering in any filesystem or GitHub listing, so files read top-down in the order events actually happened.
- Present-at-the-time voice. If we got something wrong and learned later, annotate with a later `**Update (YYYY-MM-DD):**` line, don't rewrite history.
- Each entry ends with a **Takeaways** section — the bit worth reading even if you skim.
- Decisions that have consequences beyond a single session get promoted to an ADR in `docs/adrs/` and are cross-linked.

## Entries

Listed in the order events happened, not when the entry was written.

| # | Approx. time | Session | File |
|---|---|---|---|
| — | 2026-04-17 | Pre-event prep and audit | *(covered inline in the kickoff entry)* |
| 01 | Sat 12:30 | Kickoff and ADLC setup | [2026-04-18-01-kickoff.md](2026-04-18-01-kickoff.md) |
| 02 | Sat 13:30 | Auth + sessions (subagent) | [2026-04-18-02-auth.md](2026-04-18-02-auth.md) |
| 03 | Sat 13:34 | Rooms (subagent) | [2026-04-18-03-rooms.md](2026-04-18-03-rooms.md) |
| 04 | Sat 13:38 | Messages (subagent) | [2026-04-18-04-messages.md](2026-04-18-04-messages.md) |
| 05 | Sat 13:48 | Presence (subagent) | [2026-04-18-05-presence.md](2026-04-18-05-presence.md) |
| 06 | Sat 13:49 | Friends (subagent) | [2026-04-18-06-friends.md](2026-04-18-06-friends.md) |
| 07 | Sat 13:51 | Attachments (subagent) | [2026-04-18-07-attachments.md](2026-04-18-07-attachments.md) |
| 08 | Sat 14:00–15:10 | Build day — features, integration, smoke | [2026-04-18-08-build.md](2026-04-18-08-build.md) |
| 09 | Sat 15:42 | XMPP sidecar spike (superseded by federation entry) | [2026-04-18-09-xmpp-spike.md](2026-04-18-09-xmpp-spike.md) |
| 10 | Sat 15:10–17:00 | Afternoon — polish, virtualisation, audits | [2026-04-18-10-afternoon.md](2026-04-18-10-afternoon.md) |
| 11 | Sat 16:20 | Wave-1 audit closure | [2026-04-18-11-wave-1.md](2026-04-18-11-wave-1.md) |
| 12 | Sat 16:30 | XMPP federation on main (SASL wall documented) | [2026-04-18-12-xmpp-federation.md](2026-04-18-12-xmpp-federation.md) |
| 13 | Sat 16:53 | Wave-2 audit closure | [2026-04-18-13-wave-2.md](2026-04-18-13-wave-2.md) |
| 14 | Sat 17:12 | XMPP federation working + 50-client load test PASS | [2026-04-18-14-xmpp-working.md](2026-04-18-14-xmpp-working.md) |
| 15 | Sat 17:28 | Wave-3 audit closure | [2026-04-18-15-wave-3.md](2026-04-18-15-wave-3.md) |
| 16 | Sat 18:30 | Claude Design audit — six-phase closure | [2026-04-18-16-design-audit.md](2026-04-18-16-design-audit.md) |

## The philosophy underneath

**Context first, code second.** The hackathon is explicitly an experiment in *agent-herded* development. The quality of the context we set up — specs, requirements, architecture, design language, operating manuals — bounds what the agent can plausibly build. Jumping straight to implementation without that scaffolding is how past participants lost the plot. So the first working day is almost entirely spent on documents, not code. The agent then has something authoritative to consult for every decision that would otherwise become a guess.

This journal itself is part of that scaffolding: it's where rationale lives. Code tells you *what* and *how*; the journal tells you *why*, and more importantly, *why not the alternatives*.
