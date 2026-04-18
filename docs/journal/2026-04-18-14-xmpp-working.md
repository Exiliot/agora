# 2026-04-18 · XMPP federation — working, loaded, green

Follow-on to `2026-04-18-12-xmpp-federation.md`. The SASL wall came down, two-server federation passes, and the 50-client load test clears the ST-XMPP-3 bar. This is the entry to read if you want the resolved story rather than the debug trail.

## The two things that unblocked SASL

Two separate problems stacked on top of each other; once both were fixed the handshake completed first try.

### 1. Direct-TLS c2s on 5223 instead of STARTTLS on 5222

Prosody 0.12 with a self-signed cert offered `PLAIN` in `<stream:features>` but no `<starttls>` element — `@xmpp/client` refuses PLAIN without prior TLS and errored `Mechanism undefined not found`. The clean fix was to stop fighting STARTTLS negotiation entirely and open an additional port for direct-TLS (the xmpps:// scheme):

```lua
c2s_direct_tls_ports = { 5223 }
ssl = {
  certificate = "/etc/prosody/certs/" .. domain .. ".crt";
  key         = "/etc/prosody/certs/" .. domain .. ".key";
}
```

Client connects via `xmpps://localhost:5223`, TLS handshake happens first, then SASL proceeds over the encrypted stream. This is the same pattern Gmail/XMPP clients used for years before STARTTLS became universal; works, it's boring, it's reliable for a demo.

### 2. `mod_auth_http` speaks GET, not POST

The agora bridge originally exposed `POST /internal/xmpp/auth` returning JSON. That worked perfectly against curl (which is how the earlier journal entry "proved" the bridge). It did not work against Prosody because **`mod_auth_http`'s default contract is GET with query parameters returning plaintext `true` / `false`** — not POST JSON.

The bridge now exposes both:

```ts
scoped.get('/internal/xmpp/auth/check_password', async (req, reply) => {
  const parsed = getAuthQuery.safeParse(req.query);
  if (!parsed.success) return reply.type('text/plain').send('false');
  const { ok } = await lookupAndVerify(parsed.data.user, parsed.data.pass);
  return reply.type('text/plain').send(ok ? 'true' : 'false');
});
scoped.get('/internal/xmpp/auth/user_exists', ...);
scoped.post('/internal/xmpp/auth', ...); // kept for the existing tests + curl interactive use
```

`prosody.cfg.lua.tmpl` points `http_auth_url` at `@@AUTH_URL@@/internal/xmpp/auth` and Prosody appends `/check_password?user=...&pass=...` itself.

Combined with the direct-TLS port, the client side now produces a clean `<stream:features>` with both `<mechanisms>PLAIN` and the TLS-established channel — SASL completes, resource binding proceeds, and the client comes online.

## End-to-end federation test (ST-XMPP-2)

`tools/xmpp-federation-test.mjs`: registers `alice` on server-a and `bob` on server-b via the normal `POST /api/auth/register` path (whose username rules the earlier MVP concession made JID-safe on purpose — cashed in the dividend). Both users authenticate via the HTTP-auth bridge; alice sends a `<message>` stanza with a known marker body to `bob@server-b`; bob's stanza handler resolves the test promise when it arrives.

Result: stanza delivered in ~10 ms across the compose-network dialback s2s link. No certificate ceremony — dialback (XEP-0220) validates peers by DNS challenge, no mutual-CA setup required for a demo.

## Load test (ST-XMPP-3)

`tools/xmpp-load-test.mjs`: 50 users per server, 100 sessions in total, 50 cross-server messages in a single burst. One subtlety — `/api/auth/register` is rate-limited (10/min) per the security wave-1 fix, which would have capped the test at 10 users. Rather than weaken the real rate limit, added a dev-only bulk bypass:

```ts
app.post('/api/dev/bulk-register', async (req, reply) => {
  // NOT behind requireAuth — deliberate dev-only escape hatch
  // Gated behind ALLOW_DEV_SEED=1, same flag as /api/dev/seed-messages
  ...
});
```

That endpoint uses `INSERT ... ON CONFLICT DO NOTHING` so repeat runs with the same prefix are idempotent.

Connection ramp is staggered at 20 ms between clients to avoid TLS-handshake stampedes; 1 s presence-settle delay before the message burst; 15 s per-message timeout.

Observed:

```
clients per server: 50
delivered:          50 / 50
lost:               0
latency p50:        10 ms
latency p95:        13 ms
latency max:        13 ms
[load-test] PASS
```

Success criterion (encoded in the script): ≥ 95% delivery at p95 ≤ 5000 ms. 100% at p95 = 13 ms clears it by two orders of magnitude. The bottleneck is the compose-network loopback, not agora or Prosody.

## How to repeat it

```sh
# base stack down, XMPP overlay up
docker compose -f docker-compose.yml -f docker-compose.xmpp.yml up --build -d

# wait a few seconds for prosody to write certs and start listening
sleep 10

# single-message federation test
NODE_TLS_REJECT_UNAUTHORIZED=0 node tools/xmpp-federation-test.mjs

# 50-client load test
NODE_TLS_REJECT_UNAUTHORIZED=0 node tools/xmpp-load-test.mjs 50

# teardown
docker compose -f docker-compose.yml -f docker-compose.xmpp.yml down -v
```

`NODE_TLS_REJECT_UNAUTHORIZED=0` is because Prosody is using a self-signed cert inside the compose network — fine for a local demo, would be unacceptable in production.

## Parallel wave-2 audit fixes

Shipped alongside the XMPP work in the same session:

- `@fastify/helmet` registered on the api (`contentSecurityPolicy: false` — the web nginx handles CSP per-route), plus `trustProxy: 1` so real client IPs reach the rate-limiter.
- `setErrorHandler` unified: `{ error: code, message }` is now the single response shape across all routes. Validation errors stay at 400 with `{ error: 'validation', issues: [...] }` for the zod issue list.
- WS dispatcher refactored: `registerWsHandler<T>('message.send', handler)` now passes the narrowed event type in; all the `as EventOf<'message.send'>` casts in `ws-handlers.ts` were deleted. The discriminated union from `@agora/shared` gives the compiler everything it needs.
- `web/nginx.conf` CSP tightened — explicit `default-src 'self'`, `frame-ancestors 'none'`, `form-action 'self'`, plus the usual `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`.
- `sessions_token_hash_key` added as a proper `uniqueIndex` in the Drizzle schema (wave-1 migration now has the schema counterpart).

## What ADR-0005 status should be now

Accepted + implemented on main. The "Phase 2 planned" hedge in the ADR is stale — both the sidecar and the load-test goal are real code in this repo. The journal chain for the detail trail:

1. `2026-04-18-09-xmpp-spike.md` — initial single-server HTTP-auth proof.
2. `2026-04-18-12-xmpp-federation.md` — two-server setup, SASL wall, triaged halt.
3. `2026-04-18-14-xmpp-working.md` (this file) — unblock, federation, load test PASS.

## Takeaways

- **Fighting a protocol is often the wrong ask.** Three hours lost to "why doesn't STARTTLS advertise in this version" turned out to be cheaper with a direct-TLS port. The "correct" fix (dig into Prosody 0.12's TLS features registration, file a report, maybe patch modules-community) would have cost the whole day. Demo-grade federation doesn't need demo-grade debugging — it needs to work.
- **Reading the module source beats reading the module docs.** `mod_auth_http`'s README shows POST examples; the actual Lua code issues GETs. Ten minutes in the module source answered what an hour of `POST /internal/xmpp/auth` + curl couldn't.
- **The MVP concession paid.** The "usernames are JID-safe at registration" concession from ADR-0005 went into the regex on day one and cost literally zero. In Phase 2 it meant zero escaping work, zero migration, zero divergence between the agora user table and the Prosody JIDs. That's the shape of a good concession — visible in the MVP as one regex, invisible in the stretch goal as absence-of-problem.
- **Auth rate limits and load tests fight.** 10/min on `/api/auth/register` is the right production-facing default. A deliberate, flag-gated bypass endpoint is cheaper than making the rate limit "smart" about test traffic. The flag is the audit trail.
- **50 clients in 13 ms means agora is not the bottleneck.** Any federation scaling conversation should start with the Postgres writer, the WS fanout, or the Prosody s2s queue — not the bridge. Worth writing down now so we don't re-measure next time the question comes up.
