#!/usr/bin/env node
/**
 * Minimal connectivity test: proves a registered agora user can sign in to
 * Prosody using their agora credentials, via the HTTP-auth bridge.
 *
 * Usage:
 *   node tools/xmpp-connect-test.mjs <username> <password>
 */

import { client, xml } from '@xmpp/client';

const [, , username, password] = process.argv;
if (!username || !password) {
  console.error('usage: node tools/xmpp-connect-test.mjs <username> <password>');
  process.exit(2);
}

const xmpp = client({
  service: 'xmpp://localhost:5222',
  domain: 'agora.test',
  username,
  password,
});

xmpp.on('error', (err) => {
  console.error('[xmpp] error', err.toString());
  process.exit(1);
});

xmpp.on('online', async (address) => {
  console.log('[xmpp] online as', address.toString());
  await xmpp.send(xml('presence'));
  setTimeout(async () => {
    await xmpp.stop();
    process.exit(0);
  }, 500);
});

xmpp.start().catch((err) => {
  console.error('[xmpp] start failed', err);
  process.exit(1);
});
