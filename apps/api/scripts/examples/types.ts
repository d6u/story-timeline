import { createHash } from 'node:crypto';
import type * as schema from '../../src/db/schema.js';

type Insert<T extends { $inferInsert: unknown }> = T['$inferInsert'];
type Presence = NonNullable<Insert<typeof schema.eventCharacters>['presence']>;
type Exit = NonNullable<Insert<typeof schema.eventCharacters>['exit']>;

/**
 * One example project in the nested shape of the YAML import: child rows sit inside their parent,
 * and list order gives `position`. `flatten` turns it into the rows of the 13 tables.
 */
export interface Example {
  /** File name in the data folder. The project id is the name without `.sqlite`. */
  file: string;
  acts: { name: string; span?: string; description?: string }[];
  places: { key: string; name: string; realm?: Insert<typeof schema.places>['realm']; parent?: string; description?: string }[];
  sources: { key: string; title: string; lang?: string; location?: string; note?: string }[];
  characters: {
    key: string;
    name: string;
    kind?: 'person' | 'group';
    category?: string;
    description?: string;
    color?: string;
    names?: { name: string; lang?: string; note?: string }[];
    /** `relation` is what this character is to `to`. */
    relations?: { to: string; relation: string; tone?: Insert<typeof schema.characterRelations>['tone']; mutual?: boolean; member?: boolean; since?: string; until?: string }[];
    stages?: { stage: string; time?: string; since?: string; description?: string }[];
  }[];
  events: {
    key: string;
    title: string;
    act: string;
    sortOrder: number;
    time?: string;
    place?: string;
    core?: boolean;
    confidence?: 'likely' | 'unsure';
    description: string;
    /** Participants in display order: key, presence, exit. */
    cast: [string, Presence?, Exit?][];
    links?: { to: string; relation: string; kind?: Insert<typeof schema.eventLinks>['kind']; mutual?: boolean; note?: string }[];
    /** Citations in order. */
    cite: { source: string; ref: string }[];
  }[];
  learnings: {
    key: string;
    text: string;
    kind?: Insert<typeof schema.learnings>['kind'];
    description?: string;
    knownBy: { who: string; since?: string; until?: string; time?: string; note?: string }[];
  }[];
}

/** A stable UUID (version 5 layout) from the project file and the key, so a rebuild writes the same ids. */
function uuid(file: string, key: string): string {
  const h = createHash('sha1').update(`${file}/${key}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** The rows of every table, parents first. */
export function flatten(x: Example) {
  const at = <T>(list: T[], f: (item: T, position: number) => unknown) => list.map((item, i) => f(item, i + 1));
  return {
    acts: at(x.acts, (a, position) => ({ ...a, position })) as Insert<typeof schema.acts>[],
    places: at(x.places, (p, position) => ({ ...p, position })) as Insert<typeof schema.places>[],
    sources: at(x.sources, (s, position) => ({ ...s, position })) as Insert<typeof schema.sources>[],
    characters: at(x.characters, (c, position) => ({
      key: c.key, id: uuid(x.file, `character/${c.key}`), name: c.name, kind: c.kind ?? 'person', category: c.category, description: c.description, color: c.color, position,
    })) as Insert<typeof schema.characters>[],
    events: at(x.events, (e) => ({
      key: e.key, id: uuid(x.file, `event/${e.key}`), title: e.title, description: e.description, isCore: e.core ?? false, sortOrder: e.sortOrder, act: e.act, time: e.time, placeKey: e.place, confidence: e.confidence,
    })) as Insert<typeof schema.events>[],
    characterNames: x.characters.flatMap((c) => at(c.names ?? [], (n, position) => ({ characterKey: c.key, position, ...n }))) as Insert<typeof schema.characterNames>[],
    characterRelations: x.characters.flatMap((c) => at(c.relations ?? [], ({ to, ...r }, position) => ({ characterKey: c.key, position, otherKey: to, ...r }))) as Insert<typeof schema.characterRelations>[],
    arcStages: x.characters.flatMap((c) => at(c.stages ?? [], (s, position) => ({ characterKey: c.key, position, ...s }))) as Insert<typeof schema.arcStages>[],
    eventCharacters: x.events.flatMap((e) => at(e.cast, ([characterKey, presence, exit], position) => ({ eventKey: e.key, characterKey, position, presence, exit }))) as Insert<typeof schema.eventCharacters>[],
    eventLinks: x.events.flatMap((e) => at(e.links ?? [], ({ to, ...l }, position) => ({ eventKey: e.key, position, toKey: to, ...l }))) as Insert<typeof schema.eventLinks>[],
    eventSources: x.events.flatMap((e) => at(e.cite, (c, position) => ({ eventKey: e.key, sourceKey: c.source, ref: c.ref, position }))) as Insert<typeof schema.eventSources>[],
    learnings: at(x.learnings, ({ knownBy: _, ...l }, position) => ({ ...l, position })) as Insert<typeof schema.learnings>[],
    learningCharacters: x.learnings.flatMap((l) => at(l.knownBy, ({ who, ...k }, position) => ({ learningKey: l.key, position, characterKey: who, ...k }))) as Insert<typeof schema.learningCharacters>[],
  };
}

/**
 * The rules the database does not enforce (docs/database.md, "Constraint scope"), checked on the
 * seed: a member relation points to a group, an end event does not come before its start event,
 * a character dies at most once, parent places form a tree, and every event has a participant and
 * a citation.
 */
export function problems(x: Example): string[] {
  const out: string[] = [];
  const order = new Map(x.events.map((e) => [e.key, e.sortOrder]));
  const kinds = new Map(x.characters.map((c) => [c.key, c.kind ?? 'person']));
  const span = (what: string, since?: string, until?: string) => {
    if (since && until && order.get(until)! < order.get(since)!) out.push(`${what}: ends at ${until} before it starts at ${since}`);
  };
  for (const c of x.characters) {
    for (const r of c.relations ?? []) {
      if (r.member && kinds.get(r.to) !== 'group') out.push(`${c.key}: member of ${r.to}, which is not a group`);
      span(`relation ${c.key} -> ${r.to}`, r.since, r.until);
    }
  }
  for (const l of x.learnings) for (const k of l.knownBy) span(`learning ${l.key} (${k.who})`, k.since, k.until);
  const deaths = new Map<string, number>();
  for (const e of x.events) {
    if (e.cast.length === 0) out.push(`event ${e.key}: no participant`);
    if (e.cite.length === 0) out.push(`event ${e.key}: no citation`);
    for (const [who, , exit] of e.cast) if (exit === 'dies') deaths.set(who, (deaths.get(who) ?? 0) + 1);
  }
  for (const [who, n] of deaths) if (n > 1) out.push(`${who}: dies ${n} times`);
  const parent = new Map(x.places.map((p) => [p.key, p.parent]));
  for (const p of x.places) {
    const seen = new Set<string>();
    for (let at: string | undefined = p.key; at; at = parent.get(at)) {
      if (seen.has(at)) {
        out.push(`place ${p.key}: its parents form a cycle`);
        break;
      }
      seen.add(at);
    }
  }
  return out;
}
