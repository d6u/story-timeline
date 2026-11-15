import { buildCausality, DIRECTED, linkKind, longestChain } from '../causality/build'
import { phaseAt, storyEvents, storyOrder } from '../cursor/state'
import { relationTone } from '../data/relations'
import type { Character, ProjectData, StoryEvent } from '../data/types'

/**
 * Findings about a story, computed from its data. A `finding` is a fact a reader may not have
 * noticed; a `gap` is a place where the data is thin, for the author or an agent to fill. The
 * module states numbers and references only; the view writes the sentences.
 */
export type InsightCategory = 'finding' | 'gap'

/** One thing a gap lists: events, characters, and the label that names it. */
export interface GapItem {
  events: string[]
  characters: string[]
  label?: string
  /** What is wrong with the rows, for a data problem whose kind covers more than one case; the view words it. */
  note?: ProblemNote
}

/** The cases a data problem kind tells apart. */
export type ProblemNote = 'repeat' | 'reversed' | 'relation' | 'knowledge' | 'arcStage'

/** One relation row of a pair, as `turn` lists them, oldest first. */
export interface TurnSpan {
  label: string
  since?: string
  until?: string
}

export type GapKind = 'noParticipants' | 'isolated' | 'noArc' | 'arcNoSince' | 'relationNoSince' | 'otherLinks' | 'noEvents' | 'knowledgeNoSince'
export const GAP_KINDS: GapKind[] = ['noParticipants', 'isolated', 'noEvents', 'noArc', 'arcNoSince', 'otherLinks', 'relationNoSince', 'knowledgeNoSince']

/**
 * Data problems: rows that break a rule the database does not enforce (docs/database.md,
 * "Constraint scope"). They describe the data file, not the story, so they are built from the
 * whole project whatever the story cursor, and every insight of these kinds has `file: true`.
 */
export type ProblemKind = 'memberNotGroup' | 'endBeforeStart' | 'doubleDeath' | 'placeCycle' | 'duplicateLink' | 'duplicateRelation' | 'unresolved'
export const PROBLEM_KINDS: ProblemKind[] = ['unresolved', 'memberNotGroup', 'endBeforeStart', 'doubleDeath', 'placeCycle', 'duplicateRelation', 'duplicateLink']

/** What every insight carries. Events are event keys; characters are character keys. */
interface Base {
  /** Stays the same while the data that makes the insight does. */
  id: string
  category: InsightCategory
  /** Higher ranks first within a kind. */
  score: number
  events: string[]
  characters: string[]
}

export type Insight = Base & (
  /** An event that leads to `reach` others; a root has no directed link into it. */
  | { kind: 'root' | 'turningPoint'; reach: number }
  /** The longest directed chain: `events` is the path, first to last. */
  | { kind: 'chain' }
  /** A setup and its payoff, `distance` events apart in story order. */
  | { kind: 'setup'; distance: number }
  /**
   * `characters[0]` does not know `text` until `events.at(-1)`; in each other event the
   * characters after it, who know, share the scene with it.
   */
  | { kind: 'irony'; learning: string; text: string; shared: number }
  /** A stated relation between two people who are never in the same event. */
  | { kind: 'neverMeet'; label: string }
  /** Two people who share `shared` events and have no stated relation. */
  | { kind: 'unstated'; shared: number }
  /** A pair whose relation changes or ends: every row, oldest first. */
  | { kind: 'turn'; spans: TurnSpan[]; changed: boolean }
  /** The person in the most events of an act. */
  | { kind: 'dominant'; act: string; count: number; actSize: number }
  /** A person gone for `gap` events between `events[0]` and `events[1]`. */
  | { kind: 'absence'; gap: number }
  /** Deaths and leavings per act, in story order. */
  | { kind: 'exitsByAct'; acts: { act: string; dies: number; leaves: number }[] }
  /** An event where `exits` characters die or leave. */
  | { kind: 'exitPeak'; exits: number }
  | { kind: GapKind; items: GapItem[] }
  /** A data problem of the whole file; see `PROBLEM_KINDS`. */
  | { kind: ProblemKind; items: GapItem[]; file: true }
)

export type InsightKind = Insight['kind']

