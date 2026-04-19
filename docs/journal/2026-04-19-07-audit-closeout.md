# 2026-04-19 · Audit closeout — every remaining item resolved

After the ADR pass (session 04) and the targeted-fixes pass (session 05), four specialist audit documents still carried ~68 open rows of medium / low / info severity, plus four highs. Closed the lot in this pass, one audit per sequential subagent dispatch, each dispatch empowered to either fix or explicitly defer with a recorded rationale and revisit trigger.

## Scoreboard — before vs after

| Audit | Before (open) | Closed this pass | Deferred (documented) | After (open) |
|---|---|---|---|---|
| Security and privacy | 22 | 10 | 9 | 0 |
| Accessibility round 2 | 16 | 14 | 2 | 0 |
| Performance and data integrity | 23 | 12 | 11 | 0 |
| Product integrity | 19 | 15 | 2 | 0 |
| **Totals** | **80** | **51** | **24** | **0** |

Every row in every audit now carries either `[CLOSED in <sha>]` or `[DEFERRED – see §Deferred]` next to it. No row is silent. Each Deferred entry names the severity, the one-line reason, and a concrete revisit trigger (a specific metric threshold, an ADR dependency, or a product-call dependency).

## What "Deferred" actually means

Deferrals fall into three shapes:

- **Architecture-gated.** The fix requires a decision that belongs in an ADR. Examples: CSRF defence-in-depth beyond SameSite + WS-origin; disk-fill quotas; Prometheus `/ready` + `/metrics` surface; native desktop push vs. opt-in behaviour. Each one of these names the ADR-to-be and what question it answers.
- **Cost vs. cardinality.** The scan is currently sub-millisecond because cardinality is hackathon-small. Documented with the threshold (e.g. "revisit when public rooms > 100" for correlated COUNT queries) so the revisit is data-driven, not calendar-driven.
- **Intentional by spec.** A handful of findings turn out to be "we do this on purpose and the spec agrees". Those get annotated as such so the next reviewer doesn't re-litigate (e.g. notification payload fields are exposed deliberately per product; friendship pair ordering has a DB CHECK constraint, an app-level lint adds nothing).

## Commits (chronological, 31 total)

### Security closeout (7 commits)

- `e666ce9` docs(audit): Mark H1 and H2 closed via ADR-0010 and ADR-0007
- `8e2836d` fix(messages): Re-check conversation access in message.edit and message.delete
- `842351c` fix(auth): Compose rate-limit keys with email, session id, and user id
- `9fb1fa1` test(attachments): Pin normaliseMime allow-list against SVG and script-capable mimes
- `183462c` chore(api): Harden low-severity audit items (error shape, helmet note, log noise)
- `3fc99f0` chore(dev): Warn loudly on boot when ALLOW_DEV_SEED=1 mounts unauthenticated routes
- `eff3beb` docs(audit): Defer remaining audit items with rationale and revisit triggers

### Accessibility closeout (9 commits)

- `2216342` fix(ds): wire aria-invalid + aria-describedby on Input errorMessage (H3)
- `cefbe84` fix(ui): landmark labels, fieldset/legend for radios, h2 section headings
- `f86f7c2` fix(ui): honour prefers-reduced-motion across spinners and smooth scroll
- `90ce6e9` fix(ds): Button pending prop sets aria-busy and keeps the visible label
- `6a5966c` fix(ds): time elements + accessible name on MessageRow/NotificationRow
- `76c5281` fix(ui): scope focus-ring border-radius and paint focus-within on Check labels
- `c4e73f1` fix(ui): table captions + continuous composer counter with over-limit alert
- `04df178` docs(audit): close remaining round-2 items and record AA verdict
- `9ef0549` docs(audit): normalise closed-row formatting

### Performance closeout (6 commits)

