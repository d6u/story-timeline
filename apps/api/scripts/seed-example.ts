import { join, resolve } from 'node:path';
import { createDatabase } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';
import { huaPi } from './examples/hua-pi.js';
import { odyssey } from './examples/odyssey.js';
import { flatten, problems, type Example } from './examples/types.js';
import { clearTarget, parseArgs } from './target.js';

/**
 * Builds the two example projects from the seed data in `scripts/examples/`:
 * 《画皮》 (`画皮.sqlite`, in Chinese) and Homer's Odyssey (`odyssey.sqlite`, in English).
 *
 *   pnpm db:example [data-folder] [--force]
 *
 * The folder defaults to `data`. When either file exists, nothing is changed unless `--force` is given.
 */
const usage = 'Use: pnpm db:example [data-folder] [--force]';
const { force, positional } = parseArgs(process.argv.slice(2), usage);
if (positional.length > 1) throw new Error(usage);
const dir = resolve(positional[0] ?? 'data');
const examples: Example[] = [huaPi, odyssey];

// Check the seed data first, then clear every target, so a refusal or a bad seed changes no file.
for (const example of examples) {
  const found = problems(example);
  if (found.length) throw new Error(`${example.file} breaks the data rules:\n${found.join('\n')}`);
}
for (const example of examples) {
  clearTarget(join(dir, example.file), force, `pnpm db:example ${positional.length ? `${positional[0]} ` : ''}--force`);
}

for (const example of examples) {
  const rows = flatten(example);
  const { db, client, path } = await createDatabase(join(dir, example.file));
  try {
    // Parents first, so every foreign key resolves on insert.
    await db.insert(schema.acts).values(rows.acts);
    await db.insert(schema.places).values(rows.places);
    await db.insert(schema.sources).values(rows.sources);
    await db.insert(schema.characters).values(rows.characters);
    await db.insert(schema.events).values(rows.events);
    await db.insert(schema.characterNames).values(rows.characterNames);
    await db.insert(schema.characterRelations).values(rows.characterRelations);
    await db.insert(schema.arcStages).values(rows.arcStages);
    await db.insert(schema.eventCharacters).values(rows.eventCharacters);
    await db.insert(schema.eventLinks).values(rows.eventLinks);
    await db.insert(schema.eventSources).values(rows.eventSources);
    await db.insert(schema.learnings).values(rows.learnings);
    await db.insert(schema.learningCharacters).values(rows.learningCharacters);

    const broken = [...(await client.execute('PRAGMA foreign_key_check')).rows, ...(await client.execute('PRAGMA integrity_check')).rows.filter((r) => r[0] !== 'ok')];
    if (broken.length) throw new Error(`${path}: integrity check failed: ${JSON.stringify(broken)}`);
    const counts = Object.entries(rows).map(([table, list]) => `${table} ${list.length}`).join(', ');
    console.log(`Example project ready: ${path} (${counts})`);
  } finally {
    client.close();
  }
}
