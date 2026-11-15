/**
 * Imports a story-reviewer YAML project into one SQLite project file.
 *
 *   pnpm db:import <project-data-dir> <database-file> [--force]
 *
 * An existing database file is replaced only with `--force`.
 * The YAML layout: one file per root table (acts, places, characters, events, learnings, sources);
 * child tables nest in a field of the parent record; list order gives `position`; a one-value row
 * may be written as a bare scalar. This repository's schema is fixed, so every field, child list,
 * and file that it cannot hold is reported as a gap instead of being imported. The report prints
 * as Markdown at the end.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parse } from 'yaml';
import { createDatabase } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';
import { clearTarget, parseArgs } from './target.js';

type Row = Record<string, unknown>;

const usage = 'Use: pnpm db:import <project-data-dir> <database-file> [--force]';
const { force, positional } = parseArgs(process.argv.slice(2), usage);
const [dirArg, fileArg] = positional;
if (!dirArg || !fileArg || positional.length > 2) throw new Error(usage);
const dir = resolve(dirArg);
const file = resolve(fileArg);

// ---------- gap tracking ----------

const gapFields = new Map<string, { count: number; examples: Set<string> }>();
const gapNotes: string[] = [];
const consumedFiles = new Set<string>();

function gap(where: string, value: unknown) {
  const entry = gapFields.get(where) ?? { count: 0, examples: new Set<string>() };
  entry.count += 1;
  if (entry.examples.size < 2) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    entry.examples.add(text.length > 60 ? `${text.slice(0, 57)}...` : text);
  }
  gapFields.set(where, entry);
}

// ---------- YAML helpers ----------

function readList(name: string): unknown[] {
  const path = join(dir, `${name}.yaml`);
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return [];
  }
  consumedFiles.add(`${name}.yaml`);
  const data = parse(text);
  if (data === null || data === undefined) return [];
  if (!Array.isArray(data)) throw new Error(`${name}.yaml is not a list`);
  return data;
}

/** A row written as a bare scalar means one field. */
function asRow(item: unknown, scalarField: string): Row {
  if (item !== null && typeof item === 'object' && !Array.isArray(item)) return item as Row;
  return { [scalarField]: item };
}

/** Takes the listed fields from the row. Every other field is a gap. */
function pick<const K extends readonly string[]>(row: Row, table: string, keys: K): { [P in K[number]]?: unknown } {
  const out: Row = {};
  for (const key of Object.keys(row)) {
    if ((keys as readonly string[]).includes(key)) {
      if (row[key] !== undefined && row[key] !== null) out[key] = row[key];
    } else {
      gap(`${table}.${key}`, row[key]);
    }
  }
  return out as { [P in K[number]]?: unknown };
}

const str = (v: unknown) => (v === undefined || v === null ? undefined : String(v));
const int = (v: unknown) => (v === undefined || v === null ? undefined : Number(v));
const bool = (v: unknown) => v === true || v === 1 || v === 'true';
const children = (row: Row, field: string): unknown[] => (Array.isArray(row[field]) ? (row[field] as unknown[]) : []);

async function insertAll<T extends Parameters<typeof db.insert>[0]>(table: T, rows: Parameters<ReturnType<typeof db.insert<T>>['values']>[0]) {
  const list = rows as unknown[];
  for (let i = 0; i < list.length; i += 100) {
    await db.insert(table).values(list.slice(i, i + 100) as never);
  }
}

// ---------- import ----------

if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`Not a folder: ${dir}`);
clearTarget(file, force, `pnpm db:import ${dirArg} ${fileArg} --force`);
const { db, client, path } = await createDatabase(file);
const counts: Record<string, number> = {};