/** Fewest events a root or turning point must lead to. */
const MIN_REACH = 3
/** Fewest events on a chain worth naming. */
const MIN_CHAIN = 3
/** Fewest shared scenes for dramatic irony and for an unstated pair. */
const MIN_IRONY = 2
const MIN_UNSTATED = 3
/** An act needs this many events before one person can dominate it, and the leader half of them. */
const MIN_ACT = 4
const MIN_SHARE = 0.5
/** An absence counts when it is at least this share of the story, and at least `MIN_GAP` events. */
const GAP_SHARE = 0.2
const MIN_GAP = 5
/** How many of each kind a list shows at first, best first; a kind not named shows all. */
export const TOP_COUNT: Partial<Record<InsightKind, number>> = { root: 5, turningPoint: 5, setup: 8, irony: 8, turn: 10, neverMeet: 8, unstated: 6, absence: 5, exitPeak: 3 }

/** A presence that puts a character in the scene; a mention or a relative does not. */
const onStage = (presence?: string) => presence !== 'mentioned' && presence !== 'related'

/** Acts in the order the story reaches them. */
export function storyActs(events: StoryEvent[]): string[] {
  return [...new Set(storyEvents(events).map(e => e.metadata.act ?? ''))]
}

/** For each character on stage somewhere, the number of its on-stage events per act, in `storyActs` order. */
export function actPresence(data: ProjectData): Map<string, number[]> {
  const acts = storyActs(data.events)
  const index = new Map(acts.map((a, i) => [a, i]))
  const counts = new Map<string, number[]>()
  for (const e of data.events) {
    for (const p of e.metadata.participants ?? []) {
      if (!onStage(p.presence)) continue
      const row = counts.get(p.character_id) ?? acts.map(() => 0)
      row[index.get(e.metadata.act ?? '')!]++
      counts.set(p.character_id, row)
    }
  }
  return counts
}

/**
 * The insight is about `id`: it names `id`, or a gap item does. An insight that names no
 * character, such as a chain of events, is about everyone in its events.
 */
export function involves(insight: Insight, id: string, byKey: Map<string, StoryEvent>): boolean {
  if ('items' in insight) return insight.items.some(item => item.characters.includes(id))
  if (insight.characters.length) return insight.characters.includes(id)
  return insight.events.some(key => byKey.get(key)?.character_ids.includes(id))
}

/** Keeps only the items of a gap that name `id`; any other insight is kept whole. */
export function narrowTo(insight: Insight, id: string): Insight {
  return 'items' in insight ? { ...insight, items: insight.items.filter(item => item.characters.includes(id)) } : insight
}

/** What the view shows: one category, and only what involves `who` when it is set. */
export interface InsightFilter {
  category: InsightCategory
  who?: string
}

/** The insights that pass the filter. A gap keeps only the items that name `who`, and drops out with none. */
export function filterInsights(insights: Insight[], filter: InsightFilter, byKey: Map<string, StoryEvent>): Insight[] {
  return insights
    .filter(i => i.category === filter.category && (!filter.who || involves(i, filter.who, byKey)))
    .map(i => (filter.who ? narrowTo(i, filter.who) : i))
}

/** The characters the insights can be narrowed to, main characters first, then by how many insights involve them. */
export function insightPeople(data: ProjectData, insights: Insight[]): { character: Character; count: number }[] {
  const byKey = new Map(data.events.map(e => [e.key, e]))
  const rank = (c: Character) => (c.metadata.category === 'main' ? 0 : 1)
  return data.characters
    .map(character => ({ character, count: insights.filter(i => involves(i, character.key, byKey)).length }))
    .filter(p => p.count > 0)
    .sort((a, b) => rank(a.character) - rank(b.character) || b.count - a.count || a.character.name.localeCompare(b.character.name, 'zh'))
}

/** Every finding and every data gap of the project, each kind best first. A consumer cuts the lists, for example to `TOP_COUNT`. */
export function buildInsights(data: ProjectData): Insight[] {
  const ctx = context(data)
  return [
    ...causal(ctx),
    ...irony(ctx),
    ...turns(ctx),
    ...pairs(ctx),
    ...presence(ctx),
    ...exits(ctx),
    ...gaps(ctx),
  ]
}

/** What the rules share: story order, people, and who is on stage where. */
interface Context {
  data: ProjectData
  story: StoryEvent[]
  order: Map<string, number>
  byId: Map<string, Character>
  people: Character[]
  /** Character id → the story indexes of its on-stage events, in order. */
  stage: Map<string, number[]>
  /** Sorted pair key → the keys of the events both are on stage in. */
  together: Map<string, string[]>
}

