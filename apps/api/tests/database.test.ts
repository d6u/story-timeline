import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createDatabase } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';
import { seed, withDatabase, type Connection } from './helpers/seed.js';

function quote(name: string) {
  return `"${name.replaceAll('"', '""')}"`;
}

test('the migrated SQLite file has every ERD table, column, key, and foreign key', async () => {
  const erd = await readFile(new URL('../../../docs/story-schema-erd.mmd', import.meta.url), 'utf8');
  const tables = [...erd.matchAll(/^ {4}(\w+) \{\n([\s\S]*?)^ {4}\}/gm)];
  assert.equal(tables.length, 13);

  await withDatabase(async ({ client }) => {
    let foreignKeys = 0;
    const actualTables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '__drizzle_migrations'",
    );
    assert.deepEqual(
      actualTables.rows.map((row) => row.name).sort(),
      tables.map((match) => match[1]).sort(),
    );

    for (const [, name, body] of tables) {
      const columns = [...body.matchAll(/^\s+(TEXT|INTEGER) (\w+)(?: (PK,FK|PK|FK|UK))?/gm)];
      const info = await client.execute(`PRAGMA table_info(${quote(name)})`);
      assert.deepEqual(info.rows.map((row) => row.name), columns.map((match) => match[2]), name);
      for (const [, type, column] of columns) {
        assert.equal(info.rows.find((row) => row.name === column)?.type, type, `${name}.${column}`);
      }
      assert.deepEqual(
        info.rows.filter((row) => Number(row.pk) > 0)
          .sort((a, b) => Number(a.pk) - Number(b.pk)).map((row) => row.name),
        columns.filter((match) => match[3]?.includes('PK')).map((match) => match[2]),
        `${name} primary key`,
      );
      const indexes = await client.execute(`PRAGMA index_list(${quote(name)})`);
      const uniqueColumns: string[] = [];
      for (const index of indexes.rows.filter((row) => Number(row.unique) === 1)) {
        const fields = await client.execute(`PRAGMA index_info(${quote(String(index.name))})`);
        if (fields.rows.length === 1) uniqueColumns.push(String(fields.rows[0].name));
      }
      for (const column of columns.filter((match) => match[3] === 'UK')) {
        assert.ok(uniqueColumns.includes(column[2]), `${name}.${column[2]} must be unique`);
      }
      const expectedLinks = [...erd.matchAll(/^ {4}(\w+) (?:\|\||\|o)(?:--|\.\.)o\{ (\w+) : (\w+)$/gm)]
        .filter((match) => match[2] === name)
        .map((match) => `${match[3]}:${match[1]}`).sort();
      const links = await client.execute(`PRAGMA foreign_key_list(${quote(name)})`);
      assert.deepEqual(
        links.rows.map((row) => `${row.from}:${row.table}`).sort(),
        expectedLinks,
        `${name} foreign keys`,
      );
      for (const row of links.rows) {
        foreignKeys += 1;
        assert.equal(row.on_update, 'CASCADE', `${name}.${row.from} follows a renamed parent key`);
        assert.equal(row.on_delete, 'NO ACTION', `${name}.${row.from} never cascades on delete`);
      }
    }
    assert.equal(foreignKeys, 20);
    assert.equal((await client.execute('PRAGMA foreign_keys')).rows[0].foreign_keys, 1);
    assert.equal((await client.execute('PRAGMA integrity_check')).rows[0].integrity_check, 'ok');
  });
});

