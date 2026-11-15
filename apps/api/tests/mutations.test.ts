import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/graphql/yoga.js';
import { createProjectRegistry } from '../src/projects/registry.js';
import { withDataDir } from './helpers/seed.js';

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
          body: JSON.stringify({ query, variables }),
        });
        return response.json();
      });
    } finally {
      await registry.close();
    }
  });
}

/** One batch that writes one row into every table, parents before children. */
const BATCH = `mutation Batch($p: ID!) {
  act: upsertAct(projectId: $p, input: { name: "act-1", position: 1, span: "spring" }) { name position span }
  place: upsertPlace(projectId: $p, input: { key: "ship", name: "Ship" }) { key name realm parentKey }
  room: upsertPlace(projectId: $p, input: { key: "cabin", name: "Cabin", parentKey: "ship" }) { key parentKey }
  a: upsertCharacter(projectId: $p, input: { key: "a", name: "A", category: "main", position: 1, color: "oklch(0.58 0.16 40)" }) { key name kind category position color }
  g: upsertCharacter(projectId: $p, input: { key: "g", kind: group }) { key kind }
  source: upsertSource(projectId: $p, input: { key: "book", title: "Book" }) { key title }
  learning: upsertLearning(projectId: $p, input: { key: "idea", text: "The king is dead", kind: realization }) { key text kind }
  start: upsertEvent(projectId: $p, input: { key: "start", title: "Start", actName: "act-1", sortOrder: 1, placeKey: "cabin", isCore: true, confidence: likely }) { key title actName sortOrder placeKey isCore confidence }
  end: upsertEvent(projectId: $p, input: { key: "end", actName: "act-1", sortOrder: 2 }) { key sortOrder }
  name: upsertCharacterName(projectId: $p, characterKey: "a", input: { name: "Alpha", lang: "en" }) { name lang }
  rel1: upsertCharacterRelation(projectId: $p, characterKey: "a", input: { otherKey: "g", member: true }) { position otherKey member mutual }
  rel2: upsertCharacterRelation(projectId: $p, characterKey: "a", input: { otherKey: "g", relation: "rival", sinceKey: "start" }) { position otherKey relation sinceKey }
  stage: upsertArcStage(projectId: $p, characterKey: "a", input: { stage: "call", sinceKey: "start" }) { position stage sinceKey }
  part: upsertEventCharacter(projectId: $p, eventKey: "end", input: { characterKey: "a", presence: body, exit: dies }) { characterKey presence exit }
  link: upsertEventLink(projectId: $p, eventKey: "start", input: { position: 1, toKey: "end", relation: "causes" }) { position toKey relation mutual }
  cite: upsertEventSource(projectId: $p, eventKey: "start", input: { sourceKey: "book", ref: "1:3" }) { sourceKey ref }
  knows: upsertLearningCharacter(projectId: $p, learningKey: "idea", input: { characterKey: "a", sinceKey: "start", untilKey: "end" }) { position characterKey sinceKey untilKey }
}`;

test('one batch writes every table in document order and returns the fresh rows', async () => {
  await withApp(async (send) => {
    const result = await send(BATCH, { p: 'empty' });
    assert.equal(result.errors, undefined, JSON.stringify(result.errors));
    const d = result.data;
    assert.deepEqual(d.act, { name: 'act-1', position: 1, span: 'spring' });
    assert.deepEqual(d.place, { key: 'ship', name: 'Ship', realm: 'physical', parentKey: null });
    assert.deepEqual(d.room, { key: 'cabin', parentKey: 'ship' });
    assert.deepEqual(d.a, { key: 'a', name: 'A', kind: 'person', category: 'main', position: 1, color: 'oklch(0.58 0.16 40)' });
    assert.deepEqual(d.g, { key: 'g', kind: 'group' });
    assert.deepEqual(d.learning, { key: 'idea', text: 'The king is dead', kind: 'realization' });
    assert.deepEqual(d.start, { key: 'start', title: 'Start', actName: 'act-1', sortOrder: 1, placeKey: 'cabin', isCore: true, confidence: 'likely' });
    assert.deepEqual(d.rel1, { position: 1, otherKey: 'g', member: true, mutual: false });
    assert.deepEqual(d.rel2, { position: 2, otherKey: 'g', relation: 'rival', sinceKey: 'start' });
    assert.deepEqual(d.stage, { position: 1, stage: 'call', sinceKey: 'start' });
    assert.deepEqual(d.part, { characterKey: 'a', presence: 'body', exit: 'dies' });
    assert.deepEqual(d.link, { position: 1, toKey: 'end', relation: 'causes', mutual: false });
    assert.deepEqual(d.cite, { sourceKey: 'book', ref: '1:3' });
    assert.deepEqual(d.knows, { position: 1, characterKey: 'a', sinceKey: 'start', untilKey: 'end' });

    const read = await send('query ($p: ID!) { project(id: $p) { events { key participants { characterKey } links { toKey } sources { sourceKey } } characters { key relations { position } arcStages { stage } names { name } } } }', { p: 'empty' });
    assert.equal(read.errors, undefined);
    assert.deepEqual(read.data.project.events.map((e: any) => [e.key, e.participants.length, e.links.length, e.sources.length]), [['start', 0, 1, 1], ['end', 1, 0, 0]]);
    assert.deepEqual(read.data.project.characters[0].relations.map((r: any) => r.position), [1, 2]);
  });
});