try {
  // acts
  const actRows = readList('acts').map((item, i) => {
    const r = pick(asRow(item, 'name'), 'acts', ['name', 'position', 'span', 'description']);
    return { name: String(r.name), position: int(r.position) ?? i + 1, span: str(r.span), description: str(r.description) };
  });
  const actNames = new Set(actRows.map((a) => a.name));

  // places
  const placeRows = readList('places').map((item, i) => {
    const r = pick(asRow(item, 'key'), 'places', ['key', 'position', 'name', 'realm', 'parent', 'description']);
    return { key: String(r.key), position: int(r.position) ?? i + 1, name: str(r.name), realm: (str(r.realm) ?? 'physical') as 'physical', parent: str(r.parent), description: str(r.description) };
  });

  // characters and their children
  const characterRows: (typeof schema.characters.$inferInsert)[] = [];
  const nameRows: (typeof schema.characterNames.$inferInsert)[] = [];
  const relationRows: (typeof schema.characterRelations.$inferInsert)[] = [];
  const stageRows: (typeof schema.arcStages.$inferInsert)[] = [];
  readList('characters').forEach((item, i) => {
    const row = asRow(item, 'key');
    const r = pick(row, 'characters', ['key', 'id', 'name', 'description', 'category', 'kind', 'position', 'color', 'relations', 'names', 'stages']);
    const key = String(r.key);
    characterRows.push({ key, id: str(r.id), name: str(r.name), description: str(r.description), category: str(r.category), kind: (str(r.kind) ?? 'person') as 'person', position: int(r.position) ?? i + 1 });
    children(row, 'relations').forEach((child, j) => {
      const c = pick(asRow(child, 'other_key'), 'characters.relations', ['other_key', 'relation', 'mutual', 'member', 'since', 'until', 'position']);
      relationRows.push({ characterKey: key, position: int(c.position) ?? j + 1, otherKey: String(c.other_key), relation: str(c.relation), mutual: bool(c.mutual), member: bool(c.member), since: str(c.since), until: str(c.until) });
    });
    children(row, 'names').forEach((child, j) => {
      const c = pick(asRow(child, 'name'), 'characters.names', ['name', 'lang', 'note', 'position']);
      nameRows.push({ characterKey: key, position: int(c.position) ?? j + 1, name: String(c.name), lang: str(c.lang), note: str(c.note) });
    });
    children(row, 'stages').forEach((child, j) => {
      const c = pick(asRow(child, 'stage'), 'characters.stages', ['stage', 'time', 'since', 'description', 'position']);
      stageRows.push({ characterKey: key, position: int(c.position) ?? j + 1, stage: str(c.stage), time: str(c.time), since: str(c.since), description: str(c.description) });
    });
  });

  // events and their children
  const eventRows: (typeof schema.events.$inferInsert)[] = [];
  const participantRows: (typeof schema.eventCharacters.$inferInsert)[] = [];
  const linkRows: (typeof schema.eventLinks.$inferInsert)[] = [];
  const eventSourceRows: (typeof schema.eventSources.$inferInsert)[] = [];
  let eventsWithoutAct = 0;
  let derivedTimes = 0;
  const PLACEHOLDER_ACT = '前史';
  readList('events').forEach((item, i) => {
    const row = asRow(item, 'key');
    // `day` is read before pick() so it can become a `time` label; it is still reported as a gap.
    const day = row.day;
    const r = pick(row, 'events', ['key', 'id', 'title', 'description', 'is_core', 'sort_order', 'act', 'time', 'place_key', 'confidence', 'characters', 'links', 'sources']);
    const key = String(r.key);
    let act = str(r.act);
    if (!act) {
      eventsWithoutAct += 1;
      act = PLACEHOLDER_ACT;
    }
    let time = str(r.time);
    if (!time && day !== undefined && day !== null) {
      time = `第 ${day} 天`;
      derivedTimes += 1;
    }
    eventRows.push({ key, id: str(r.id), title: str(r.title), description: str(r.description), isCore: bool(r.is_core), sortOrder: int(r.sort_order) ?? i + 1, act, time, placeKey: str(r.place_key), confidence: str(r.confidence) as 'likely' | undefined });
    const seen = new Set<string>();
    children(row, 'characters').forEach((child, j) => {
      const c = pick(asRow(child, 'character_key'), 'events.characters', ['character_key', 'presence', 'exit', 'position']);
      const characterKey = String(c.character_key);
      if (seen.has(characterKey)) {
        gap('events.characters (duplicate character in one event)', `${key}: ${characterKey}`);
        return;
      }
      seen.add(characterKey);
      participantRows.push({ eventKey: key, characterKey, position: int(c.position) ?? j + 1, presence: str(c.presence) as 'body' | undefined, exit: str(c.exit) as 'dies' | undefined });
    });
    children(row, 'links').forEach((child, j) => {
      const c = pick(asRow(child, 'to_key'), 'events.links', ['to_key', 'relation', 'mutual', 'note', 'position']);
      linkRows.push({ eventKey: key, position: int(c.position) ?? j + 1, toKey: String(c.to_key), relation: str(c.relation), mutual: bool(c.mutual), note: str(c.note) });
    });
    children(row, 'sources').forEach((child, j) => {
      const c = pick(asRow(child, 'source_key'), 'events.sources', ['source_key', 'ref', 'position']);
      eventSourceRows.push({ eventKey: key, sourceKey: String(c.source_key), ref: str(c.ref), position: int(c.position) ?? j + 1 });
    });
  });
  if (eventsWithoutAct && !actNames.has(PLACEHOLDER_ACT)) {
    actRows.push({ name: PLACEHOLDER_ACT, position: 0, span: undefined, description: '导入时补充：原数据里这些事件没有分部。' });
    gapNotes.push(`Added a placeholder act \`${PLACEHOLDER_ACT}\` because \`events.act\` is required here and ${eventsWithoutAct} events had none.`);
  } else if (eventsWithoutAct) {
    gapNotes.push(`${eventsWithoutAct} events had no act and were put into the existing act \`${PLACEHOLDER_ACT}\`.`);
  }
  if (derivedTimes) gapNotes.push(`${derivedTimes} events had \`day\` but no \`time\`; \`time\` was set to \`第 N 天\` from \`day\`.`);

  // learnings
  const learningRows: (typeof schema.learnings.$inferInsert)[] = [];
  const learningCharacterRows: (typeof schema.learningCharacters.$inferInsert)[] = [];
  readList('learnings').forEach((item, i) => {
    const row = asRow(item, 'key');
    const r = pick(row, 'learnings', ['key', 'position', 'text', 'kind', 'description', 'known_by']);
    const key = String(r.key);
    learningRows.push({ key, position: int(r.position) ?? i + 1, text: str(r.text), kind: (str(r.kind) ?? 'knowledge') as 'knowledge', description: str(r.description) });
    children(row, 'known_by').forEach((child, j) => {
      const c = pick(asRow(child, 'character_key'), 'learnings.known_by', ['character_key', 'since', 'until', 'time', 'note', 'position']);
      learningCharacterRows.push({ learningKey: key, position: int(c.position) ?? j + 1, characterKey: String(c.character_key), since: str(c.since), until: str(c.until), time: str(c.time), note: str(c.note) });
    });
  });

  // sources
  const sourceRows = readList('sources').map((item, i) => {
    const r = pick(asRow(item, 'key'), 'sources', ['key', 'position', 'title', 'lang', 'location', 'note']);
    return { key: String(r.key), position: int(r.position) ?? i + 1, title: str(r.title), lang: str(r.lang), location: str(r.location), note: str(r.note) };
  });

  // write, parents first
  await insertAll(schema.acts, actRows);
  await insertAll(schema.places, placeRows);
  await insertAll(schema.characters, characterRows);
  await insertAll(schema.events, eventRows);
  await insertAll(schema.characterNames, nameRows);
  await insertAll(schema.characterRelations, relationRows);
  await insertAll(schema.arcStages, stageRows);
  await insertAll(schema.eventCharacters, participantRows);
  await insertAll(schema.eventLinks, linkRows);
  await insertAll(schema.learnings, learningRows);
  await insertAll(schema.learningCharacters, learningCharacterRows);
  await insertAll(schema.sources, sourceRows);
  await insertAll(schema.eventSources, eventSourceRows);

  Object.assign(counts, {
    acts: actRows.length, places: placeRows.length, characters: characterRows.length, character_names: nameRows.length,
    character_relations: relationRows.length, arc_stages: stageRows.length, events: eventRows.length, event_characters: participantRows.length,
    event_links: linkRows.length, learnings: learningRows.length, learning_characters: learningCharacterRows.length, sources: sourceRows.length, event_sources: eventSourceRows.length,
  });

  const fkProblems = (await client.execute('PRAGMA foreign_key_check')).rows;
  if (fkProblems.length) throw new Error(`Foreign key problems: ${JSON.stringify(fkProblems.slice(0, 5))}`);
} finally {
  client.close();
}

// ---------- report ----------

const skippedFiles = readdirSync(dir).filter((f) => !consumedFiles.has(f)).sort();
const lines: string[] = [];
lines.push(`## Import report: ${basename(dir === resolve(dir, '.') ? resolve(dir, '..') : dir)} -> ${basename(path)}`, '');
lines.push('Rows imported:', '', '| Table | Rows |', '| --- | --- |');
for (const [table, n] of Object.entries(counts)) lines.push(`| ${table} | ${n} |`);
lines.push('', 'Fields and child lists not captured by the schema:', '', '| Source field | Rows | Examples |', '| --- | --- | --- |');
for (const [where, { count, examples }] of [...gapFields].sort((a, b) => b[1].count - a[1].count)) {
  lines.push(`| \`${where}\` | ${count} | ${[...examples].map((e) => `\`${e.replaceAll('|', '\\|')}\``).join(', ')} |`);
}
if (!gapFields.size) lines.push('| (none) | | |');
lines.push('', 'Files not imported:', '', ...skippedFiles.map((f) => `- \`${f}\``));
if (gapNotes.length) lines.push('', 'Adjustments made during import:', '', ...gapNotes.map((n) => `- ${n}`));
console.log(lines.join('\n'));
