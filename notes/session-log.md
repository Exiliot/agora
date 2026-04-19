# Session log

Post-event notes for organisers, written from the operator's perspective – the human in the loop prompting, directing, reviewing, and course-correcting the agent through the build.

## Day

- Date: 18–20 April 2026 (Sat evening through Sun afternoon)
- Track: Saturday (billable-projects track)
- Start time: Saturday ~12:00 local
- Submission deadline: Monday 20 April 10:00 UTC (first wave, billable-projects track)

## Setup

- Primary agent tool: Claude Code with Opus 4.7 (1M context window) as the coordinator; Sonnet occasionally for mechanical subagents.
- Subscription tier: Claude Max ($200/month).
- MCPs the agent reached for: `playwright`, `chrome-devtools-mcp`, `context7`, `typescript-lsp`, `claude-in-chrome` for live UAT. Figma was available; the agent barely used it.
- Skills / commands I leaned on most: `superpowers:brainstorming`, `superpowers:writing-plans`, `superpowers:subagent-driven-development`, `superpowers:executing-plans`, `superpowers:verification-before-completion`, `superpowers:requesting-code-review`. Custom slash commands I defined in the repo: `/smoke` (delivery contract), `/plan`, `/feature`.
- Starter: docker-compose + Fastify + `@fastify/websocket` baseline from the workspace `templates/` directory I had prepared before the event.

## Task summary

`agora` is a classic web chat server – rooms, DMs, presence, file attachments, moderation, notifications – chosen as a vehicle for the ADLC experiment rather than as the point in itself. Two-container deploy (Fastify + Postgres behind Nginx-served React 19 + TanStack Query + WebSockets). Delivery contract: `git clone && docker compose up --build` brings the whole stack up with no manual steps. I had the agent do a cold-boot verification from a fresh clone on the final day to confirm this.

## What worked

- Making the agent write documents before code. I spent the whole Saturday morning prompting it through the spec, requirements, ADRs, architecture, data model, and the WebSocket protocol – no implementation at all. From then on every feature request I made could point at something authoritative whenever the agent would otherwise have started guessing. That single decision saved the most time over the weekend.
- Subagent-per-task with fresh context, which the skills package encouraged but which I had to actively insist on. I kept the coordinator agent coordinating; each subagent I dispatched got the full task text pasted into its prompt rather than a path to read. Main context stayed clean, each worker stayed focused.
- Parallel specialist audits. I asked the coordinator to dispatch four read-only reviewers (product integrity, security, performance, accessibility) in a single message. Fifteen minutes of wall clock came back with 94 distinct findings. The synthesis step – me reading across the four reports and asking the agent to propose ADRs where themes crossed over – was where the value actually lived. Five ADRs came out of one prompt.
- Treating the ADR as a contract between sessions. "Proposed" ADR → I prompt an implementation subagent → "Accepted" ADR with the landing commit SHA appended. The pattern meant the next agent in the seat never had to re-derive context; the ADR already held both the why and the when.
- Journal as rationale store. I made the agent write one per session with a `## Takeaways` block at the end. 31 entries in total plus an index. A stranger reading the journal can reconstruct every decision without prompting me directly.
- Delivery-contract discipline. I wrote a `/smoke` slash command that runs the full cold-boot + Playwright check and made sure the agent actually ran it on the final day from a fresh clone. Every critical flow passed.
- Claude Design (`claude.ai/design`) twice over, as two different tools. First as a booster at the start: I used it to generate the initial design system (palette, typography, spacing, primitives, `Screens.html` artboards) before I had anyone writing code, which gave the coding agent an authoritative visual reference instead of me having to art-direct inline. Second as a reviewer: I fed it the running codebase across three audit rounds and it flagged 12, then 17, then 26 findings – including the one early R1 item that would have otherwise shipped the whole UI looking broken (a Tailwind / tokens-css import-order bug that made `var(--accent)` collapse to `currentColor` everywhere). Without that audit catching it, the product would have looked unstyled until someone noticed manually. Two different use-shapes, both genuinely load-bearing.

## What didn't

- I never got around to asking the agent to set up the web-package unit-test harness. The API ended up with 91 tests, shared with 11, web with zero. Every visible-layer bug was caught by me eyeballing rather than by a test. I kept saying "next session" and "next session" never happened.
- I let the agent spend half a day on an XMPP federation sidequest that the kickoff call had explicitly called optional. I should have timeboxed that the moment I noticed the direction; I was curious, so I did not.
- I lost 40 minutes prompting the agent through an Oracle Cloud Always-Free terraform spike before remembering that docker-compose is the delivery contract and a live URL is not required.
- One audit round the agent ran misdiagnosed five colour-pipeline symptoms as five unrelated component issues. I should have noticed earlier that all five were pointing at the same root cause (a single CSS variable loading-order bug) and steered the agent toward the pipeline rather than the components.
- One subagent pushed to `main` without waiting for my explicit authorisation. The policy layer caught and flagged it. Not catastrophic – the commit was pure docs and I had been pushing after each session anyway – but it was a drift I had to rein in.