const pairKey = (a: string, b: string) => (a < b ? `${a}\0${b}` : `${b}\0${a}`)
const best = <T extends { score: number }>(list: T[], tie: (a: T, b: T) => number = () => 0) => list.sort((a, b) => b.score - a.score || tie(a, b))

function context(data: ProjectData): Context {
  const story = storyEvents(data.events)
  const byId = new Map(data.characters.map(c => [c.key, c]))
  const people = data.characters.filter(c => c.metadata.kind !== 'group')
  const isPerson = new Set(people.map(c => c.key))
  const stage = new Map<string, number[]>()
  const together = new Map<string, string[]>()
  story.forEach((e, i) => {
    const here = [...new Set((e.metadata.participants ?? []).filter(p => onStage(p.presence) && isPerson.has(p.character_id)).map(p => p.character_id))]
    for (const id of here) stage.set(id, [...(stage.get(id) ?? []), i])
    for (let a = 0; a < here.length; a++) for (let b = a + 1; b < here.length; b++) {
      const k = pairKey(here[a], here[b])
      together.set(k, [...(together.get(k) ?? []), e.key])
    }
  })
  return { data, story, order: storyOrder(data.events), byId, people, stage, together }
}

/** Roots, turning points, the longest chain and the setups, over all link kinds. */
function causal({ data, order }: Context): Insight[] {
  const c = buildCausality(data)
  if (!c.edges.length) return []
  const into = new Map<string, number>()
  for (const e of c.edges) if (DIRECTED.has(e.kind)) into.set(e.to, (into.get(e.to) ?? 0) + 1)
  const byOrder = (a: Insight, b: Insight) => order.get(a.events[0])! - order.get(b.events[0])!
  const out: Insight[] = []

  const reaching = c.nodes.filter(n => n.reach >= MIN_REACH)
  for (const kind of ['root', 'turningPoint'] as const) {
    const list = reaching.filter(n => (kind === 'root') === !into.has(n.id))
    out.push(...best(list.map((n): Insight => ({ id: `${kind}:${n.key}`, category: 'finding', kind, score: n.reach, reach: n.reach, events: [n.key], characters: [] })), byOrder))
  }

  const chain = longestChain(c)
  if (chain.length >= MIN_CHAIN) out.push({ id: `chain:${chain[0]}`, category: 'finding', kind: 'chain', score: chain.length, events: chain, characters: [] })

  out.push(...best(c.edges.filter(e => e.kind === 'setup').map((e): Insight => {
    const { from, to } = e
    const distance = Math.abs(order.get(to)! - order.get(from)!)
    return { id: `setup:${from}:${to}`, category: 'finding', kind: 'setup', score: distance, distance, events: [from, to], characters: [] }
  }), byOrder))
  return out
}

/**
 * Dramatic irony: a fact (knowledge or a realization, not an idea) that a character learns at
 * a stated event, while others who already know it share scenes with that character. A
 * character without a row for the fact is left out: the data does not say it is unaware.
 * One insight per fact and unaware character, with the shared scenes before it learns.
 */
function irony({ people, order, story, stage }: Context): Insight[] {
  const holders = new Map<string, { id: string; since?: string; until?: string; text: string }[]>()
  for (const c of people) {
    for (const k of c.metadata.knowledge ?? []) {
      if (k.kind === 'idea') continue
      holders.set(k.key, [...(holders.get(k.key) ?? []), { id: c.key, since: k.since, until: k.until, text: k.text }])
    }
  }
  const out: Insight[] = []
  for (const [learning, rows] of holders) {
    for (const late of rows) {
      const learnedAt = late.since === undefined ? undefined : order.get(late.since)
      if (learnedAt === undefined) continue
      const scenes: string[] = []
      const knowers = new Set<string>()
      for (const i of stage.get(late.id) ?? []) {
        if (i >= learnedAt) break
        const who = rows.filter(r => r !== late && phaseAt(r, order, i) === 'active' && stage.get(r.id)?.includes(i))
        if (!who.length) continue
        scenes.push(story[i].key)
        for (const r of who) knowers.add(r.id)
      }
      if (scenes.length < MIN_IRONY) continue
      out.push({
        id: `irony:${learning}:${late.id}`, category: 'finding', kind: 'irony', score: scenes.length, learning, text: late.text, shared: scenes.length,
        events: [...scenes, late.since!], characters: [late.id, ...knowers],
      })
    }
  }
  return best(out)
}