test('upsert is a patch: omitted fields stay, null clears, and the batch is idempotent', async () => {
  await withApp(async (send) => {
    assert.equal((await send(BATCH, { p: 'empty' })).errors, undefined);
    assert.equal((await send(BATCH, { p: 'empty' })).errors, undefined, 'second run');
    const patch = await send('mutation ($p: ID!) { upsertEvent(projectId: $p, input: { key: "start", description: "Patched", placeKey: null }) { key title description placeKey actName isCore confidence } }', { p: 'empty' });
    assert.equal(patch.errors, undefined, JSON.stringify(patch.errors));
    assert.deepEqual(patch.data.upsertEvent, { key: 'start', title: 'Start', description: 'Patched', placeKey: null, actName: 'act-1', isCore: true, confidence: 'likely' });
    const given = await send('mutation ($p: ID!) { upsertEventLink(projectId: $p, eventKey: "start", input: { position: 1, note: "why" }) { position toKey relation note } }', { p: 'empty' });
    assert.deepEqual(given.data.upsertEventLink, { position: 1, toKey: 'end', relation: 'causes', note: 'why' });
    const count = await send('query ($p: ID!) { project(id: $p) { characters { relations { position } } events { links { position } } } }', { p: 'empty' });
    assert.deepEqual(count.data.project.characters[0].relations.map((r: any) => r.position), [1, 2, 3, 4], 'append twice adds rows');
    assert.deepEqual(count.data.project.events[0].links.map((l: any) => l.position), [1], 'the link gives its position, so a resend patches it');
    const again = await send('mutation ($p: ID!) { upsertEventLink(projectId: $p, eventKey: "start", input: { toKey: "end", relation: "causes" }) { position } }', { p: 'empty' });
    assert.equal(again.errors[0].extensions.rule, 'event_links_pair_relation_unique', 'an appended copy of the same link is refused');
  });
});

test('delete removes one row, reports a missing row, and refuses to orphan children', async () => {
  await withApp(async (send) => {
    assert.equal((await send(BATCH, { p: 'empty' })).errors, undefined);
    const blocked = await send('mutation ($p: ID!) { deleteEvent(projectId: $p, key: "end") }', { p: 'empty' });
    assert.equal(blocked.data, null);
    assert.match(blocked.errors[0].message, /Database rejected the write: .*FOREIGN KEY/);
    const steps = await send(`mutation ($p: ID!) {
      part: deleteEventCharacter(projectId: $p, eventKey: "end", characterKey: "a")
      link: deleteEventLink(projectId: $p, eventKey: "start", position: 1)
      knows: deleteLearningCharacter(projectId: $p, learningKey: "idea", position: 1)
      event: deleteEvent(projectId: $p, key: "end")
      again: deleteEvent(projectId: $p, key: "end")
    }`, { p: 'empty' });
    assert.equal(steps.errors, undefined, JSON.stringify(steps.errors));
    assert.deepEqual(steps.data, { part: true, link: true, knows: true, event: true, again: false });
  });
});

test('constraint and project errors are readable', async () => {
  await withApp(async (send) => {
    const unknown = await send('mutation { upsertAct(projectId: "nope", input: { name: "x" }) { name } }');
    assert.match(unknown.errors[0].message, /Project not found: nope/);
    const fk = await send('mutation ($p: ID!) { upsertEvent(projectId: $p, input: { key: "e", actName: "missing" }) { key } }', { p: 'empty' });
    assert.match(fk.errors[0].message, /FOREIGN KEY/);
    assert.equal((await send(BATCH, { p: 'empty' })).errors, undefined);
    const check = await send('mutation ($p: ID!) { upsertCharacterRelation(projectId: $p, characterKey: "a", input: { position: 1, mutual: true }) { position } }', { p: 'empty' });
    assert.match(check.errors[0].message, /CHECK constraint|member_is_one_way/);
  });
});
