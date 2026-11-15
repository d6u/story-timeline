// Source: docs/story-schema-erd.mmd. This schema includes all four modules.
import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';

// Setting module
export const acts = sqliteTable('acts', {
  name: text('name').primaryKey().notNull(),
  position: integer('position').unique(),
  span: text('span'),
  description: text('description'),
});

export const places = sqliteTable(
  'places',
  {
    key: text('key').primaryKey().notNull(),
    position: integer('position').unique(),
    name: text('name'),
    realm: text('realm', { enum: ['physical', 'mind', 'dream', 'spirit'] })
      .notNull()
      .default('physical'),
    parent: text('parent').references((): AnySQLiteColumn => places.key, { onUpdate: 'cascade' }),
    description: text('description'),
  },
  (t) => [
    check('places_realm', sql`${t.realm} IN ('physical', 'mind', 'dream', 'spirit')`),
    check('places_not_own_parent', sql`${t.parent} <> ${t.key}`),
  ],
);

// Core, with fields from the setting and references modules
export const characters = sqliteTable(
  'characters',
  {
    key: text('key').primaryKey().notNull(),
    id: text('id').unique(),
    name: text('name'),
    description: text('description'),
    category: text('category'),
    kind: text('kind', { enum: ['person', 'group'] }).notNull().default('person'),
    position: integer('position').unique(),
    color: text('color'),
  },
  (t) => [check('characters_kind', sql`${t.kind} IN ('person', 'group')`)],
);

export const events = sqliteTable(
  'events',
  {
    key: text('key').primaryKey().notNull(),
    id: text('id').unique(),
    title: text('title'),
    description: text('description'),
    isCore: integer('is_core', { mode: 'boolean' }).notNull().default(false),
    sortOrder: integer('sort_order'),
    act: text('act').notNull().references(() => acts.name, { onUpdate: 'cascade' }),
    time: text('time'),
    placeKey: text('place_key').references(() => places.key, { onUpdate: 'cascade' }),
    confidence: text('confidence', { enum: ['likely', 'unsure'] }),
  },
  (t) => [
    check('events_is_core', sql`${t.isCore} IN (0, 1)`),
    check('events_confidence', sql`${t.confidence} IN ('likely', 'unsure')`),
  ],
);

export const characterRelations = sqliteTable(
  'character_relations',
  {
    characterKey: text('character_key').notNull().references(() => characters.key, { onUpdate: 'cascade' }),
    position: integer('position').notNull(),
    otherKey: text('other_key').notNull().references(() => characters.key, { onUpdate: 'cascade' }),
    relation: text('relation'),
    mutual: integer('mutual', { mode: 'boolean' }).notNull().default(false),
    member: integer('member', { mode: 'boolean' }).notNull().default(false),
    since: text('since').references(() => events.key, { onUpdate: 'cascade' }),
    until: text('until').references(() => events.key, { onUpdate: 'cascade' }),
    tone: text('tone', { enum: ['family', 'love', 'friend', 'work', 'hostile', 'other'] }),
  },
  (t) => [
    primaryKey({ columns: [t.characterKey, t.position] }),
    check('character_relations_mutual', sql`${t.mutual} IN (0, 1)`),
    check('character_relations_member', sql`${t.member} IN (0, 1)`),
    check('member_is_one_way', sql`${t.member} = 0 OR ${t.mutual} = 0`),
    check('character_relations_not_self', sql`${t.characterKey} <> ${t.otherKey}`),
    check('character_relations_tone', sql`${t.tone} IN ('family', 'love', 'friend', 'work', 'hostile', 'other')`),
  ],
);