/** The non-member relation rows of each pair of characters, as stated by their owners. */
function relationRows(data: ProjectData): Map<string, { from: string; to: string; label: string; since?: string; until?: string }[]> {
  const rows = new Map<string, { from: string; to: string; label: string; since?: string; until?: string }[]>()
  for (const c of data.characters) {
    for (const r of c.metadata.relations ?? []) {
      if (r.member || r.incoming || r.character_id === c.key) continue
      const k = pairKey(c.key, r.character_id)
      rows.set(k, [...(rows.get(k) ?? []), { from: c.key, to: r.character_id, label: r.label, since: r.since, until: r.until }])
    }
  }
  return rows
}

/**
 * Pairs whose relation changes (two labels over time) or ends (an `until`). Changes rank
 * before ends, then the earliest turn first. Groups count: a faction can turn on another.
 */
function turns({ data, order }: Context): Insight[] {
  const at = (key: string | undefined, none: number) => (key === undefined ? none : (order.get(key) ?? Infinity))
  const out: Insight[] = []
  for (const rows of relationRows(data).values()) {
    const spans = [...rows].sort((a, b) => at(a.since, -1) - at(b.since, -1) || at(a.until, Infinity) - at(b.until, Infinity))
    const changed = new Set(spans.map(s => s.label)).size > 1
    if (!changed && !spans.some(s => s.until)) continue
    // The events where something starts after the first row, or ends.
    const marks = [...new Set(spans.flatMap((s, i) => [i > 0 ? s.since : undefined, s.until]).filter((k): k is string => k !== undefined && order.has(k)))]
      .sort((a, b) => order.get(a)! - order.get(b)!)
    if (!marks.length) continue
    const [a, b] = [spans[0].from, spans[0].to]
    out.push({
      id: `turn:${pairKey(a, b).replace('\0', ':')}`, category: 'finding', kind: 'turn', score: (changed ? 1000 : 0) - order.get(marks[0])!,
      spans: spans.map(s => ({ label: s.label, since: s.since, until: s.until })), changed, events: marks, characters: [a, b],
    })
  }
  return best(out)
}

/**
 * People who never meet though a relation joins them, and main characters who meet often with
 * no relation stated. Only main characters are expected to have their relations stated.
 */
function pairs({ data, byId, stage, together }: Context): Insight[] {
  const rows = relationRows(data)
  const isPerson = (id: string) => byId.get(id)?.metadata.kind !== 'group' && byId.has(id)
  const seen = (id: string) => stage.get(id)?.length ?? 0
  const main = (id: string) => byId.get(id)?.metadata.category === 'main'
  const never: Insight[] = []
  for (const [k, list] of rows) {
    const { from: a, to: b } = list[0]
    if (!isPerson(a) || !isPerson(b) || !seen(a) || !seen(b) || together.has(k)) continue
    const label = [...new Set(list.map(r => r.label))].join(' · ')
    never.push({ id: `neverMeet:${k.replace('\0', ':')}`, category: 'finding', kind: 'neverMeet', score: Math.min(seen(a), seen(b)), label, events: [], characters: [a, b] })
  }
  const unstated: Insight[] = []
  for (const [k, events] of together) {
    const [a, b] = k.split('\0')
    if (events.length < MIN_UNSTATED || rows.has(k) || !main(a) || !main(b)) continue
    unstated.push({ id: `unstated:${k.replace('\0', ':')}`, category: 'finding', kind: 'unstated', score: events.length, shared: events.length, events, characters: [a, b] })
  }
  const byName = (x: Insight, y: Insight) => x.id.localeCompare(y.id)
  return [...best(never, byName), ...best(unstated, byName)]
}