test('all modules accept connected records, relation history, and repeated learning', async () => {
  await withDatabase(async (connection) => {
    await seed(connection);
    const { db, client } = connection;
    await db.insert(schema.places).values({ key: 'room', realm: 'mind' });
    await db.insert(schema.events).values({ key: 'dream', act: 'act-1', placeKey: 'room' });
    await db.insert(schema.characterRelations).values([
      { characterKey: 'a', position: 0, otherKey: 'group', member: true, until: 'end' },
      { characterKey: 'a', position: 1, otherKey: 'group', member: true, since: 'end' },
    ]);
    await db.insert(schema.eventCharacters).values({
      eventKey: 'dream', characterKey: 'a', presence: 'mind', exit: 'leaves',
    });
    await db.insert(schema.eventLinks).values([
      { eventKey: 'start', position: 0, toKey: 'end', relation: 'causes' },
      { eventKey: 'start', position: 1, toKey: 'end', relation: 'echoes', mutual: true },
    ]);
    await db.insert(schema.characterNames).values({ characterKey: 'a', name: 'Another name', lang: 'en' });
    await db.insert(schema.learningCharacters).values([
      { learningKey: 'idea', position: 0, characterKey: 'a', since: 'start', until: 'end' },
      { learningKey: 'idea', position: 1, characterKey: 'a', since: 'dream' },
    ]);
    await db.insert(schema.arcStages).values({ characterKey: 'a', position: 0, stage: 'Change', since: 'start' });
    await db.insert(schema.eventSources).values({ eventKey: 'start', sourceKey: 'book', ref: '1:3-24' });
    assert.equal((await db.select().from(schema.characters))[0].kind, 'person');
    assert.equal((await db.select().from(schema.eventLinks))[1].mutual, true);
    assert.equal((await client.execute('PRAGMA foreign_key_check')).rows.length, 0);
  });
});

test('SQLite rejects broken links, missing required links, and duplicate keys', async () => {
  await withDatabase(async (connection) => {
    await seed(connection);
    const { client } = connection;
    for (const statement of [
      "INSERT INTO event_characters(event_key, character_key) VALUES ('start', 'missing')",
      "INSERT INTO events(key, act) VALUES ('bad', 'missing')",
      "INSERT INTO places(key, parent) VALUES ('bad', 'missing')",
      "INSERT INTO character_relations(character_key, position, other_key) VALUES ('a', 0, 'missing')",
    ]) {
      await assert.rejects(() => client.execute(statement), /FOREIGN KEY constraint failed/);
    }
    await assert.rejects(
      () => client.execute("INSERT INTO events(key) VALUES ('no-act')"),
      /NOT NULL constraint failed/,
    );
    await client.execute("INSERT INTO event_characters(event_key, character_key) VALUES ('start', 'a')");
    await assert.rejects(
      () => client.execute("INSERT INTO event_characters(event_key, character_key) VALUES ('start', 'a')"),
      /UNIQUE constraint failed/,
    );
    await client.execute("UPDATE characters SET position = 1 WHERE key = 'a'");
    await assert.rejects(
      () => client.execute("UPDATE characters SET position = 1 WHERE key = 'b'"),
      /UNIQUE constraint failed/,
    );
  });
});

test('SQLite enforces listed values and one-way membership for direct SQL writes', async () => {
  await withDatabase(async (connection) => {
    await seed(connection);
    for (const statement of [
      "UPDATE characters SET kind = 'animal' WHERE key = 'a'",
      "INSERT INTO places(key, realm) VALUES ('bad', 'space')",
      "UPDATE events SET confidence = 'certain' WHERE key = 'start'",
      "UPDATE events SET is_core = 2 WHERE key = 'start'",
      "UPDATE learnings SET kind = 'fact' WHERE key = 'idea'",
      "INSERT INTO event_characters(event_key, character_key, presence) VALUES ('start', 'a', 'ghost')",
      "INSERT INTO event_characters(event_key, character_key, exit) VALUES ('start', 'a', 'returns')",
      "INSERT INTO character_relations(character_key, position, other_key, member, mutual) VALUES ('a', 0, 'group', 1, 1)",
      "INSERT INTO event_links(event_key, position, to_key, mutual) VALUES ('start', 0, 'end', 2)",
    ]) {
      await assert.rejects(() => connection.client.execute(statement), /CHECK constraint failed/);
    }
  });
});

test('running migrations again keeps existing rows', async () => {
  await withDatabase(async (connection) => {
    await seed(connection);
    const reopened = await createDatabase(connection.path);
    try {
      assert.equal((await reopened.db.select().from(schema.characters)).length, 3);
      assert.equal((await reopened.db.select().from(schema.events)).length, 2);
      assert.equal((await reopened.client.execute('PRAGMA foreign_keys')).rows[0].foreign_keys, 1);
    } finally {
      reopened.client.close();
    }
  });
});