// Core, with fields from the people module
export const eventCharacters = sqliteTable(
  'event_characters',
  {
    eventKey: text('event_key').notNull().references(() => events.key, { onUpdate: 'cascade' }),
    characterKey: text('character_key').notNull().references(() => characters.key, { onUpdate: 'cascade' }),
    position: integer('position'),
    presence: text('presence', { enum: ['body', 'mind', 'spirit', 'mentioned', 'related'] }),
    exit: text('exit', { enum: ['dies', 'leaves'] }),
  },
  (t) => [
    primaryKey({ columns: [t.eventKey, t.characterKey] }),
    check('event_characters_presence', sql`${t.presence} IN ('body', 'mind', 'spirit', 'mentioned', 'related')`),
    check('event_characters_exit', sql`${t.exit} IN ('dies', 'leaves')`),
  ],
);

export const eventLinks = sqliteTable(
  'event_links',
  {
    eventKey: text('event_key').notNull().references(() => events.key, { onUpdate: 'cascade' }),
    position: integer('position').notNull(),
    toKey: text('to_key').notNull().references(() => events.key, { onUpdate: 'cascade' }),
    relation: text('relation'),
    mutual: integer('mutual', { mode: 'boolean' }).notNull().default(false),
    note: text('note'),
    kind: text('kind', { enum: ['cause', 'setup', 'reveal', 'echo'] }),
  },
  (t) => [
    primaryKey({ columns: [t.eventKey, t.position] }),
    check('event_links_mutual', sql`${t.mutual} IN (0, 1)`),
    check('event_links_kind', sql`${t.kind} IN ('cause', 'setup', 'reveal', 'echo')`),
    check('event_links_not_self', sql`${t.eventKey} <> ${t.toKey}`),
    uniqueIndex('event_links_pair_relation_unique').on(t.eventKey, t.toKey, t.relation),
  ],
);

// People module
export const characterNames = sqliteTable(
  'character_names',
  {
    characterKey: text('character_key').notNull().references(() => characters.key, { onUpdate: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position'),
    lang: text('lang'),
    note: text('note'),
  },
  (t) => [primaryKey({ columns: [t.characterKey, t.name] })],
);

// Inner module
export const learnings = sqliteTable(
  'learnings',
  {
    key: text('key').primaryKey().notNull(),
    position: integer('position').unique(),
    text: text('text'),
    kind: text('kind', { enum: ['knowledge', 'realization', 'idea'] })
      .notNull()
      .default('knowledge'),
    description: text('description'),
  },
  (t) => [check('learnings_kind', sql`${t.kind} IN ('knowledge', 'realization', 'idea')`)],
);

export const learningCharacters = sqliteTable(
  'learning_characters',
  {
    learningKey: text('learning_key').notNull().references(() => learnings.key, { onUpdate: 'cascade' }),
    position: integer('position').notNull(),
    characterKey: text('character_key').notNull().references(() => characters.key, { onUpdate: 'cascade' }),
    since: text('since').references(() => events.key, { onUpdate: 'cascade' }),
    until: text('until').references(() => events.key, { onUpdate: 'cascade' }),
    time: text('time'),
    note: text('note'),
  },
  (t) => [primaryKey({ columns: [t.learningKey, t.position] })],
);

export const arcStages = sqliteTable(
  'arc_stages',
  {
    characterKey: text('character_key').notNull().references(() => characters.key, { onUpdate: 'cascade' }),
    position: integer('position').notNull(),
    stage: text('stage'),
    time: text('time'),
    since: text('since').references(() => events.key, { onUpdate: 'cascade' }),
    description: text('description'),
  },
  (t) => [primaryKey({ columns: [t.characterKey, t.position] })],
);

// References module
export const sources = sqliteTable('sources', {
  key: text('key').primaryKey().notNull(),
  position: integer('position').unique(),
  title: text('title'),
  lang: text('lang'),
  location: text('location'),
  note: text('note'),
});

export const eventSources = sqliteTable(
  'event_sources',
  {
    eventKey: text('event_key').notNull().references(() => events.key, { onUpdate: 'cascade' }),
    sourceKey: text('source_key').notNull().references(() => sources.key, { onUpdate: 'cascade' }),
    ref: text('ref'),
    position: integer('position'),
  },
  (t) => [primaryKey({ columns: [t.eventKey, t.sourceKey] })],
);
