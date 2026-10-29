import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

test('authenticated webhook produces a complete SSE message, not escaped delimiters', async () => {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const key = 'a'.repeat(64);
  const child = spawn(process.execPath, [fileURLToPath(new URL('./server.mjs', import.meta.url))], {
    env: { ...process.env, API_PORT: String(port), WPP_SESSION: 'test', WPP_TOKEN: 'test-only', WPP_BASE_URL: 'http://127.0.0.1:1', WPP_QR_BRIDGE_SECRET: key },
    stdio: 'ignore', windowsHide: true,
  });
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 7000);
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let attempt = 0; ; attempt++) {
      try { await fetch(base + '/health'); break; }
      catch { if (attempt > 40) throw Error('API did not start'); await new Promise((r) => setTimeout(r, 100)); }
    }
    const events = await fetch(base + '/events', { signal: abort.signal });
    const reader = events.body.getReader();
    await reader.read(); // connection comment
    const message = { id: 'false_5565999999999@c.us_ABC', from: '5565999999999@c.us', fromMe: false, body: 'test', timestamp: Math.floor(Date.now() / 1000) };
    const posted = await fetch(base + '/internal/wpp-hook?key=' + key, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: 'test', event: 'onmessage', message }),
    });
    assert.equal(posted.status, 200);
    let packet = '';
    while (!packet.includes('\n\n')) packet += new TextDecoder().decode((await reader.read()).value);
    assert.match(packet, /^data: /);
    assert.equal(JSON.parse(packet.slice(6).trim()).id, message.id);

    // WPPConnect Server 2.10.61 sends the message fields directly at
    // the top level, rather than in an extra `message` envelope.
    const nativeMessage = { ...message, id: 'false_5565888888888@c.us_DEF' };
    const nativePost = await fetch(base + '/internal/wpp-hook?key=' + key, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'onmessage', session: 'test', ...nativeMessage }),
    });
    assert.equal(nativePost.status, 200);
    let nativePacket = '';
    while (!nativePacket.includes('\n\n'))
      nativePacket += new TextDecoder().decode((await reader.read()).value);
    assert.match(nativePacket, /^data: /);
    assert.equal(JSON.parse(nativePacket.slice(6).trim()).id, nativeMessage.id);
    await reader.cancel();
  } finally {
    clearTimeout(timeout); abort.abort();
    if (child.exitCode === null) { child.kill(); await once(child, 'exit'); }
  }
});

