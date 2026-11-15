import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/graphql/yoga.js';
import { createProjectRegistry } from '../src/projects/registry.js';
import { seed, withDataDir, withDatabase } from './helpers/seed.js';

type Send = (query: string, variables?: Record<string, unknown>) => Promise<any>;

async function withApp(check: (send: Send) => Promise<void>) {
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
      });
    } finally {
      await registry.close();
    }
  });
}

const ok = (result: any) => assert.equal(result.errors, undefined, JSON.stringify(result.errors));

test('EventLink.kind accepts the four kinds, keeps its value on a patch, and null clears it', async () => {
  await withApp(async (send) => {
    const set = await send('mutation ($p: ID!) { upsertEventLink(projectId: $p, eventKey: "end", input: { toKey: "start", relation: "回忆", kind: reveal }) { position kind relation } }');
    ok(set);
    assert.deepEqual(set.data.upsertEventLink, { position: 1, kind: 'reveal', relation: '回忆' });
    const patch = await send('mutation ($p: ID!) { upsertEventLink(projectId: $p, eventKey: "end", input: { position: 1, note: "why" }) { kind note } }');
    assert.deepEqual(patch.data.upsertEventLink, { kind: 'reveal', note: 'why' });
    for (const kind of ['cause', 'setup', 'echo']) {
      const each = await send(`mutation ($p: ID!) { upsertEventLink(projectId: $p, eventKey: "end", input: { position: 1, kind: ${kind} }) { kind } }`);
      assert.equal(each.data.upsertEventLink.kind, kind);
    }
    const cleared = await send('mutation ($p: ID!) { upsertEventLink(projectId: $p, eventKey: "end", input: { position: 1, kind: null }) { kind relation } }');
    assert.deepEqual(cleared.data.upsertEventLink, { kind: null, relation: '回忆' });
  });
});

test('EventLink.kind rejects a value outside the enum, in GraphQL and in SQL', async () => {
  await withApp(async (send) => {
    const wrong = await send('mutation ($p: ID!) { upsertEventLink(projectId: $p, eventKey: "start", input: { position: 1, kind: causes }) { kind } }');
    assert.match(wrong.errors[0].message, /LinkKind/);
  });
  await withDatabase(async (connection) => {
    await seed(connection);
    await assert.rejects(
      () => connection.client.execute("INSERT INTO event_links(event_key, position, to_key, kind) VALUES ('start', 1, 'end', 'causes')"),
      /CHECK constraint failed: event_links_kind/,
    );
  });
});

test('CharacterRelation.tone accepts the six tones, keeps its value on a patch, and null clears it', async () => {
  await withApp(async (send) => {
    const set = await send('mutation ($p: ID!) { upsertCharacterRelation(projectId: $p, characterKey: "b", input: { otherKey: "a", relation: "阿尔法", tone: hostile }) { position tone relation } }');
    ok(set);
    assert.deepEqual(set.data.upsertCharacterRelation, { position: 1, tone: 'hostile', relation: '阿尔法' });
    const patch = await send('mutation ($p: ID!) { upsertCharacterRelation(projectId: $p, characterKey: "b", input: { position: 1, sinceKey: "start" }) { tone sinceKey } }');
    assert.deepEqual(patch.data.upsertCharacterRelation, { tone: 'hostile', sinceKey: 'start' });
    for (const tone of ['family', 'love', 'friend', 'work', 'other']) {
      const each = await send(`mutation ($p: ID!) { upsertCharacterRelation(projectId: $p, characterKey: "b", input: { position: 1, tone: ${tone} }) { tone } }`);
      ok(each);
      assert.equal(each.data.upsertCharacterRelation.tone, tone);
    }
    const cleared = await send('mutation ($p: ID!) { upsertCharacterRelation(projectId: $p, characterKey: "b", input: { position: 1, tone: null }) { tone relation } }');
    assert.deepEqual(cleared.data.upsertCharacterRelation, { tone: null, relation: '阿尔法' });
    const read = await send('query ($p: ID!) { project(id: $p) { characters { key relations { position tone } } } }');
    assert.deepEqual(read.data.project.characters.find((c: any) => c.key === 'b').relations, [{ position: 1, tone: null }]);
  });
});

test('CharacterRelation.tone rejects a value outside the enum, in GraphQL and in SQL', async () => {
  await withApp(async (send) => {
    const wrong = await send('mutation ($p: ID!) { upsertCharacterRelation(projectId: $p, characterKey: "a", input: { position: 1, tone: neutral }) { tone } }');
    assert.match(wrong.errors[0].message, /RelationTone/);
    const read = await send('query ($p: ID!) { project(id: $p) { characters { key relations { position tone } } } }');
    assert.equal(read.data.project.characters.find((c: any) => c.key === 'a').relations[0].tone, 'friend');
  });
  await withDatabase(async (connection) => {
    await seed(connection);
    await assert.rejects(
      () => connection.client.execute("INSERT INTO character_relations(character_key, position, other_key, tone) VALUES ('b', 1, 'a', 'enemy')"),
      /CHECK constraint failed: character_relations_tone/,
    );
  });
});

