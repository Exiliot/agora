#!/usr/bin/env node
/**
 * Federation smoke test (ST-XMPP-2): two agora users sign in to Prosody on
 * different servers (server-a via port 5223, server-b via port 5323) and
 * exchange a direct XMPP message across the s2s dialback trust.
 *
 * Usage:
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 node tools/xmpp-federation-test.mjs
 *
 * Relies on `ALLOW_DEV_SEED` / `ENABLE_XMPP_BRIDGE` being on (compose does
 * this automatically in the xmpp overlay).
 */

import { client, xml } from '@xmpp/client';

const API = 'http://localhost:3000';
const ALICE = { user: `alice${Date.now()}`, pass: 'password123' };
const BOB = { user: `bob${Date.now()}`, pass: 'password123' };

const register = async (cred) => {
  const r = await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: `${cred.user}@ex.com`,
      username: cred.user,
      password: cred.pass,
    }),
  });
  if (!r.ok) throw new Error(`register ${cred.user} failed: ${r.status}`);
};

const connect = (server, cred) => {
  const port = server === 'b' ? 5323 : 5223;
  const domain = `server-${server}`;
  return client({
    service: `xmpps://localhost:${port}`,
    domain,
    username: cred.user,
    password: cred.pass,
  });
};

const start = (xmpp, label) =>
  new Promise((resolve, reject) => {
    xmpp.on('online', (addr) => {
      console.log(`[${label}] online as ${addr.toString()}`);
      resolve(addr);
    });
    xmpp.on('error', (err) => {
      console.error(`[${label}] error`, err.toString());
      reject(err);
    });
    xmpp.start().catch(reject);
  });

const main = async () => {
  await register(ALICE);
  await register(BOB);
  console.log('[setup] both agora users registered');

  const alice = connect('a', ALICE);
  const bob = connect('b', BOB);

  const aliceAddr = await start(alice, 'alice');
  const bobAddr = await start(bob, 'bob');

  await alice.send(xml('presence'));
  await bob.send(xml('presence'));

  const received = new Promise((resolve) => {
    bob.on('stanza', (stanza) => {
      if (stanza.is('message') && stanza.getChild('body')) {
        resolve({ from: stanza.attrs.from, body: stanza.getChildText('body') });
      }
    });
  });

  const bobJid = `${BOB.user}@server-b`;
  await alice.send(
    xml(
      'message',
      { to: bobJid, type: 'chat' },
      xml('body', {}, 'hello from server-a'),
    ),
  );
  console.log(`[alice] → ${bobJid}: hello from server-a`);

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout waiting for federated message')), 10_000),
  );

  const result = await Promise.race([received, timeout]);
  console.log('[bob] received from', result.from, ':', result.body);

  if (result.body !== 'hello from server-a') {
    throw new Error(`unexpected body: ${result.body}`);
  }

  await alice.stop();
  await bob.stop();
  console.log('[federation] SUCCESS — message crossed server-a → server-b via dialback');
};

main().catch((err) => {
  console.error('[federation] FAILED —', err.message ?? err);
  process.exit(1);
});
