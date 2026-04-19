# Session log

Post-event notes for organisers.

## Day

- Date: 18–20 April 2026 (Sat evening through Sun afternoon)
- Track: Saturday (billable-projects track)
- Start time: Saturday ~12:00 local
- Submission deadline: Wednesday 22 April 12:00 UTC

## Setup

- Primary agent tool: Claude Code, Opus 4.7 (1M context window) for most of the weekend, occasional fallback to Sonnet for mechanical subagents.
- Subscription tier / budget: Claude Max ($200/month tier).
- MCPs used: `playwright`, `chrome-devtools-mcp`, `context7`, `typescript-lsp`, `claude-in-chrome` for live UAT. Figma available but rarely reached for.
- Skills / commands relied on: `superpowers:brainstorming`, `superpowers:writing-plans`, `superpowers:subagent-driven-development`, `superpowers:executing-plans`, `superpowers:verification-before-completion`, `superpowers:requesting-code-review`. Custom slash commands in-repo: `/smoke` (delivery contract), `/plan`, `/feature`.
- Template started from: docker-compose + Fastify + `@fastify/websocket` starter from the workspace `templates/` directory.

## Task summary

`agora` is a classic web chat server – rooms, DMs, presence, file attachments, moderation, notifications – built as a vehicle for the ADLC experiment. Two-container deploy (Fastify + Postgres behind Nginx-served React 19 + TanStack Query + WebSockets). Delivery contract: `git clone && docker compose up --build` brings the whole stack up on any machine with Docker, no manual steps. Cold-boot from a fresh clone was verified on the final day.

## What worked

- Documents before code. The entire Saturday morning went to spec, requirements, ADRs, architecture, data model, WS protocol – no implementation at all. Every subagent after that pointed at something authoritative when it hit a design question, which mostly killed the failure mode where the agent starts guessing.
- Subagent-per-task with fresh context. The controller stays coordinating; each subagent gets the full task text pasted into its prompt rather than a path to read. Keeps the main context clean and each worker focused.
- Parallel specialist audits. Four read-only agents (product integrity, security, performance, accessibility) dispatched in the same message produced 94 findings in ~15 minutes wall clock. The synthesis across the four reports turned directly into five ADRs that drove most of the rest of the weekend.
- ADR as a contract between planner and implementer. "Proposed" ADR → implementation subagent → "Accepted" ADR with the landing commit SHA appended. The ADR absorbs the why and the when; the implementation agent does not re-derive context.
- Journal as a rationale store. 31 numbered entries plus an index. Every entry ends with a `## Takeaways` block. A stranger reading the journal can reconstruct every decision and its reasoning.
- Delivery-contract discipline. A `/smoke` slash command runs the full cold-boot + Playwright check. Ran it on the final day from a fresh clone; every critical flow passed.

## What didn't

- Web-package unit-test harness never got set up. API got 91 tests, shared got 11, web got zero. Every visible-layer bug was caught by eyeballing rather than by a test.
- Half a day spent on an XMPP federation sidequest that was explicitly optional in the kickoff call. Curious not critical; did it anyway.
- 40 minutes lost on an Oracle Cloud Always-Free spike (ARM capacity refusals across three availability domains) before remembering that docker-compose is the delivery contract and a live URL is not required.
- One design-audit round misdiagnosed five colour-pipeline symptoms as five unrelated component issues. The real cause was a single CSS variable loading-order bug. Lesson: when several findings all point at "colour is wrong", they are probably one finding.
- One subagent pushed to `main` without explicit authorisation during an automated pass. Caught by the policy layer, flagged, logged. Reinforced that pushing is the operator's call, not the agent's.

## Hardest part

A real-time message-delivery bug that took three diagnostic layers to find. A user reported "I send a message and do not see it without refresh". First suspect was client-side query invalidation; refactored that correctly but irrelevantly. Server diagnostic logs then showed `subscribers: 0` on the expected topic, which collapsed the theorising into one evidentiary print statement. Root cause was an auto-subscribe guard that always matched because of a pre-subscription earlier in the WS plugin, so the room auto-subscribe never ran. Fix was three lines. The lesson for the rest of the weekend was: when a bug is behaviourally clear but analytically unclear, print the actual internal state earlier.

## Prompts that moved the needle

1. Four-parallel-specialists audit prompt. "Run several parallel audits from different perspectives: product integrity, security / privacy, performance / high load, accessibility. Generate thorough reports. Offer ADRs based on the most critical and beneficial points." Four read-only agents dispatched in one message, each writing a dated report. Produced 94 observations and five ADR proposals out of one prompt.

2. Claude Design handoff. "Fetch this design file, read its README, and implement the relevant aspects of the design." The bundle's README tells the agent exactly how to treat the HTML prototypes (recreate visually, do not copy internal structure). Round 1 shipped 12 findings, round 2 shipped 17, round 3 shipped 26. The handoff format carried itself.

3. Close-the-audit prompt. "Close all remaining items correspondingly." Four sequential per-audit dispatches, each agent empowered to fix or defer with a rationale and a named revisit trigger. Result: 80 audit rows → 0 open.

## Cost

- Token usage across the weekend: coordinator-side ~2.2M tokens (one fully-consumed 1M-context session, a compact, then ~0.6M more; second session running at ~0.6M). Subagent dispatches on top of that, ballpark 7–9M additional across ~70–90 separate agent contexts. Call it 9–11M tokens total, heavily input-weighted because every subagent dispatch pastes the full task brief into its prompt.
- Spend was comfortably inside the subscription tier. Budget was never the bottleneck; time was.
- If there is a place to spend more next time, it is the parallel-audit pattern. We ran it once and it was the highest-signal pass of the whole weekend. Running it on a fixed cadence – say every six hours of active work – would surface regressions and missed wiring much earlier.

## Would I do this again

Yes, with three changes.

First, start the web-package test harness on day one instead of deferring it to "next session". The only package without unit tests was the one that shipped the most visible bugs.

Second, timebox sidequests. A 30-minute "is this valuable or am I just curious?" gate during the XMPP work and the OCI spike would have killed one and sharpened the other.

Third, run the parallel-specialist-audit pattern on a cadence, not ad hoc. The signal is high, the cost is low, and the synthesis across reviewers is where the real value lives. It is also the one pattern that generalises beyond this experiment – any project where multiple concerns need to be balanced at once benefits.

The methodology worked. The project shipped a working classic-chat server, two containers plus Postgres, one docker-compose-up away from running on anyone's machine, with a journal + ADR + audit trail that lets a stranger pick it up tomorrow without prompt-engineering the basics.
