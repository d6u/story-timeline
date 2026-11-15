import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';
import { createApp } from '../src/graphql/yoga.js';
import { createProjectRegistry } from '../src/projects/registry.js';
import { withDataDir } from './helpers/seed.js';

type Send = (query: string, variables?: Record<string, unknown>) => Promise<any>;

async function withApp(check: (send: Send, dataDir: string) => Promise<void>) {
  await withDataDir(async (dataDir) => {
    const registry = createProjectRegistry(dataDir);
    const yoga = createApp(registry);
    try {
      await check(async (query, variables) => {
        const response = await yoga.fetch('http://localhost/graphql', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ query, variables }),
        });
        return response.json();
      }, dataDir);
    } finally {
      await registry.close();
    }
  });
}

/** Counts rows straight from the file, on a connection the server does not use. */
async function counts(dataDir: string, project: string) {
  const client = createClient({ url: `file:${join(dataDir, `${project}.sqlite`)}` });
  try {
    const { rows } = await client.execute('SELECT (SELECT count(*) FROM acts) AS acts, (SELECT count(*) FROM places) AS places, (SELECT count(*) FROM events) AS events');
    return { acts: Number(rows[0].acts), places: Number(rows[0].places), events: Number(rows[0].events) };
  } finally {
    client.close();
  }
}

test('a batch whose third field fails writes nothing and reports the error', async () => {
  await withApp(async (send, dataDir) => {
    const before = await counts(dataDir, 'empty');
    const result = await send(`mutation ($p: ID!) {
      act: upsertAct(projectId: $p, input: { name: "act-1" }) { name }
      place: upsertPlace(projectId: $p, input: { key: "ship", name: "Ship" }) { key }
      event: upsertEvent(projectId: $p, input: { key: "e", actName: "missing-act" }) { key }
    }`, { p: 'empty' });
    assert.equal(result.data, null, 'every Mutation field is non-null, so one error nulls the whole data');
    assert.equal(result.errors.length, 1);
    assert.deepEqual(result.errors[0].path, ['event']);
    assert.match(result.errors[0].message, /FOREIGN KEY/);
    assert.equal(result.extensions.transaction, 'rolledBack');
    assert.deepEqual(await counts(dataDir, 'empty'), before);
    assert.deepEqual(before, { acts: 0, places: 0, events: 0 });
    const read = await send('query ($p: ID!) { project(id: $p) { acts { name } places { key } } }', { p: 'empty' });
    assert.deepEqual(read.data.project, { acts: [], places: [] });
  });
});

test('a valid batch persists, and a later field sees the row of an earlier field', async () => {
  await withApp(async (send, dataDir) => {
    const result = await send(`mutation ($p: ID!) {
      act: upsertAct(projectId: $p, input: { name: "act-1" }) { name }
      ship: upsertPlace(projectId: $p, input: { key: "ship", name: "Ship" }) { key }
      cabin: upsertPlace(projectId: $p, input: { key: "cabin", parentKey: "ship" }) { key parentKey }
      event: upsertEvent(projectId: $p, input: { key: "e", actName: "act-1", placeKey: "cabin" }) { key actName placeKey }
      patch: upsertPlace(projectId: $p, input: { key: "ship", description: "Old" }) { key name description }
    }`, { p: 'empty' });
    assert.equal(result.errors, undefined, JSON.stringify(result.errors));
    assert.equal(result.extensions.transaction, 'committed');
    assert.deepEqual(result.data.event, { key: 'e', actName: 'act-1', placeKey: 'cabin' });
    assert.deepEqual(result.data.patch, { key: 'ship', name: 'Ship', description: 'Old' }, 'the patch reads the row the earlier field inserted');
    assert.deepEqual(await counts(dataDir, 'empty'), { acts: 1, places: 2, events: 1 });
  });
});

test('a document that writes two projects is refused and writes nothing', async () => {
  await withApp(async (send, dataDir) => {
    const before = await counts(dataDir, 'demo');
    const result = await send(`mutation {
      a: upsertAct(projectId: "empty", input: { name: "act-1" }) { name }
      b: upsertAct(projectId: "demo", input: { name: "act-9" }) { name }
    }`);
    assert.equal(result.errors[0].extensions.code, 'MULTIPLE_PROJECTS');
    assert.deepEqual(result.errors[0].path, ['b']);
    assert.equal((await counts(dataDir, 'empty')).acts, 0);
    assert.deepEqual(await counts(dataDir, 'demo'), before);
  });
});

test('mutation documents sent at the same time each commit', async () => {
  await withApp(async (send, dataDir) => {
    const results = await Promise.all(
      [1, 2, 3, 4].map((n) => send(`mutation ($p: ID!) { upsertAct(projectId: $p, input: { name: "act-${n}" }) { name } }`, { p: 'empty' })),
    );
    for (const result of results) assert.equal(result.errors, undefined, JSON.stringify(result.errors));
    assert.equal((await counts(dataDir, 'empty')).acts, 4);
  });
});
