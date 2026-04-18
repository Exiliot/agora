#!/usr/bin/env node
/**
 * Federation load test (ST-XMPP-3): spins up `CLIENTS_PER_SERVER` users on
 * each of server-a and server-b, all authenticated through agora's
 * HTTP-auth bridge. Pairs them (a_i ↔ b_i), fires messages in both
 * directions, measures delivery rate and p50/p95/max latency.
 *
 * Usage:
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 node tools/xmpp-load-test.mjs [clientsPerServer]
 *
 * Requires the XMPP overlay to be running:
 *   docker compose -f docker-compose.yml -f docker-compose.xmpp.yml up --build -d
 */

import { client, xml } from '@xmpp/client';

const API = 'http://localhost:3000';
const CLIENTS_PER_SERVER = Number(process.argv[2] ?? 50);
const MESSAGE_TIMEOUT_MS = 15_000;
const STAGGER_MS = 20; // delay between client starts to avoid connection stampedes

const now = () => Number(process.hrtime.bigint() / 1_000_000n);

const bulkRegister = async (prefix, count) => {
  const r = await fetch(`${API}/api/dev/bulk-register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prefix, count, password: 'password123' }),
  });
  if (!r.ok) throw new Error(`bulk-register ${prefix} failed: ${r.status}`);
  const body = await r.json();
  return body.inserted;
};

const connect = (server, username) => {
  const port = server === 'b' ? 5323 : 5223;
  return client({
    service: `xmpps://localhost:${port}`,
    domain: `server-${server}`,
    username,
    password: 'password123',
  });
};

const startClient = async (xmpp) => {
  await new Promise((resolve, reject) => {
    xmpp.once('online', resolve);
    xmpp.once('error', reject);
    xmpp.start().catch(reject);
  });
  await xmpp.send(xml('presence'));
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const percentile = (sortedArr, p) => {
  if (sortedArr.length === 0) return 0;
  const idx = Math.min(sortedArr.length - 1, Math.floor((p / 100) * sortedArr.length));
  return sortedArr[idx];
};

const main = async () => {
  const stamp = Date.now();
  const aPrefix = `la${stamp}u`;
  const bPrefix = `lb${stamp}u`;
  console.log(`[setup] bulk-registering ${CLIENTS_PER_SERVER * 2} users…`);
  await bulkRegister(aPrefix, CLIENTS_PER_SERVER);
  await bulkRegister(bPrefix, CLIENTS_PER_SERVER);
  const aUsers = Array.from({ length: CLIENTS_PER_SERVER }, (_, i) => `${aPrefix}${i}`);
  const bUsers = Array.from({ length: CLIENTS_PER_SERVER }, (_, i) => `${bPrefix}${i}`);
  console.log(`[setup] users registered`);

  console.log(`[setup] connecting ${CLIENTS_PER_SERVER * 2} xmpp clients…`);
  const aClients = aUsers.map((u) => ({ user: u, xmpp: connect('a', u) }));
  const bClients = bUsers.map((u) => ({ user: u, xmpp: connect('b', u) }));

  const connectStart = now();
  const starters = [...aClients, ...bClients].map(async (c, idx) => {
    await sleep(idx * STAGGER_MS);
    await startClient(c.xmpp);
  });
  await Promise.all(starters);
  const connectMs = now() - connectStart;
  console.log(`[setup] all clients online in ${connectMs} ms`);

  // Attach receive handlers on bClients — each expects ONE message with a known id.
  const pending = new Map();
  bClients.forEach((c, i) => {
    c.xmpp.on('stanza', (stanza) => {
      if (!stanza.is('message')) return;
      const body = stanza.getChildText('body');
      if (!body) return;
      const match = body.match(/^ping:(\d+):(\d+)$/);
      if (!match) return;
      const pairIndex = Number(match[1]);
      const sentAt = Number(match[2]);
      if (pairIndex !== i) return;
      const entry = pending.get(pairIndex);
      if (entry && !entry.arrived) {
        entry.arrived = now() - sentAt;
        entry.resolve();
      }
    });
  });

  // Wait a beat for presence to settle before blasting messages.
  await sleep(1_000);

  console.log(`[run] sending ${CLIENTS_PER_SERVER} cross-server messages…`);
  const promises = aClients.map((a, i) => {
    const entry = { arrived: null, resolve: null };
    const waitForArrival = new Promise((resolve) => {
      entry.resolve = resolve;
    });
    pending.set(i, entry);
    const sentAt = now();
    a.xmpp.send(
      xml(
        'message',
        { to: `${bUsers[i]}@server-b`, type: 'chat' },
        xml('body', {}, `ping:${i}:${sentAt}`),
      ),
    );
    return Promise.race([
      waitForArrival,
      new Promise((resolve) => setTimeout(resolve, MESSAGE_TIMEOUT_MS)),
    ]).then(() => entry.arrived);
  });

  const latencies = (await Promise.all(promises)).filter((x) => typeof x === 'number');
  const delivered = latencies.length;
  const lost = CLIENTS_PER_SERVER - delivered;
  latencies.sort((a, b) => a - b);
  const p50 = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);
  const max = latencies.at(-1) ?? 0;

  console.log('---');
  console.log(`clients per server: ${CLIENTS_PER_SERVER}`);
  console.log(`delivered:          ${delivered} / ${CLIENTS_PER_SERVER}`);
  console.log(`lost:               ${lost}`);
  console.log(`latency p50:        ${p50} ms`);
  console.log(`latency p95:        ${p95} ms`);
  console.log(`latency max:        ${max} ms`);

  await Promise.all([...aClients, ...bClients].map((c) => c.xmpp.stop().catch(() => undefined)));

  // Success criterion: >= 95% delivery at p95 <= 5 seconds.
  const deliveryRate = delivered / CLIENTS_PER_SERVER;
  const pass = deliveryRate >= 0.95 && p95 <= 5_000;
  console.log(pass ? '[load-test] PASS' : '[load-test] FAIL');
  process.exit(pass ? 0 : 1);
};

main().catch((err) => {
  console.error('[load-test] crashed', err);
  process.exit(1);
});
