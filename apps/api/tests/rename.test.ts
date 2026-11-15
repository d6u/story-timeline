import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';
import { WriteBatch } from '../src/graphql/batch.js';
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
          body: JSON.stringify({ query, variables: { p: 'demo', ...variables } }),
        });
        return response.json();
      }, dataDir);
    } finally {
      await registry.close();
    }
  });
}

/** Reads one SQL query straight from the file, on a connection the server does not use. */
async function rows(dataDir: string, sql: string) {
  const client = createClient({ url: `file:${join(dataDir, 'demo.sqlite')}` });
  try {
    return (await client.execute(sql)).rows.map((row) => Object.values(row));
  } finally {
    client.close();
  }
}

const ok = (result: any) => assert.equal(result.errors, undefined, JSON.stringify(result.errors));

test('the write transaction connection has foreign keys on, so ON UPDATE CASCADE runs', async () => {
  await withDataDir(async (dataDir) => {
    const registry = createProjectRegistry(dataDir);
    const batch = new WriteBatch();
    try {
      const connection = await batch.open(registry, 'demo');
      assert.ok(connection);
      // Ask through the transaction: it holds the only connection of its client.
      assert.equal((await connection.db.get<{ foreign_keys: number }>(sql`PRAGMA foreign_keys`))?.foreign_keys, 1);
    } finally {
      await batch.finish(false);
      await registry.close();
    }
  });
});

test('renameAct moves every event to the new act name', async () => {
  await withApp(async (send, dataDir) => {
    const result = await send('mutation ($p: ID!) { renameAct(projectId: $p, name: "act-1", newName: "act-one") { name } }');
    ok(result);
    assert.deepEqual(result.data.renameAct, { name: 'act-one' });
    assert.deepEqual(await rows(dataDir, 'SELECT DISTINCT act FROM events'), [['act-one']]);
    assert.deepEqual(await rows(dataDir, "SELECT count(*) FROM acts WHERE name = 'act-1'"), [[0]]);
  });
});

test('renamePlace moves child places (self-reference) and events', async () => {
  await withApp(async (send, dataDir) => {
    const result = await send(`mutation ($p: ID!) {
      ship: renamePlace(projectId: $p, key: "ship", newKey: "vessel") { key }
      cabin: renamePlace(projectId: $p, key: "cabin", newKey: "berth") { key parentKey }
    }`);
    ok(result);
    assert.deepEqual(result.data.cabin, { key: 'berth', parentKey: 'vessel' });
    assert.deepEqual(await rows(dataDir, "SELECT place_key FROM events WHERE key = 'start'"), [['berth']]);
    assert.deepEqual(await rows(dataDir, 'SELECT key, parent FROM places ORDER BY position'), [['vessel', null], ['berth', 'vessel']]);
  });
});

test('renameCharacter moves names, relations at both ends, arc stages, participants, and learning intervals', async () => {
  await withApp(async (send, dataDir) => {
    ok(await send('mutation ($p: ID!) { upsertCharacterRelation(projectId: $p, characterKey: "b", input: { otherKey: "a", relation: "rival" }) { position } }'));
    const result = await send('mutation ($p: ID!) { renameCharacter(projectId: $p, key: "a", newKey: "hero") { key id names { name } relations { otherKey } arcStages { stage } learnings { learningKey } } }');
    ok(result);
    assert.deepEqual(result.data.renameCharacter, {
      key: 'hero', id: 'uuid-a', names: [{ name: 'Alpha' }], relations: [{ otherKey: 'b' }, { otherKey: 'group' }],
      arcStages: [{ stage: 'call' }], learnings: [{ learningKey: 'idea' }],
    });
    assert.deepEqual(await rows(dataDir, 'SELECT character_key, other_key FROM character_relations ORDER BY character_key, position'), [['b', 'hero'], ['hero', 'b'], ['hero', 'group']]);
    assert.deepEqual(await rows(dataDir, 'SELECT DISTINCT character_key FROM event_characters'), [['hero']]);
    assert.deepEqual(await rows(dataDir, 'SELECT character_key FROM character_names'), [['hero']]);
    assert.deepEqual(await rows(dataDir, 'SELECT character_key FROM arc_stages'), [['hero']]);
    assert.deepEqual(await rows(dataDir, 'SELECT character_key FROM learning_characters'), [['hero']]);
    assert.deepEqual(await rows(dataDir, "SELECT count(*) FROM characters WHERE key = 'a'"), [[0]]);
  });
});

