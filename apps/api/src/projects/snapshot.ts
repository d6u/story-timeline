import { asc, sql, type SQL } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { Connection } from './registry.js';
import * as schema from '../db/schema.js';

type Row<T extends { $inferSelect: unknown }> = T['$inferSelect'];

export type ActRow = Row<typeof schema.acts>;
export type PlaceRow = Row<typeof schema.places>;
export type CharacterRow = Row<typeof schema.characters>;
export type EventRow = Row<typeof schema.events>;
export type LearningRow = Row<typeof schema.learnings>;
export type SourceRow = Row<typeof schema.sources>;
export type CharacterNameRow = Row<typeof schema.characterNames>;
export type CharacterRelationRow = Row<typeof schema.characterRelations>;
export type ArcStageRow = Row<typeof schema.arcStages>;
export type EventCharacterRow = Row<typeof schema.eventCharacters>;
export type EventLinkRow = Row<typeof schema.eventLinks>;
export type EventSourceRow = Row<typeof schema.eventSources>;
export type LearningCharacterRow = Row<typeof schema.learningCharacters>;

/** A top-level row with a link back to the snapshot it came from. */
export type Scoped<T> = T & { readonly snapshot: Snapshot };

/** Every table of one project, read once, with lookup maps for the GraphQL resolvers. */
export interface Snapshot {
  projectId: string;
  acts: Scoped<ActRow>[];
  places: Scoped<PlaceRow>[];
  characters: Scoped<CharacterRow>[];
  events: Scoped<EventRow>[];
  learnings: Scoped<LearningRow>[];
  sources: Scoped<SourceRow>[];
  namesByCharacter: Map<string, CharacterNameRow[]>;
  relationsByCharacter: Map<string, CharacterRelationRow[]>;
  arcStagesByCharacter: Map<string, ArcStageRow[]>;
  learningCharactersByCharacter: Map<string, LearningCharacterRow[]>;
  learningCharactersByLearning: Map<string, LearningCharacterRow[]>;
  learningCharactersByEvent: Map<string, LearningCharacterRow[]>;
  participantsByEvent: Map<string, EventCharacterRow[]>;
  linksByEvent: Map<string, EventLinkRow[]>;
  sourcesByEvent: Map<string, EventSourceRow[]>;
}

/** Sorts by a nullable order column with nulls last, then by the given tiebreak columns. */
function order(column: AnySQLiteColumn, ...tiebreak: AnySQLiteColumn[]): SQL[] {
  return [sql`${column} IS NULL`, asc(column), ...tiebreak.map((c) => asc(c))];
}

function group<T>(rows: T[], keys: (row: T) => (string | null)[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    for (const key of new Set(keys(row))) {
      if (key === null) continue;
      const list = out.get(key);
      if (list) list.push(row);
      else out.set(key, [row]);
    }
  }
  return out;
}

export async function loadSnapshot(projectId: string, { db }: Connection): Promise<Snapshot> {
  const [
    acts, places, characters, events, learnings, sources,
    names, relations, arcStages, learningCharacters, participants, links, eventSources,
  ] = await Promise.all([
    db.select().from(schema.acts).orderBy(...order(schema.acts.position, schema.acts.name)),
    db.select().from(schema.places).orderBy(...order(schema.places.position, schema.places.key)),
    db.select().from(schema.characters).orderBy(...order(schema.characters.position, schema.characters.key)),
    db.select().from(schema.events).orderBy(...order(schema.events.sortOrder, schema.events.key)),
    db.select().from(schema.learnings).orderBy(...order(schema.learnings.position, schema.learnings.key)),
    db.select().from(schema.sources).orderBy(...order(schema.sources.position, schema.sources.key)),
    db.select().from(schema.characterNames).orderBy(...order(schema.characterNames.position, schema.characterNames.name)),
    db.select().from(schema.characterRelations).orderBy(asc(schema.characterRelations.position)),
    db.select().from(schema.arcStages).orderBy(asc(schema.arcStages.position)),
    db.select().from(schema.learningCharacters).orderBy(asc(schema.learningCharacters.position)),
    db.select().from(schema.eventCharacters).orderBy(...order(schema.eventCharacters.position, schema.eventCharacters.characterKey)),
    db.select().from(schema.eventLinks).orderBy(asc(schema.eventLinks.position)),
    db.select().from(schema.eventSources).orderBy(...order(schema.eventSources.position, schema.eventSources.sourceKey)),
  ]);

  const snapshot = { projectId } as Snapshot;
  const scope = <T>(rows: T[]): Scoped<T>[] => rows.map((row) => Object.assign(row as T & object, { snapshot }) as Scoped<T>);

  snapshot.acts = scope(acts);
  snapshot.places = scope(places);
  snapshot.characters = scope(characters);
  snapshot.events = scope(events);
  snapshot.learnings = scope(learnings);
  snapshot.sources = scope(sources);
  snapshot.namesByCharacter = group(names, (r) => [r.characterKey]);
  snapshot.relationsByCharacter = group(relations, (r) => [r.characterKey]);
  snapshot.arcStagesByCharacter = group(arcStages, (r) => [r.characterKey]);
  snapshot.learningCharactersByCharacter = group(learningCharacters, (r) => [r.characterKey]);
  snapshot.learningCharactersByLearning = group(learningCharacters, (r) => [r.learningKey]);
  snapshot.learningCharactersByEvent = group(learningCharacters, (r) => [r.since, r.until]);
  snapshot.participantsByEvent = group(participants, (r) => [r.eventKey]);
  snapshot.linksByEvent = group(links, (r) => [r.eventKey]);
  snapshot.sourcesByEvent = group(eventSources, (r) => [r.eventKey]);
  return snapshot;
}
