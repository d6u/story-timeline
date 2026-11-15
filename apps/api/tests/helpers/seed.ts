import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { createDatabase } from '../../src/db/client.js';
import * as schema from '../../src/db/schema.js';

export type Connection = Awaited<ReturnType<typeof createDatabase>>;

/** Runs `check` against a fresh migrated SQLite file in a temporary folder. */
export async function withDatabase(check: (connection: Connection) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), 'story-db-'));
  let connection: Connection | undefined;
  try {
    connection = await createDatabase(join(directory, 'story.sqlite'));
    await check(connection);
  } finally {
    connection?.client.close();
    await rm(directory, { recursive: true, force: true });
  }
}

/** Runs `check` against a temporary data folder that holds `demo.sqlite` (seeded) and `empty.sqlite` (migrated, no rows). */
export async function withDataDir(check: (dataDir: string) => Promise<void>) {
  const dataDir = await mkdtemp(join(tmpdir(), 'story-data-'));
  try {
    const demo = await createDatabase(join(dataDir, 'demo.sqlite'));
    try {
      await seedStory(demo);
    } finally {
      demo.client.close();
    }
    const empty = await createDatabase(join(dataDir, 'empty.sqlite'));
    empty.client.close();
    await check(dataDir);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
}

/** The minimal story used by the database tests: one act, three characters, two events, one learning, one source. */
export async function seed({ db }: Connection) {
  await db.insert(schema.acts).values({ name: 'act-1' });
  await db.insert(schema.characters).values([
    { key: 'a', name: 'A' },
    { key: 'b', name: 'B' },
    { key: 'group', kind: 'group' },
  ]);
  await db.insert(schema.events).values([
    { key: 'start', act: 'act-1', sortOrder: 1 },
    { key: 'end', act: 'act-1', sortOrder: 2 },
  ]);
  await db.insert(schema.learnings).values({ key: 'idea' });
  await db.insert(schema.sources).values({ key: 'book' });
}

/** `seed` plus one row in every child table, so a GraphQL query touches all 13 tables. */
export async function seedStory(connection: Connection) {
  await seed(connection);
  const { db } = connection;
  await db.update(schema.characters).set({ id: 'uuid-a', category: 'main', position: 1, description: 'The hero' }).where(eq(schema.characters.key, 'a'));
  await db.insert(schema.places).values([
    { key: 'ship', name: 'Ship', position: 1 },
    { key: 'cabin', name: 'Cabin', parent: 'ship', realm: 'physical', position: 2 },
  ]);
  await db.update(schema.events).set({ title: 'Start', placeKey: 'cabin', time: 'day 1', confidence: 'likely', isCore: true }).where(eq(schema.events.key, 'start'));
  await db.insert(schema.characterNames).values({ characterKey: 'a', name: 'Alpha', position: 1, lang: 'en' });
  await db.insert(schema.characterRelations).values([
    { characterKey: 'a', position: 1, otherKey: 'b', relation: 'friend', mutual: true, since: 'start', tone: 'friend' },
    { characterKey: 'a', position: 2, otherKey: 'group', relation: 'member', member: true },
  ]);
  await db.insert(schema.arcStages).values({ characterKey: 'a', position: 1, stage: 'call', since: 'start' });
  await db.insert(schema.eventCharacters).values([
    { eventKey: 'start', characterKey: 'a', position: 1, presence: 'body' },
    { eventKey: 'end', characterKey: 'a', position: 1, presence: 'body', exit: 'dies' },
  ]);
  await db.insert(schema.eventLinks).values({ eventKey: 'start', position: 1, toKey: 'end', relation: 'causes', kind: 'cause' });
  await db.insert(schema.eventSources).values({ eventKey: 'start', sourceKey: 'book', ref: '1:3-24', position: 1 });
  await db.insert(schema.learningCharacters).values({ learningKey: 'idea', position: 1, characterKey: 'a', since: 'start', until: 'end' });
}