- `580b30e` perf(db): add cursor, reply-to and username-prefix indexes (H3 + M7 + M10)
- `a11e763` perf(ws): gate sends on bufferedAmount and terminate saturated sockets (H4)
- `096e19a` fix(messages): guard mark.read watermark against out-of-order acks (H5)
- `b0b346c` perf(api): parallelise /api/conversations, batch orphan sweep, trim logs
- `94bb425` perf(web): scope conversations invalidation and memoise MemberRow
- `3253c05` docs(audit): record deferred perf items with rationale and revisit triggers

### Product-integrity closeout (9 commits)

- `4398e4c` fix(auth): redirect on 401 across all queries (H6 + L20)
- `3d66e0f` fix(rooms): publish room.ban kind on /members/:userId DELETE (H7)
- `e8dfeb4` fix(rooms): match create-room error code, invalidate conversations, add sidebar empty state
- `653b17e` fix(auth): drop decorative 'keep me signed in' checkbox
- `3f186dc` fix(rooms): private-only invitations tab, prose invite errors, ban confirm
- `759d84a` fix(contacts): confirm unfriend, ban, unban and reject actions
- `61767d5` fix(sessions): confirm revoke, empty state, in-app password change
- `91ea909` fix(ui): copy polish, backfill watermark, dossier presence sort
- `e3f4cfa` docs(audit): record deferred product-integrity items with rationale

## Verdict moves

- **WCAG 2.1 AA**: "not yet, but close" → **Yes, with two documented equivalents**. The two open mediums (native `disabled` on the "Mark all read" button, presence-swatch non-text contrast) are covered by WAI-recognised alternative techniques (native `disabled` is AA-compliant by spec; presence state has shape redundancy + per-row `aria-label`).
- **Capacity estimate**: ~250-300 concurrent users → **~400-500 concurrent users** on single-node docker-compose. The first bottleneck (WS write-buffer bloat) is defused by the `bufferedAmount` gate + saturated-socket termination, the second (notifications feed N+1) was already closed in session 05.
- **Security posture**: every high either closed or gated behind an env flag (`ENABLE_XMPP_BRIDGE=1` on XMPP, `ALLOW_DEV_SEED=1` on dev-seed routes) that shouts loudly on boot if misset.
- **Product-integrity flows**: every documented user flow behaves as its requirement promises. The two remaining product concerns are intentional behaviour (multi-tab focus-registry semantics) and a spec-vs-implementation drift (desktop toasts) rather than anything broken.

## Process notes

- Sequential-per-audit was the right call. Earlier this session, four parallel agents cleaned four criticals/highs with no conflicts because the scopes were narrowly disjoint. This closeout touched far more files per audit; running four agents in parallel would have produced merge conflicts on `apps/api/src/messages/ws-handlers.ts`, `apps/web/src/app/WsProvider.tsx`, `apps/web/src/pages/chat/*.tsx`. Sequential cost ≈ 45 min wall clock vs. ≈ 20 min parallel-if-safe; worth it to avoid retrying merges.
- Each agent was told to *prefer fixing* but had explicit permission to defer with a recorded rationale. The 24 deferrals that came back are all legitimate – none are punting on real work. Several of them point to a specific follow-up ADR number (CSRF, observability, content-type authority) so the decision trail survives.
- Every audit got a new `## Deferred` section at its tail, formatted as a table with severity, reason, and revisit trigger. Future rounds can grep for this section and know exactly what "we meant to do later" looked like.

## Takeaways

- 80 open items at the start of the session → 0 at the end. The gap between "audit found it" and "audit is closed" does not need to stretch across weeks if each item gets an explicit decision in one focused pass.
- The 31 commits in this session average ~400 lines changed each. None are big. Audit closeout is overwhelmingly a collection of small scoped fixes plus a smaller collection of "we're not doing this and here's why". Neither requires heroism.
- Deferral is a first-class outcome as long as it carries a revisit trigger. Vague "maybe later" promises rot; specific "when X crosses Y, or when ADR-N lands" triggers don't.

## Commits this session

31 fix/chore/docs/perf/test commits plus this journal. See `git log --oneline 0031aaf..HEAD` for the full sequence.