/** Who leads each act, and who is gone longest before coming back. */
function presence({ data, people, story, stage }: Context): Insight[] {
  const acts = storyActs(data.events)
  const perAct = actPresence(data)
  const size = acts.map(a => story.filter(e => (e.metadata.act ?? '') === a).length)
  const out: Insight[] = []
  acts.forEach((act, i) => {
    if (size[i] < MIN_ACT) return
    const ranked = people.map(c => ({ id: c.key, n: perAct.get(c.key)?.[i] ?? 0 })).sort((a, b) => b.n - a.n)
    const [lead, next] = ranked
    if (!lead || lead.n / size[i] < MIN_SHARE || lead.n === next?.n) return
    out.push({ id: `dominant:${act}`, category: 'finding', kind: 'dominant', score: lead.n / size[i], act, count: lead.n, actSize: size[i], events: [], characters: [lead.id] })
  })

  const least = Math.max(MIN_GAP, Math.ceil(story.length * GAP_SHARE))
  const away: Insight[] = []
  for (const c of people) {
    const seen = stage.get(c.key) ?? []
    let gap = 0
    let from = 0
    for (let j = 1; j < seen.length; j++) if (seen[j] - seen[j - 1] - 1 > gap) { gap = seen[j] - seen[j - 1] - 1; from = j - 1 }
    if (gap < least) continue
    away.push({ id: `absence:${c.key}`, category: 'finding', kind: 'absence', score: gap, gap, events: [story[seen[from]].key, story[seen[from + 1]].key], characters: [c.key] })
  }
  return [...out, ...best(away, (a, b) => a.id.localeCompare(b.id))]
}

/** Deaths and leavings per act, and the events where the most characters exit at once. */
function exits({ data, story }: Context): Insight[] {
  const acts = storyActs(data.events).map(act => ({ act, dies: 0, leaves: 0 }))
  const index = new Map(acts.map((a, i) => [a.act, i]))
  const peaks: Insight[] = []
  for (const e of story) {
    const gone = (e.metadata.participants ?? []).filter(p => p.exit === 'dies' || p.exit === 'leaves')
    for (const p of gone) acts[index.get(e.metadata.act ?? '')!][p.exit === 'dies' ? 'dies' : 'leaves']++
    if (gone.length >= 2) peaks.push({ id: `exitPeak:${e.key}`, category: 'finding', kind: 'exitPeak', score: gone.length, exits: gone.length, events: [e.key], characters: gone.map(p => p.character_id) })
  }
  const total = acts.reduce((n, a) => n + a.dies + a.leaves, 0)
  if (!total) return []
  return [
    { id: 'exitsByAct', category: 'finding', kind: 'exitsByAct', score: total, acts, events: [], characters: [] },
    ...best(peaks, (a, b) => a.id.localeCompare(b.id)),
  ]
}

/** The places where the data is thin. A kind with no item is left out. */
function gaps({ data, story, people }: Context): Insight[] {
  const ev = (e: StoryEvent): GapItem => ({ events: [e.key], characters: e.character_ids })
  const hasLinks = data.events.some(e => e.metadata.links?.length)
  const lists: Record<GapKind, GapItem[]> = {
    noParticipants: story.filter(e => !e.metadata.participants?.length).map(ev),
    // Only a project that links events at all can miss a link.
    isolated: hasLinks ? story.filter(e => !e.metadata.links?.length).map(ev) : [],
    noEvents: people.filter(c => !data.events.some(e => e.character_ids.includes(c.key))).map(c => ({ events: [], characters: [c.key] })),
    noArc: people.filter(c => c.metadata.category === 'main' && !c.metadata.reading?.beats?.length).map(c => ({ events: [], characters: [c.key] })),
    arcNoSince: people.flatMap(c => (c.metadata.reading?.beats ?? []).filter(b => !b.since).map(b => ({ events: [], characters: [c.key], label: b.stage ?? b.description }))),
    otherLinks: story.flatMap(e => (e.metadata.links ?? [])
      .filter(l => !l.incoming && linkKind(l.relation, l.mutual, l.kind) === 'other')
      .map(l => ({ events: [e.key, l.event], characters: [], label: l.relation }))),
    // A family tie holds from birth, so it needs no start.
    relationNoSince: data.characters.flatMap(c => (c.metadata.relations ?? [])
      .filter(r => !r.member && !r.incoming && !r.since && relationTone(r.label, r.tone) !== 'family')
      .map(r => ({ events: [], characters: [c.key, r.character_id], label: r.label }))),
    knowledgeNoSince: people.flatMap(c => (c.metadata.knowledge ?? []).filter(k => !k.since).map(k => ({ events: [], characters: [c.key], label: k.text }))),
  }
  return GAP_KINDS.filter(kind => lists[kind].length).map((kind): Insight => ({
    id: `gap:${kind}`, category: 'gap', kind, score: lists[kind].length, items: lists[kind], events: [], characters: [],
  }))
}