## Hardest part

A real-time message-delivery bug that I had to walk the agent through across three diagnostic layers. I saw the symptom as a user – sent a message, it did not appear until I refreshed – and fed that to the coordinator. The agent's first theory was client-side query invalidation and it refactored that (correctly but irrelevantly). I pushed it to add server diagnostic logs, which came back showing `subscribers: 0` on the topic the server was publishing to. That one print statement collapsed maybe forty minutes of theorising into an obvious root cause: an auto-subscribe guard that always matched because of a pre-subscription earlier in the WS plugin. The lesson I took for the rest of the weekend was "when the agent is reasoning in circles, make it print the internal state rather than reason harder".

## Prompts that moved the needle

1. The four-parallel-specialists audit prompt: "Run several parallel audits from different perspectives: product integrity, security / privacy, performance / high load, accessibility. Generate thorough reports. Offer ADRs based on the most critical and beneficial points." This was the highest-signal prompt I ran all weekend. Four subagents dispatched in one message, four dated reports back, 94 observations, five ADR proposals from the cross-reference. I wish I had been running this on a cadence, not ad hoc.

2. The Claude Design handoff: "Fetch this design file, read its README, and implement the relevant aspects of the design." The bundle's README tells the agent exactly how to treat the HTML prototypes. I did three rounds of this (12, 17, 26 findings); each time the handoff format carried most of the load and I just had to prompt the agent to iterate through the findings batch by batch.

3. Closeout prompt: "Close all remaining items correspondingly." Once the audit pass had 80 open findings, I asked the agent to go through each one and either fix it or explicitly defer with a rationale and revisit trigger. Four sequential per-audit dispatches; 80 rows → 0 open. The key was empowering "defer with documented reason" as a legitimate outcome alongside "fix" – otherwise the agent would have churned indefinitely trying to fix items that were really product or ADR decisions.

## Cost

- The Max $200/month subscription ran out by Saturday afternoon. The rest of the weekend – most of the feature work, all three design-audit rounds, all five ADR implementations, the parallel-specialists pass, and the audit closeout – was burned out of Claude's extra-usage / pay-as-you-go tier on top of Max. Another ~$50 of extra-usage went on this project specifically before the second coordinator session even started.
- So the honest total for the weekend is roughly Max-tier-quota (call it the equivalent of several hundred dollars of API spend) plus ~$50 extra-usage = substantially more than the $40–60 figure I was tracking in my head. Token-count-wise, that means my earlier napkin estimate of 9–11M was low; real total is probably somewhere in the 15–25M range once you count every subagent context.
- The lesson here is that "the budget is not the bottleneck" is true in the sense that I never paused because of cost, but not true in the sense that agent-heavy ADLC burns through a Max plan faster than you expect. The parallel-specialists pattern in particular spawns 4–8 fresh 200k-token subagent contexts per invocation; run that three times in an afternoon and the quota is gone.
- If I were spending more deliberately next time, I would pre-load the Anthropic Console with an extra-usage cap I was comfortable with BEFORE the event, rather than discovering mid-Saturday that I was now on spend-per-call. I would also still spend more on parallel audits, not less – the signal per dollar there is excellent, it just costs real money.

## Would I do this again

Yes, with three changes to how I run the agent.

First, I would make the agent set up the web-package unit-test harness on day one instead of letting me defer it. That is the one package that shipped the most visible bugs, and the cause was always the same: I was reviewing by eye rather than by test because I had not bought myself a way to do otherwise.

Second, I would timebox sidequests. A 30-minute "is this on the critical path or am I curious?" gate in my own head, not the agent's, would have killed the XMPP work early and sharpened the OCI spike.

Third, I would run the parallel-specialist-audit pattern on a fixed cadence. The signal is high, the cost is low, and the synthesis across reviewers is where the real value lives. It is also the one pattern that generalises beyond this experiment – any project where multiple concerns need to be balanced at once benefits from "four specialists in parallel, then me reading across their reports".

The methodology worked. Shipped a working classic-chat server, two containers plus Postgres, one `docker compose up` away from running on anyone's machine, with a journal + ADR + audit trail that lets a stranger (or future me) pick it up tomorrow. The agent wrote the code and the words; I chose the direction, made the calls, and kept it honest. Net judgement: the overhead of doing it this way was real and the quality gain was larger. I would run this loop again tomorrow on a different project without changing the shape of it much.
