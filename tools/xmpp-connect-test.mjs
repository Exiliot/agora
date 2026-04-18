#!/usr/bin/env node
/**
 * Minimal connectivity test: proves a registered agora user can sign in to
 * one of the Prosody servers (server-a / server-b) using their agora
 * credentials via the HTTP-auth bridge.
 *
 * Prefers direct-TLS (port 5223 / 5323) so SASL PLAIN negotiates cleanly.
 *
 * Usage:
 *   node tools/xmpp-connect-test.mjs <a|b> <username> <password>
 *
 * Requires NODE_TLS_REJECT_UNAUTHORIZED=0 because Prosody presents a
 * self-signed cert in the demo compose network.
 */

import { client, xml } from '@xmpp/client';

const [, , server, username, password] = process.argv;
if (!server || !username || !password) {
  console.error('usage: node tools/xmpp-connect-test.mjs <a|b> <username> <password>');
  process.exit(2);
}

const port = server === 'b' ? 5323 : 5223;
const domain = `server-${server}`;

const xmpp = client({
  service: `xmpps://localhost:${port}`,
  domain,
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