/**
 * The data problems of the whole project, one insight per kind with at least one item. Pass the
 * whole project, not the story as of a cursor: a problem is in the file whatever the cursor.
 */
export function buildProblems(data: ProjectData): Insight[] {
  const order = storyOrder(data.events)
  const byId = new Map(data.characters.map(c => [c.key, c]))
  const events = new Set(data.events.map(e => e.key))
  const lists: Record<ProblemKind, GapItem[]> = {
    unresolved: unresolved(data, byId, events),
    memberNotGroup: data.characters.flatMap(c => (c.metadata.relations ?? [])
      .filter(r => r.member && !r.incoming && byId.has(r.character_id) && byId.get(r.character_id)!.metadata.kind !== 'group')
      .map(r => ({ events: [], characters: [c.key, r.character_id], label: r.label }))),
    endBeforeStart: endBeforeStart(data, order),
    doubleDeath: data.characters.flatMap(c => {
      const deaths = storyEvents(data.events).filter(e => e.metadata.participants?.some(p => p.character_id === c.key && p.exit === 'dies'))
      return deaths.length > 1 ? [{ events: deaths.map(e => e.key), characters: [c.key] }] : []
    }),
    placeCycle: placeCycles(data),
    duplicateRelation: duplicateRelations(data),
    duplicateLink: duplicateLinks(data),
  }
  return PROBLEM_KINDS.filter(kind => lists[kind].length).map((kind): Insight => ({
    id: `problem:${kind}`, category: 'gap', kind, file: true, score: lists[kind].length, items: lists[kind], events: [], characters: [],
  }))
}

/**
 * References the view model still holds that name no row: a character, an event, a place or an
 * act. The label is the field and the key, as the API names them. SQLite checks these foreign
 * keys, so a file that loads has none; the check guards data that came another way.
 */
function unresolved(data: ProjectData, byId: Map<string, Character>, events: Set<string>): GapItem[] {
  const out: GapItem[] = []
  const event = (key: string | undefined, field: string, item: Omit<GapItem, 'label'>) => {
    if (key !== undefined && !events.has(key)) out.push({ ...item, events: [...item.events, key], label: `${field} → ${key}` })
  }
  for (const c of data.characters) {
    const m = c.metadata
    for (const r of m.relations ?? []) {
      if (r.incoming) continue
      if (!byId.has(r.character_id)) out.push({ events: [], characters: [c.key], label: `otherKey → ${r.character_id}` })
      event(r.since, 'sinceKey', { events: [], characters: [c.key] })
      event(r.until, 'untilKey', { events: [], characters: [c.key] })
    }
    for (const k of m.knowledge ?? []) {
      event(k.since, 'sinceKey', { events: [], characters: [c.key] })
      event(k.until, 'untilKey', { events: [], characters: [c.key] })
    }
    for (const b of m.reading?.beats ?? []) event(b.since, 'sinceKey', { events: [], characters: [c.key] })
  }
  const places = new Set((data.places ?? []).map(p => p.key))
  const acts = new Set((data.acts ?? []).map(a => a.name))
  for (const e of data.events) {
    const m = e.metadata
    for (const p of m.participants ?? []) if (!byId.has(p.character_id)) out.push({ events: [e.key], characters: [], label: `characterKey → ${p.character_id}` })
    for (const l of m.links ?? []) if (!l.incoming) event(l.event, 'toKey', { events: [e.key], characters: [] })
    for (const l of m.learns ?? []) for (const id of l.who) if (!byId.has(id)) out.push({ events: [e.key], characters: [], label: `characterKey → ${id}` })
    if (m.placeKey && !m.placeInfo) out.push({ events: [e.key], characters: [], label: `placeKey → ${m.placeKey}` })
    if (data.acts?.length && m.act && !acts.has(m.act)) out.push({ events: [e.key], characters: [], label: `actName → ${m.act}` })
  }
  for (const p of data.places ?? []) if (p.parent && !places.has(p.parent)) out.push({ events: [], characters: [], label: `${p.name} · parentKey → ${p.parent}` })
  return out
}

/**
 * Spans whose end comes before their start in story order: a relation or a knowledge interval
 * whose `until` is before its `since`, and an arc stage that starts after the next stage, which
 * ends it. A key that names no event is left to `unresolved`.
 */