test('renameEvent moves participants, links at both ends, citations, and every since and until', async () => {
  await withApp(async (send, dataDir) => {
    const result = await send(`mutation ($p: ID!) {
      start: renameEvent(projectId: $p, key: "start", newKey: "opening") { key participants { characterKey } links { toKey } sources { sourceKey } }
      end: renameEvent(projectId: $p, key: "end", newKey: "finale") { key }
    }`);
    ok(result);
    assert.deepEqual(result.data.start, { key: 'opening', participants: [{ characterKey: 'a' }], links: [{ toKey: 'end' }], sources: [{ sourceKey: 'book' }] }, 'the first field sees the old target key');
    assert.deepEqual(await rows(dataDir, 'SELECT event_key, to_key FROM event_links'), [['opening', 'finale']]);
    assert.deepEqual(await rows(dataDir, 'SELECT event_key FROM event_characters ORDER BY event_key'), [['finale'], ['opening']]);
    assert.deepEqual(await rows(dataDir, 'SELECT event_key FROM event_sources'), [['opening']]);
    assert.deepEqual(await rows(dataDir, 'SELECT since FROM character_relations WHERE since IS NOT NULL'), [['opening']]);
    assert.deepEqual(await rows(dataDir, 'SELECT since FROM arc_stages'), [['opening']]);
    assert.deepEqual(await rows(dataDir, 'SELECT since, until FROM learning_characters'), [['opening', 'finale']]);
  });
});

test('renameLearning and renameSource move learning intervals and citations', async () => {
  await withApp(async (send, dataDir) => {
    const result = await send(`mutation ($p: ID!) {
      learning: renameLearning(projectId: $p, key: "idea", newKey: "secret") { key characters { characterKey } }
      source: renameSource(projectId: $p, key: "book", newKey: "chronicle") { key }
    }`);
    ok(result);
    assert.deepEqual(result.data, { learning: { key: 'secret', characters: [{ characterKey: 'a' }] }, source: { key: 'chronicle' } });
    assert.deepEqual(await rows(dataDir, 'SELECT learning_key FROM learning_characters'), [['secret']]);
    assert.deepEqual(await rows(dataDir, 'SELECT source_key FROM event_sources'), [['chronicle']]);
  });
});

test('rename reports a missing old key and a taken new key, and changes nothing', async () => {
  await withApp(async (send, dataDir) => {
    const missing = await send('mutation ($p: ID!) { renameCharacter(projectId: $p, key: "nobody", newKey: "x") { key } }');
    assert.equal(missing.errors[0].extensions.code, 'NOT_FOUND');
    assert.match(missing.errors[0].message, /Character not found: nobody/);
    const taken = await send('mutation ($p: ID!) { renameEvent(projectId: $p, key: "start", newKey: "end") { key } }');
    assert.equal(taken.errors[0].extensions.code, 'KEY_EXISTS');
    assert.match(taken.errors[0].message, /Event end already exists/);
    const act = await send('mutation ($p: ID!) { renameAct(projectId: $p, name: "act-1", newName: "act-1") { name } }');
    assert.equal(act.errors[0].extensions.code, 'KEY_UNCHANGED');
    assert.deepEqual(await rows(dataDir, 'SELECT key FROM events ORDER BY sort_order'), [['start'], ['end']]);
  });
});

test('a rename followed by a failing field is rolled back with its cascade', async () => {
  await withApp(async (send, dataDir) => {
    const result = await send(`mutation ($p: ID!) {
      rename: renameCharacter(projectId: $p, key: "a", newKey: "hero") { key }
      bad: upsertEvent(projectId: $p, input: { key: "x", actName: "missing" }) { key }
    }`);
    assert.equal(result.data, null);
    assert.deepEqual(result.errors[0].path, ['bad']);
    assert.equal(result.extensions.transaction, 'rolledBack');
    assert.deepEqual(await rows(dataDir, "SELECT key FROM characters WHERE key IN ('a', 'hero')"), [['a']]);
    assert.deepEqual(await rows(dataDir, 'SELECT DISTINCT character_key FROM character_relations'), [['a']]);
    assert.deepEqual(await rows(dataDir, 'SELECT DISTINCT character_key FROM event_characters'), [['a']]);
  });
});

test('nothing cascades on delete after a rename', async () => {
  await withApp(async (send) => {
    ok(await send('mutation ($p: ID!) { renameCharacter(projectId: $p, key: "a", newKey: "hero") { key } }'));
    const blocked = await send('mutation ($p: ID!) { deleteCharacter(projectId: $p, key: "hero") }');
    assert.match(blocked.errors[0].message, /FOREIGN KEY constraint failed/);
  });
});
