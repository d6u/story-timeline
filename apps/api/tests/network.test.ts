import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';
import { createApp, type AppOptions } from '../src/graphql/yoga.js';
import { createProjectRegistry } from '../src/projects/registry.js';
import { withDataDir } from './helpers/seed.js';

type App = ReturnType<typeof createApp>;

async function withApp(check: (yoga: App, dataDir: string) => Promise<void>, options?: AppOptions) {
  await withDataDir(async (dataDir) => {
    const registry = createProjectRegistry(dataDir);
    try {
      await check(createApp(registry, options), dataDir);
    } finally {
      await registry.close();
    }
  });
}

async function actCount(dataDir: string) {
  const client = createClient({ url: `file:${join(dataDir, 'empty.sqlite')}` });
  try {
    return Number((await client.execute('SELECT count(*) AS n FROM acts')).rows[0].n);
  } finally {
    client.close();
  }
}

const MUTATION = 'mutation { upsertAct(projectId: "empty", input: { name: "pwned" }) { name } }';
const QUERY = '{ projects { id } }';

test('a cross-site page cannot write with a simple request', async () => {
  await withApp(async (yoga, dataDir) => {
    const evil = 'https://evil.example';
    const simple: [string, RequestInit][] = [
      ['form', { method: 'POST', headers: { origin: evil, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ query: MUTATION }).toString() }],
      ['multipart', { method: 'POST', headers: { origin: evil }, body: (() => { const f = new FormData(); f.set('operations', JSON.stringify({ query: MUTATION })); f.set('map', '{}'); return f; })() }],
      ['text', { method: 'POST', headers: { origin: evil, 'content-type': 'text/plain' }, body: JSON.stringify({ query: MUTATION }) }],
      ['json', { method: 'POST', headers: { origin: evil, 'content-type': 'application/json' }, body: JSON.stringify({ query: MUTATION }) }],
      ['null origin', { method: 'POST', headers: { origin: 'null', 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ query: MUTATION }).toString() }],
    ];
    for (const [name, init] of simple) {
      const response = await yoga.fetch('http://localhost/graphql', init);
      assert.equal(response.status, 403, name);
      assert.equal(response.headers.get('access-control-allow-origin'), null, name);
    }
    const get = await yoga.fetch(`http://localhost/graphql?query=${encodeURIComponent(MUTATION)}`, { headers: { origin: evil } });
    assert.equal(get.status, 403, 'GET with a foreign origin');
    assert.equal(await actCount(dataDir), 0);
  });
});

test('a mutation over GET is refused even without an Origin header', async () => {
  await withApp(async (yoga, dataDir) => {
    const response = await yoga.fetch(`http://localhost/graphql?query=${encodeURIComponent(MUTATION)}`);
    assert.equal(response.status, 405);
    assert.equal(await actCount(dataDir), 0);
  });
});

test('multipart bodies are off, and a local page can query with JSON', async () => {
  await withApp(async (yoga, dataDir) => {
    const multipart = new FormData();
    multipart.set('operations', JSON.stringify({ query: MUTATION }));
    multipart.set('map', '{}');
    const refused = await yoga.fetch('http://localhost/graphql', { method: 'POST', body: multipart });
    assert.notEqual(refused.status, 200, 'multipart is off');
    assert.equal(await actCount(dataDir), 0);

    const local = await yoga.fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: { origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({ query: QUERY }),
    });
    assert.equal(local.status, 200);
    assert.equal(local.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.ok((await local.json()).data.projects.length > 0);
  });
});

test('CORS preflight answers only local origins', async () => {
  await withApp(async (yoga) => {
    const preflight = (origin: string) =>
      yoga.fetch('http://127.0.0.1:4000/graphql', { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } });
    const local = await preflight('http://127.0.0.1:5173');
    assert.equal(local.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173');
    const foreign = await preflight('https://evil.example');
    assert.equal(foreign.headers.get('access-control-allow-origin'), null);
  });
});

test('curl without Origin and the GraphiQL page keep working', async () => {
  await withApp(async (yoga) => {
    const curl = await yoga.fetch('http://127.0.0.1:4000/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: QUERY }) });
    assert.equal(curl.status, 200);
    const page = await yoga.fetch('http://localhost:4000/graphql', { headers: { accept: 'text/html' } });
    assert.equal(page.status, 200);
    assert.match(await page.text(), /graphiql/i);
  });
});

test('the Host header must name this machine, which stops DNS rebinding', async () => {
  await withApp(async (yoga) => {
    const rebound = await yoga.fetch(`http://evil.example:4000/graphql?query=${encodeURIComponent(QUERY)}`, { headers: { host: 'evil.example:4000' } });
    assert.equal(rebound.status, 403);
  });
  await withApp(async (yoga) => {
    const lan = await yoga.fetch(`http://192.168.1.5:4000/graphql?query=${encodeURIComponent(QUERY)}`, { headers: { host: '192.168.1.5:4000' } });
    assert.equal(lan.status, 200, 'HOST=192.168.1.5 allows its own address');
  }, { extraHosts: ['192.168.1.5'] });
  await withApp(async (yoga) => {
    const any = await yoga.fetch(`http://my-laptop.lan:4000/graphql?query=${encodeURIComponent(QUERY)}`, { headers: { host: 'my-laptop.lan:4000' } });
    assert.equal(any.status, 200, 'HOST=0.0.0.0 turns the Host check off');
  }, { extraHosts: null });
});