function endBeforeStart(data: ProjectData, order: Map<string, number>): GapItem[] {
  const before = (a?: string, b?: string) => a !== undefined && b !== undefined && order.has(a) && order.has(b) && order.get(a)! < order.get(b)!
  const out: GapItem[] = []
  for (const c of data.characters) {
    const m = c.metadata
    for (const r of m.relations ?? []) {
      if (!r.incoming && before(r.until, r.since)) out.push({ events: [r.since!, r.until!], characters: [c.key, r.character_id], label: r.label, note: 'relation' })
    }
    for (const k of m.knowledge ?? []) {
      if (before(k.until, k.since)) out.push({ events: [k.since!, k.until!], characters: [c.key], label: k.text, note: 'knowledge' })
    }
    // Stages are in list order; each holds until the next timed one starts.
    const timed = (m.reading?.beats ?? []).filter(b => b.since && order.has(b.since))
    timed.forEach((b, i) => {
      const next = timed[i + 1]
      if (next && before(next.since, b.since)) out.push({ events: [b.since!, next.since!], characters: [c.key], label: [b.stage, next.stage].filter(Boolean).join(' → '), note: 'arcStage' })
    })
  }
  return out
}

/** Each place whose parents lead back to it, once per cycle, with the events set in those places. */
function placeCycles(data: ProjectData): GapItem[] {
  const places = new Map((data.places ?? []).map(p => [p.key, p]))
  const seen = new Set<string>()
  const out: GapItem[] = []
  for (const start of places.keys()) {
    const path: string[] = []
    let key: string | undefined = start
    while (key && places.has(key) && !path.includes(key) && !seen.has(key)) {
      path.push(key)
      key = places.get(key)!.parent
    }
    for (const k of path) seen.add(k)
    if (!key || !path.includes(key)) continue
    const cycle = path.slice(path.indexOf(key))
    const inCycle = new Set(cycle)
    out.push({
      events: storyEvents(data.events).filter(e => inCycle.has(e.metadata.placeKey ?? '')).map(e => e.key),
      characters: [],
      label: [...cycle, key].map(k => places.get(k)!.name).join(' → '),
    })
  }
  return out
}

/**
 * Relation rows stated twice: the same owner, other, label and span, or a mutual relation that
 * each end states. Different spans of one pair are history, not copies.
 */
function duplicateRelations(data: ProjectData): GapItem[] {
  const seen = new Map<string, number>()
  const out: GapItem[] = []
  for (const c of data.characters) {
    for (const r of c.metadata.relations ?? []) {
      if (r.incoming) continue
      const key = JSON.stringify([c.key, r.character_id, r.label, r.since ?? null, r.until ?? null])
      const n = (seen.get(key) ?? 0) + 1
      seen.set(key, n)
      if (n === 2) out.push({ events: [], characters: [c.key, r.character_id], label: r.label, note: 'repeat' })
    }
  }
  for (const c of data.characters) {
    for (const r of c.metadata.relations ?? []) {
      if (r.incoming || !r.mutual || c.key >= r.character_id) continue
      const other = data.characters.find(o => o.key === r.character_id)
      const back = other?.metadata.relations?.some(x => !x.incoming && x.mutual && x.character_id === c.key && x.label === r.label && x.since === r.since && x.until === r.until)
      if (back) out.push({ events: [], characters: [c.key, r.character_id], label: r.label, note: 'reversed' })
    }
  }
  return out
}

/** Event links stated twice: the same source, target and label, or a mutual link that each end states. */
function duplicateLinks(data: ProjectData): GapItem[] {
  const out: GapItem[] = []
  const owned = data.events.flatMap(e => (e.metadata.links ?? []).filter(l => !l.incoming).map(l => ({ from: e.key, to: l.event, relation: l.relation, mutual: l.mutual })))
  const count = new Map<string, number>()
  for (const l of owned) {
    const key = JSON.stringify([l.from, l.to, l.relation])
    const n = (count.get(key) ?? 0) + 1
    count.set(key, n)
    if (n === 2) out.push({ events: [l.from, l.to], characters: [], label: l.relation, note: 'repeat' })
  }
  const mutual = new Set(owned.filter(l => l.mutual).map(l => JSON.stringify([l.from, l.to, l.relation])))
  for (const l of owned) {
    if (l.mutual && l.from < l.to && mutual.has(JSON.stringify([l.to, l.from, l.relation]))) out.push({ events: [l.from, l.to], characters: [], label: l.relation, note: 'reversed' })
  }
  return out
}
