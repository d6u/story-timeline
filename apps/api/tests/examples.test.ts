import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after, before } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/graphql/yoga.js';
import { createProjectRegistry } from '../src/projects/registry.js';

const apiDir = fileURLToPath(new URL('..', import.meta.url));

const QUERY = `query Project($id: ID!) {
  project(id: $id) {
    acts { name position }
    places { key realm parentKey }
    characters {
      key id name kind category color
      names { name lang }
      relations { otherKey relation mutual member sinceKey untilKey tone }
      arcStages { stage time sinceKey }
    }
    events {
      key id title sortOrder actName placeKey isCore confidence
      participants { characterKey presence exit }
      links { toKey relation mutual kind }
      sources { sourceKey ref position }
    }
    learnings { key kind characters { characterKey sinceKey untilKey time } }
    sources { key lang location }
  }
}`;

type Project = any;

let built: { ids: string[]; huaPi: Project; odyssey: Project };
let dir: string;

/** Builds both examples once with the real `pnpm db:example` script into a temporary folder and reads them through GraphQL. */
before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'story-examples-'));
  const { DATABASE_FILE: _ignored, ...env } = process.env;
  const seeded = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/seed-example.ts', dir], { cwd: apiDir, encoding: 'utf8', env });
  assert.equal(seeded.status, 0, seeded.stderr);
  const registry = createProjectRegistry(dir);
  try {
    const yoga = createApp(registry);
    const read = async (query: string, variables?: Record<string, unknown>) => {
      const response = await yoga.fetch('http://localhost/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) });
      const result = await response.json();
      assert.equal(result.errors, undefined, JSON.stringify(result.errors));
      return result.data;
    };
    const ids = (await read('{ projects { id } }')).projects.map((p: { id: string }) => p.id);
    built = { ids, huaPi: (await read(QUERY, { id: '画皮' })).project, odyssey: (await read(QUERY, { id: 'odyssey' })).project };
  } finally {
    await registry.close();
  }
});

after(() => rm(dir, { recursive: true, force: true }));

function withExamples(check: (projects: typeof built) => void) {
  return check(built);
}

/** Every key in the project resolves, and no end event comes before its start event. */
function assertConsistent(name: string, p: Project) {
  const acts = new Set(p.acts.map((a: any) => a.name));
  const places = new Set(p.places.map((x: any) => x.key));
  const characters = new Map(p.characters.map((c: any) => [c.key, c]));
  const order = new Map<string, number>(p.events.map((e: any) => [e.key, e.sortOrder]));
  const sources = new Set(p.sources.map((s: any) => s.key));
  const event = (key: string | null, where: string) => key === null || assert.ok(order.has(key), `${name}: ${where} names unknown event ${key}`);
  const span = (since: string | null, until: string | null, where: string) => {
    event(since, where);
    event(until, where);
    if (since && until) assert.ok(order.get(since)! <= order.get(until)!, `${name}: ${where} ends before it starts`);
  };
  for (const x of p.places) if (x.parentKey) assert.ok(places.has(x.parentKey), `${name}: place ${x.key}`);
  for (const c of p.characters as any[]) {
    for (const r of c.relations) {
      assert.ok(characters.has(r.otherKey), `${name}: relation of ${c.key}`);
      if (r.member) assert.equal((characters.get(r.otherKey) as any).kind, 'group', `${name}: ${c.key} is a member of a group`);
      span(r.sinceKey, r.untilKey, `relation ${c.key} -> ${r.otherKey}`);
    }
    for (const s of c.arcStages) event(s.sinceKey, `arc stage of ${c.key}`);
  }
  const deaths = new Map<string, number>();
  for (const e of p.events) {
    assert.ok(acts.has(e.actName), `${name}: act of ${e.key}`);
    if (e.placeKey) assert.ok(places.has(e.placeKey), `${name}: place of ${e.key}`);
    assert.ok(e.participants.length > 0, `${name}: ${e.key} has participants`);
    assert.ok(e.sources.length > 0, `${name}: ${e.key} has a citation`);
    assert.deepEqual(e.sources.map((s: any) => s.position), e.sources.map((_: unknown, i: number) => i + 1), `${name}: citation order of ${e.key}`);
    for (const s of e.sources) assert.ok(sources.has(s.sourceKey), `${name}: source of ${e.key}`);
    for (const x of e.participants) {
      assert.ok(characters.has(x.characterKey), `${name}: participant of ${e.key}`);
      if (x.exit === 'dies') deaths.set(x.characterKey, (deaths.get(x.characterKey) ?? 0) + 1);
    }
    for (const l of e.links) event(l.toKey, `link of ${e.key}`);
  }
  for (const [who, n] of deaths) assert.equal(n, 1, `${name}: ${who} dies once`);
  for (const l of p.learnings) {
    for (const k of l.characters) {
      assert.ok(characters.has(k.characterKey), `${name}: learning ${l.key}`);
      span(k.sinceKey, k.untilKey, `learning ${l.key} (${k.characterKey})`);
    }
  }
}

