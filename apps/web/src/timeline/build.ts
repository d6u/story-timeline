import { storyEvents } from '../cursor/state'
import type { ArcLink, Character, ProjectData, StoryEvent } from '../data/types'
import type { Dictionary } from '../i18n'

export type Mode = 'time' | 'act'

export interface Entry {
  event: StoryEvent
  timeLabel: string
  act: string | null
  characters: Character[]
  /** A world event: no participant. It happens without an actor and changes the setting for later events. */
  world: boolean
}

export interface Group {
  key: string
  label: string
  entries: Entry[]
}

export interface Section {
  key: string
  label: string
  groups: Group[]
  /** The act's time span label and summary, in act mode. */
  span?: string
  description?: string
}

/** An act as the timeline lists it: its events in `count`, which is 0 for an act with no event. */
export interface TimelineAct {
  name: string
  count: number
  span?: string
  description?: string
}

export interface Timeline {
  entries: Entry[]
  characters: Character[]
  lanes: Character[]
  characterById: Map<string, Character>
  /** Acts in `acts.position` order; acts the project does not list follow, in story order. */
  acts: TimelineAct[]
  /** Number of world events. When it is above zero, the swimlanes get a 世界 lane. */
  world: number
  resolve(link: ArcLink): Entry | undefined
}

export interface Filter {
  query: string
  who: string[]
  match: 'any' | 'all'
  coreOnly: boolean
  hideWorld: boolean
}

export const emptyFilter: Filter = { query: '', who: [], match: 'all', coreOnly: false, hideWorld: false }

export function buildTimeline({ characters, events, acts = [] }: ProjectData): Timeline {
  const characterById = new Map(characters.map(c => [c.key, c]))
  const entries = storyEvents(events).map((event): Entry => ({
    event,
    timeLabel: event.metadata?.time ?? '',
    act: event.metadata?.act ?? null,
    characters: event.character_ids.flatMap(id => characterById.get(id) ?? []),
    world: event.character_ids.length === 0,
  }))

  // Main characters in lane order (Character.position). Without main characters, every character in an event gets a lane.
  const main = characters.filter(c => c.metadata?.category === 'main').sort((a, b) => (a.metadata.lane ?? 0) - (b.metadata.lane ?? 0))
  const referenced = new Set(events.flatMap(e => e.character_ids))
  const lanes = main.length ? main : characters.filter(c => referenced.has(c.key))

  // The project's act list gives the order; an act only events name goes after it, by its first event.
  const actCounts = new Map<string, number>(acts.map(a => [a.name, 0]))
  for (const entry of entries) if (entry.act) actCounts.set(entry.act, (actCounts.get(entry.act) ?? 0) + 1)
  const actInfo = new Map(acts.map(a => [a.name, a]))

  const byKey = new Map<string, Entry>()
  const byTitle = new Map<string, Entry>()
  for (const entry of entries) {
    if (entry.event.metadata?.key) byKey.set(entry.event.metadata.key, entry)
    if (!byTitle.has(entry.event.title)) byTitle.set(entry.event.title, entry)
  }

  return {
    entries,
    characters,
    lanes,
    characterById,
    acts: [...actCounts].map(([name, count]): TimelineAct => {
      const a = actInfo.get(name)
      return { name, count, ...(a?.span && { span: a.span }), ...(a?.description && { description: a.description }) }
    }),
    world: entries.filter(e => e.world).length,
    // Links use the event key; the title is a fallback for data without keys.
    resolve: link => (link.event ? (byKey.get(link.event) ?? byTitle.get(link.event)) : undefined),
  }
}

function searchText(entry: Entry): string {
  const { event } = entry
  const m = event.metadata ?? {}
  return [
    event.title, event.description, m.placeInfo?.name, entry.act, entry.timeLabel,
    ...entry.characters.map(c => c.name), ...(m.learns ?? []).map(x => x.text),
  ].join('\n').toLowerCase()
}

/**
 * A query that starts with `#` looks for an event by its key (the app's identity, as in the URL,
 * the GraphQL API, and the briefs) or by the id an import gave it: `#land` finds `landing`. It matches from the
 * start of the key, so a key is found while it is being typed.
 */
function keyMatch(entry: Entry, prefix: string): boolean {
  const { key, id } = entry.event
  return key.toLowerCase().startsWith(prefix) || Boolean(id?.toLowerCase().startsWith(prefix))
}

export function applyFilter(entries: Entry[], filter: Filter): Entry[] {
  const query = filter.query.trim().toLowerCase()
  const key = query.startsWith('#') ? query.slice(1).trim() : undefined
  return entries.filter(entry => {
    if (filter.coreOnly && !entry.event.is_core) return false
    if (entry.world && filter.hideWorld) return false
    // A world event is context for every character, so it passes the character filter.
    if (filter.who.length && !entry.world) {
      const ids = entry.event.character_ids
      const hit = filter.match === 'all' ? filter.who.every(id => ids.includes(id)) : filter.who.some(id => ids.includes(id))
      if (!hit) return false
    }
    if (key !== undefined) return keyMatch(entry, key)
    return !query || searchText(entry).includes(query)
  })
}

/** The labels the sections and groups get, in the interface language; the caller passes them in. */
export type SectionLabels = Pick<Dictionary, 'untimed' | 'storySection' | 'noAct'>

/** Splits entries into consecutive groups that share one time label. */
function timeGroups(entries: Entry[], prefix: string, untimed: string): Group[] {
  const groups: Group[] = []
  for (const entry of entries) {
    const label = entry.timeLabel || untimed
    const last = groups.at(-1)
    if (last && last.label === label) {
      last.entries.push(entry)
      continue
    }
    groups.push({ key: `${prefix}|${groups.length}`, label, entries: [entry] })
  }
  return groups
}

/**
 * Section keys. An act's key is its name after `act:`; the one section of time mode and the
 * events with no act have keys without that prefix, so no act name can take them.
 */
const STORY = 'story'
const NO_ACT = 'no-act'
export const actKey = (name: string) => `act:${name}`

/**
 * time: one section in story order, grouped by time label.
 * act: narrative grouping; acts can overlap in story time, so each act keeps its own time groups.
 */
export function sectionsFor(entries: Entry[], mode: Mode, { acts }: { acts: Pick<TimelineAct, 'name' | 'span' | 'description'>[] }, labels: SectionLabels): Section[] {
  const buckets = new Map<string, { label: string; items: Entry[]; act?: Pick<TimelineAct, 'span' | 'description'> }>()
  // Keep the full timeline's act order, even when a filter hides an act's first events.
  if (mode === 'act') for (const act of acts) buckets.set(actKey(act.name), { label: act.name, items: [], act })
  for (const entry of entries) {
    const [key, label] = mode === 'time' ? [STORY, labels.storySection] : entry.act !== null ? [actKey(entry.act), entry.act] : [NO_ACT, labels.noAct]
    const bucket = buckets.get(key) ?? { label, items: [] }
    bucket.items.push(entry)
    buckets.set(key, bucket)
  }
  // An act with no event shown has no section, so nothing to jump to either.
  return [...buckets].filter(([, b]) => b.items.length).map(([key, b]): Section => ({
    key, label: b.label, groups: timeGroups(b.items, key, labels.untimed),
    ...(b.act?.span && { span: b.act.span }), ...(b.act?.description && { description: b.act.description }),
  }))
}
