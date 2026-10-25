import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import config from '../vite.config';
import { createApp } from '../server/app.js';
import { createDatabase } from '../server/db/database.js';

test('dev proxy accepts its own origin on an alternate port and rejects foreign origins', async () => {
  const db = createDatabase(':memory:');
  const app = createApp(db, { demoAuth: true, mockAI: true });
  const backend = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => backend.once('listening', resolve));
  const address = backend.address();
  assert.ok(address && typeof address !== 'string');
  const target = `http://127.0.0.1:${address.port}`;
  const proxy = config.server!.proxy!['/api'];
  const vite = await createServer({
    configFile: false,
    server: {
      host: '127.0.0.1', port: 0,
      proxy: { '/api': typeof proxy === 'string' ? target : { ...proxy, target } },
    },
  });
  try {
    await vite.listen();
    const frontend = vite.httpServer!.address();
    assert.ok(frontend && typeof frontend !== 'string');
    const origin = `http://127.0.0.1:${frontend.port}`;
    // An unknown endpoint should reach routing (404), not fail origin validation (403).
    const local = await fetch(`${origin}/api/proxy-origin-probe`, {
      method: 'POST', headers: { Origin: origin },
    });
    assert.equal(local.status, 404);
    const foreign = await fetch(`${origin}/api/proxy-origin-probe`, {
      method: 'POST', headers: { Origin: 'https://foreign.example' },
    });
    assert.equal(foreign.status, 403);
  } finally {
    await vite.close();
    await new Promise<void>((resolve, reject) => backend.close((error) => error ? reject(error) : resolve()));
    db.close();
  }
});