test('db:example builds both example projects, and the API lists them', () => {
  withExamples(({ ids, huaPi, odyssey }) => {
    assert.deepEqual(ids, ['odyssey', '画皮']);
    assert.ok(huaPi.events.length >= 10 && huaPi.events.length <= 20, `画皮 has ${huaPi.events.length} events`);
    assert.ok(odyssey.events.length >= 30 && odyssey.events.length <= 45, `odyssey has ${odyssey.events.length} events`);
    for (const p of [huaPi, odyssey]) {
      for (const list of [p.acts, p.places, p.characters, p.events, p.learnings, p.sources]) assert.ok(list.length > 0);
      for (const row of [...p.characters, ...p.events]) assert.match(row.id, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });
});

test('both example projects are consistent', () => {
  withExamples(({ huaPi, odyssey }) => {
    assertConsistent('画皮', huaPi);
    assertConsistent('odyssey', odyssey);
  });
});

test('画皮 is in Chinese and follows the tale', () => {
  withExamples(({ huaPi }) => {
    for (const e of huaPi.events) assert.match(e.title, /^\p{Script=Han}+$/u, e.key);
    const ev = new Map(huaPi.events.map((e: any) => [e.key, e]));
    const exit = (event: string, who: string) => (ev.get(event) as any).participants.find((x: any) => x.characterKey === who)?.exit;
    assert.equal(exit('lie-xin', 'wang'), 'leaves', '王生 is killed, and the schema has no revival, so he leaves');
    assert.equal(exit('zhan-gui', 'demon'), 'dies');
    assert.equal((ev.get('hui-sheng') as any).participants[0].characterKey, 'wang', '王生 is back in body at the end');
    // The tale is told in story order: acts and sortOrder agree.
    const actPos = new Map(huaPi.acts.map((a: any) => [a.name, a.position]));
    const byOrder = [...huaPi.events].sort((a: any, b: any) => a.sortOrder - b.sortOrder);
    for (let i = 1; i < byOrder.length; i++) assert.ok(actPos.get(byOrder[i - 1].actName)! <= actPos.get(byOrder[i].actName)!);
    const painted = huaPi.learnings.find((l: any) => l.key === 'painted-skin');
    assert.deepEqual(painted.characters.map((k: any) => [k.characterKey, k.sinceKey]), [['demon', null], ['wang', 'kui-pi'], ['daoshi', 'ye-qiu'], ['chen', 'xuan-fu']]);
  });
});

test('the Odyssey shows its flashback: telling order differs from story time', () => {
  withExamples(({ odyssey }) => {
    for (const e of odyssey.events) assert.doesNotMatch(e.title, /\p{Script=Han}/u, e.key);
    const actPos = new Map(odyssey.acts.map((a: any) => [a.name, a.position]));
    const ev = new Map<string, any>(odyssey.events.map((e: any) => [e.key, e]));
    const tale = ev.get('tale-told');
    const told = tale.links.filter((l: any) => l.relation === 'flashback').map((l: any) => ev.get(l.toKey));
    assert.equal(told.length, 11);
    for (const e of told) {
      assert.equal(e.actName, tale.actName, `${e.key} is in the act that tells it`);
      assert.ok(e.sortOrder < ev.get('council').sortOrder, `${e.key} happens before Book 1 in story time`);
    }
    assert.ok(actPos.get(tale.actName)! > actPos.get(ev.get('council').actName)!, 'the tale is told after the Telemachy');
    // A second flashback: the boar hunt of Book 19 is the earliest event in story time.
    const boar = ev.get('boar-hunt');
    assert.equal(Math.min(...odyssey.events.map((e: any) => e.sortOrder)), boar.sortOrder);
    assert.equal(boar.actName, ev.get('scar').actName);
    assert.deepEqual(ev.get('scar').links.map((l: any) => [l.toKey, l.kind]), [['boar-hunt', 'reveal']]);
    // Who knows the beggar is Odysseus, in story order.
    const known = odyssey.learnings.find((l: any) => l.key === 'beggar-is-odysseus').characters.map((k: any) => k.characterKey);
    assert.deepEqual(known, ['athena', 'telemachus', 'argos', 'eurycleia', 'eumaeus', 'philoetius', 'suitors', 'penelope', 'laertes']);
  });
});

test('together the examples use the stored values of the schema enums', () => {
  withExamples(({ huaPi, odyssey }) => {
    const both = [huaPi, odyssey];
    const values = (pick: (p: Project) => unknown[]) => new Set(both.flatMap(pick).filter((v) => v !== null && v !== undefined));
    assert.deepEqual(values((p) => p.events.flatMap((e: any) => e.links.map((l: any) => l.kind))), new Set(['cause', 'setup', 'reveal', 'echo']));
    assert.deepEqual(values((p) => p.characters.flatMap((c: any) => c.relations.map((r: any) => r.tone))), new Set(['family', 'love', 'friend', 'work', 'hostile', 'other']));
    assert.deepEqual(values((p) => p.events.flatMap((e: any) => e.participants.map((x: any) => x.presence))), new Set(['body', 'mind', 'spirit', 'mentioned', 'related']));
    assert.deepEqual(values((p) => p.events.flatMap((e: any) => e.participants.map((x: any) => x.exit))), new Set(['dies', 'leaves']));
    assert.deepEqual(values((p) => p.events.map((e: any) => e.confidence)), new Set(['likely', 'unsure']));
    assert.deepEqual(values((p) => p.learnings.map((l: any) => l.kind)), new Set(['knowledge', 'realization', 'idea']));
    assert.deepEqual(values((p) => p.characters.map((c: any) => c.kind)), new Set(['person', 'group']));
    // Neither work has a place inside a mind, so the realm `mind` is the one enum value left out.
    assert.deepEqual(values((p) => p.places.map((x: any) => x.realm)), new Set(['physical', 'dream', 'spirit']));
    // English relation words are not in the web app's word list, so every Odyssey relation that is not membership stores its tone.
    for (const c of odyssey.characters) for (const r of c.relations) if (!r.member) assert.ok(r.tone, `${c.key} -> ${r.otherKey} has a tone`);
    assert.ok(both.some((p) => p.characters.some((c: any) => c.relations.some((r: any) => r.mutual))));
    assert.ok(both.some((p) => p.events.some((e: any) => e.links.some((l: any) => l.mutual))));
    assert.ok(both.some((p) => p.learnings.some((l: any) => l.characters.some((k: any) => k.untilKey))));
    assert.ok(both.some((p) => p.learnings.some((l: any) => l.characters.some((k: any) => k.time))));
    assert.ok(both.some((p) => p.characters.some((c: any) => c.color?.startsWith('light-dark('))));
  });
});