test('a relation to itself, a link to itself, and a place that is its own parent are rejected with the rule name', async () => {
  await withApp(async (send) => {
    const cases = [
      ['mutation ($p: ID!) { upsertCharacterRelation(projectId: $p, characterKey: "b", input: { otherKey: "b", relation: "self" }) { position } }', 'character_relations_not_self', /cannot have a relation to itself/],
      ['mutation ($p: ID!) { upsertEventLink(projectId: $p, eventKey: "start", input: { toKey: "start", relation: "loop" }) { position } }', 'event_links_not_self', /cannot link to itself/],
      ['mutation ($p: ID!) { upsertPlace(projectId: $p, input: { key: "ship", parentKey: "ship" }) { key } }', 'places_not_own_parent', /cannot be its own parent/],
    ] as const;
    for (const [query, rule, meaning] of cases) {
      const result = await send(query);
      assert.equal(result.data, null, rule);
      assert.equal(result.extensions.transaction, 'rolledBack');
      assert.equal(result.errors[0].extensions.code, 'DATABASE_CONSTRAINT');
      assert.equal(result.errors[0].extensions.rule, rule);
      assert.match(result.errors[0].message, new RegExp(`CHECK constraint failed: ${rule}`));
      assert.match(result.errors[0].message, meaning);
    }
  });
});

test('a second link with the same direction and word is rejected; another word, the other direction, or no word is allowed', async () => {
  await withApp(async (send) => {
    const duplicate = await send('mutation ($p: ID!) { upsertEventLink(projectId: $p, eventKey: "start", input: { toKey: "end", relation: "causes" }) { position } }');
    assert.equal(duplicate.data, null);
    assert.equal(duplicate.errors[0].extensions.rule, 'event_links_pair_relation_unique');
    assert.match(duplicate.errors[0].message, /UNIQUE constraint failed: event_links\.event_key, event_links\.to_key, event_links\.relation/);
    assert.match(duplicate.errors[0].message, /at most one link to the same `toKey` with the same `relation`/);
    ok(await send(`mutation ($p: ID!) {
      other: upsertEventLink(projectId: $p, eventKey: "start", input: { toKey: "end", relation: "foreshadows" }) { position }
      back: upsertEventLink(projectId: $p, eventKey: "end", input: { toKey: "start", relation: "causes" }) { position }
      none1: upsertEventLink(projectId: $p, eventKey: "start", input: { toKey: "end" }) { position }
      none2: upsertEventLink(projectId: $p, eventKey: "start", input: { toKey: "end" }) { position }
    }`));
  });
});

test('the new rules hold for direct SQL writes too', async () => {
  await withDatabase(async (connection) => {
    await seed(connection);
    const { client } = connection;
    for (const [statement, error] of [
      ["INSERT INTO character_relations(character_key, position, other_key) VALUES ('a', 1, 'a')", /character_relations_not_self/],
      ["INSERT INTO event_links(event_key, position, to_key) VALUES ('start', 1, 'start')", /event_links_not_self/],
      ["INSERT INTO places(key, parent) VALUES ('loop', 'loop')", /places_not_own_parent/],
    ] as const) {
      await assert.rejects(() => client.execute(statement), error);
    }
    await client.execute("INSERT INTO event_links(event_key, position, to_key, relation) VALUES ('start', 1, 'end', 'causes')");
    await assert.rejects(
      () => client.execute("INSERT INTO event_links(event_key, position, to_key, relation) VALUES ('start', 2, 'end', 'causes')"),
      /UNIQUE constraint failed/,
    );
  });
});

test('Event.sources come in position order, then the citations without a position by sourceKey', async () => {
  await withApp(async (send) => {
    ok(await send(`mutation ($p: ID!) {
      s1: upsertSource(projectId: $p, input: { key: "z-film" }) { key }
      s2: upsertSource(projectId: $p, input: { key: "a-note" }) { key }
      s3: upsertSource(projectId: $p, input: { key: "c-diary" }) { key }
      c0: upsertEventSource(projectId: $p, eventKey: "start", input: { sourceKey: "book", position: 2 }) { position ref }
      c1: upsertEventSource(projectId: $p, eventKey: "start", input: { sourceKey: "z-film" }) { position }
      c2: upsertEventSource(projectId: $p, eventKey: "start", input: { sourceKey: "a-note" }) { position }
      c3: upsertEventSource(projectId: $p, eventKey: "start", input: { sourceKey: "c-diary", position: 1 }) { position }
    }`));
    const read = await send('query ($p: ID!) { project(id: $p) { events { key sources { sourceKey position ref } } } }');
    ok(read);
    assert.deepEqual(read.data.project.events[0].sources, [
      { sourceKey: 'c-diary', position: 1, ref: null },
      { sourceKey: 'book', position: 2, ref: '1:3-24' },
      { sourceKey: 'a-note', position: null, ref: null },
      { sourceKey: 'z-film', position: null, ref: null },
    ]);
    const cleared = await send('mutation ($p: ID!) { upsertEventSource(projectId: $p, eventKey: "start", input: { sourceKey: "book", position: null }) { position ref } }');
    assert.deepEqual(cleared.data.upsertEventSource, { position: null, ref: '1:3-24' });
  });
});
