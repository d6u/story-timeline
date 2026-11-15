import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/graphql/yoga.js';
import { createProjectRegistry } from '../src/projects/registry.js';
import { withDataDir } from './helpers/seed.js';

async function withApp(check: (query: (query: string, variables?: Record<string, unknown>) => Promise<any>) => Promise<void>) {
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

const PROJECT_QUERY = `query Project($id: ID!) {
  project(id: $id) {
    id name
    acts { name position span description }
    places { key position name realm parentKey description }
    characters {
      key id name description category kind position color
      names { name position lang note }
      relations { position otherKey relation mutual member sinceKey untilKey tone }
      arcStages { position stage time sinceKey description }
      learnings { learningKey position characterKey sinceKey untilKey time note }
    }
    events {
      key id title description isCore sortOrder actName time placeKey confidence
      participants { characterKey position presence exit }
      links { position toKey relation mutual note kind }
      sources { sourceKey ref position }
      learnings { learningKey characterKey sinceKey untilKey }
    }
    learnings { key position text kind description characters { characterKey sinceKey untilKey } }
    sources { key position title lang location note }
  }
}`;

test('projects lists every sqlite file in the data folder', async () => {
  await withApp(async (query) => {
    const result = await query('{ projects { id name } }');
    assert.equal(result.errors, undefined);
    assert.deepEqual(result.data.projects, [
      { id: 'demo', name: 'demo' },
      { id: 'empty', name: 'empty' },
    ]);
  });
});

test('project returns the whole seeded story in one query', async () => {
  await withApp(async (query) => {
    const result = await query(PROJECT_QUERY, { id: 'demo' });
    assert.equal(result.errors, undefined, JSON.stringify(result.errors));
    const project = result.data.project;
    assert.equal(project.id, 'demo');
    assert.deepEqual(project.acts, [{ name: 'act-1', position: null, span: null, description: null }]);
    assert.deepEqual(project.places.map((p: any) => [p.key, p.realm, p.parentKey]), [['ship', 'physical', null], ['cabin', 'physical', 'ship']]);

    const [a, b, group] = project.characters;
    assert.deepEqual([a.key, a.id, a.category, a.kind, a.position], ['a', 'uuid-a', 'main', 'person', 1]);
    assert.deepEqual([b.key, b.id, b.kind], ['b', null, 'person']);
    assert.equal(group.kind, 'group');
    assert.deepEqual(a.names, [{ name: 'Alpha', position: 1, lang: 'en', note: null }]);
    assert.deepEqual(a.relations, [
      { position: 1, otherKey: 'b', relation: 'friend', mutual: true, member: false, sinceKey: 'start', untilKey: null, tone: 'friend' },
      { position: 2, otherKey: 'group', relation: 'member', mutual: false, member: true, sinceKey: null, untilKey: null, tone: null },
    ]);
    assert.deepEqual(b.relations, []);
    assert.deepEqual(a.arcStages, [{ position: 1, stage: 'call', time: null, sinceKey: 'start', description: null }]);
    assert.deepEqual(a.learnings, [{ learningKey: 'idea', position: 1, characterKey: 'a', sinceKey: 'start', untilKey: 'end', time: null, note: null }]);

    const [start, end] = project.events;
    assert.deepEqual([start.key, start.title, start.isCore, start.sortOrder, start.actName, start.time, start.placeKey, start.confidence],
      ['start', 'Start', true, 1, 'act-1', 'day 1', 'cabin', 'likely']);
    assert.deepEqual([end.key, end.isCore, end.confidence, end.placeKey], ['end', false, null, null]);
    assert.deepEqual(start.participants, [{ characterKey: 'a', position: 1, presence: 'body', exit: null }]);
    assert.deepEqual(end.participants, [{ characterKey: 'a', position: 1, presence: 'body', exit: 'dies' }]);
    assert.deepEqual(start.links, [{ position: 1, toKey: 'end', relation: 'causes', mutual: false, note: null, kind: 'cause' }]);
    assert.deepEqual(end.links, []);
    assert.deepEqual(start.sources, [{ sourceKey: 'book', ref: '1:3-24', position: 1 }]);
    assert.deepEqual(start.learnings, [{ learningKey: 'idea', characterKey: 'a', sinceKey: 'start', untilKey: 'end' }]);
    assert.deepEqual(end.learnings, start.learnings);

    assert.deepEqual(project.learnings, [{ key: 'idea', position: null, text: null, kind: 'knowledge', description: null, characters: [{ characterKey: 'a', sinceKey: 'start', untilKey: 'end' }] }]);
    assert.deepEqual(project.sources, [{ key: 'book', position: null, title: null, lang: null, location: null, note: null }]);
  });
});

test('an empty project has empty lists', async () => {
  await withApp(async (query) => {
    const result = await query(PROJECT_QUERY, { id: 'empty' });
    assert.equal(result.errors, undefined);
    assert.deepEqual(result.data.project, { id: 'empty', name: 'empty', acts: [], places: [], characters: [], events: [], learnings: [], sources: [] });
  });
});

test('an unknown or unsafe id returns null', async () => {
  await withApp(async (query) => {
    for (const id of ['nope', '../demo', 'demo.sqlite', '', 'example/..']) {
      const result = await query('query ($id: ID!) { project(id: $id) { id } }', { id });
      assert.equal(result.errors, undefined);
      assert.equal(result.data.project, null, id);
    }
  });
});

test('graphiql and introspection are available', async () => {
  await withApp(async (query) => {
    const result = await query('{ __type(name: "Query") { description fields { name description } } }');
    assert.match(result.data.__type.description, /How to read a story/);
    assert.ok(result.data.__type.fields.every((f: any) => f.description));
  });
  await withDataDir(async (dataDir) => {
    const registry = createProjectRegistry(dataDir);
    const yoga = createApp(registry);
    const page = await yoga.fetch('http://localhost/graphql', { headers: { accept: 'text/html' } });
    assert.equal(page.status, 200);
    assert.match(await page.text(), /GraphiQL/i);
    await registry.close();
  });
});
