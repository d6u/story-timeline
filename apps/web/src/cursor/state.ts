import type { ArcBeat, Knowledge, ProjectData, StoryEvent } from '../data/types'
import type { GraphEdge, GraphNode, NodeFaction, RelationSpan, Tone } from '../relations/graph'

/**
 * The story cursor: the story as of one event. Every rule below uses the story order of the
 * events (`sort_order`, then key), and the same edges:
 *
 * - A start (`since`) is inclusive: a thing that starts at the cursor event holds at it.
 * - An end (`until`, an exit) is inclusive too: a thing that ends at the cursor event no longer
 *   holds at it. So a span holds from `since` up to, but not at, `until`.
 * - A missing `since` means "from the start"; a missing `until` means "to the end".
 * - A key that names no event of the project is never reached: a `since` there never starts,
 *   an `until` there never ends.
 */

/** The place of each event key in story order, from 0. */
export type StoryOrder = Map<string, number>

/** Story order: `sort_order`, then key. Every view sorts events with it, so they agree when `sort_order` ties. */
export function byStoryOrder(a: StoryEvent, b: StoryEvent): number {
  return a.sort_order - b.sort_order || a.key.localeCompare(b.key)
}

/** Events in story order, as the timeline sorts them. */
export function storyEvents(events: StoryEvent[]): StoryEvent[] {
  return [...events].sort(byStoryOrder)
}

export function storyOrder(events: StoryEvent[]): StoryOrder {
  return new Map(storyEvents(events).map((e, i) => [e.key, i]))
}

/** Where a key sits in the story; an unknown key sits past the end. */
const place = (order: StoryOrder, key: string) => order.get(key) ?? Infinity

/** An event key is at or before the cursor. A missing key is "from the start". */
export function reached(order: StoryOrder, at: number, key?: string): boolean {
  return !key || place(order, key) <= at
}

/** An event key comes after the cursor. */
export function isAfter(order: StoryOrder, at: number, key: string): boolean {
  return place(order, key) > at
}

/** Where a span stands at the cursor: it has not started, it holds, or it has ended. */
export type Phase = 'future' | 'active' | 'ended'

export function phaseAt(span: { since?: string; until?: string }, order: StoryOrder, at: number): Phase {
  if (!reached(order, at, span.since)) return 'future'
  return span.until && place(order, span.until) <= at ? 'ended' : 'active'
}

/**
 * Where a character stands at the cursor. `unseen`: no appearance yet. `dead` and `left`: an
 * exit (`dies`, `leaves`) at or before the cursor, at `event`. A character who appears in no
 * event at all is not tracked, and counts as present all through.
 */
export type Status = { kind: 'unseen' } | { kind: 'present' } | { kind: 'dead' | 'left'; event: string }

/**
 * A later appearance that brings a character who left back into the story: in person, or with
 * no presence stated. A ghost (`spirit`), a thought (`mind`), a mention or a relative does not;
 * nothing brings back the dead. For example, a character who leaves and later appears only as
 * a ghost stays gone; a character who leaves and is back in person at the next event returns.
 */
const RETURNS = new Set<string | undefined>([undefined, 'body'])

/** The status of every character at the cursor. */
export function statusesAt(data: ProjectData, order: StoryOrder, at: number): Map<string, Status> {
  const status = new Map<string, Status>()
  const tracked = new Set<string>()
  for (const e of data.events) for (const p of e.metadata.participants ?? []) tracked.add(p.character_id)
  for (const c of data.characters) status.set(c.key, tracked.has(c.key) ? { kind: 'unseen' } : { kind: 'present' })
  for (const e of storyEvents(data.events)) {
    if (place(order, e.key) > at) break
    for (const p of e.metadata.participants ?? []) {
      const now = status.get(p.character_id)
      if (now?.kind === 'dead') continue
      if (p.exit === 'dies') status.set(p.character_id, { kind: 'dead', event: e.key })
      else if (p.exit === 'leaves') status.set(p.character_id, { kind: 'left', event: e.key })
      else if (now?.kind !== 'left' || RETURNS.has(p.presence)) status.set(p.character_id, { kind: 'present' })
    }
  }
  return status
}

/**
 * The index of the arc stage a character is in at the cursor: the last beat, in list order,
 * whose `since` is at or before it. A beat without `since` cannot be placed in the story; one
 * that comes before every timed beat holds from the start, any other is skipped. An arc with no
 * timed beat has no current stage.
 */
export function stageAt(beats: ArcBeat[], order: StoryOrder, at: number): number | undefined {
  const firstTimed = beats.findIndex(b => b.since)
  if (firstTimed < 0) return undefined
  let current: number | undefined
  beats.forEach((b, i) => {
    if (b.since ? reached(order, at, b.since) : i < firstTimed) current = i
  })
  return current
}

/** What a character knows at the cursor: learned at or before it, not forgotten yet. */
export function knownAt(items: Knowledge[], order: StoryOrder, at: number): Knowledge[] {
  return items.filter(k => phaseAt(k, order, at) === 'active')
}

/** An edge of the relation graph as it stands at the cursor. */
export interface EdgeAt {
  phase: Phase
  /** The relations that hold at the cursor, or the last one that ended. */
  label: string
  /** The label of the last relation that ended and gave way to `label`. */
  previous?: string
  /** The tone of the last relation in `label`. */
  tone: Tone
}

/**
 * Folds an edge's relation rows at the cursor, as `mergeSpans` does at the end of the story:
 * rows that hold make the label, and the last ended one with another label is `previous`. With
 * none holding, the last ended row makes the label and the edge is `ended`; with none started
 * yet, it is `future`.
 */
export function edgeAt(edge: GraphEdge, order: StoryOrder, at: number): EdgeAt {
  const phase = (sp: RelationSpan) => phaseAt({ since: sp.since?.key, until: sp.until?.key }, order, at)
  const active = edge.spans.filter(sp => phase(sp) === 'active')
  const ended = edge.spans.filter(sp => phase(sp) === 'ended').sort((a, b) => place(order, a.until!.key) - place(order, b.until!.key))
  if (active.length) {
    const labels = [...new Set(active.map(sp => sp.label))]
    const past = ended.filter(sp => !labels.includes(sp.label))
    return { phase: 'active', label: labels.join(' · '), previous: past.at(-1)?.label, tone: active.at(-1)!.tone }
  }
  const last = ended.at(-1)
  if (last) return { phase: 'ended', label: last.label, tone: last.tone }
  return { phase: 'future', label: edge.label, tone: edge.tone }
}

/**
 * The factions a graph node belongs to, in its order: at the cursor, only the memberships that
 * hold there; without one, every membership, as the graph draws the end of the story.
 */
export function factionsHeld(factions: NodeFaction[], cursor?: { order: StoryOrder; at: number }): string[] {
  return factions.filter(f => !cursor || phaseAt(f, cursor.order, cursor.at) === 'active').map(f => f.id)
}

/** How many nodes belong to each faction, by `factionsHeld`. */
export function factionMembers(nodes: GraphNode[], cursor?: { order: StoryOrder; at: number }): Map<string, number> {
  const counts = new Map<string, number>()
  for (const n of nodes) for (const id of factionsHeld(n.factions, cursor)) counts.set(id, (counts.get(id) ?? 0) + 1)
  return counts
}

/**
 * What the relation graph draws at the cursor: an edge whose relation has started and whose two
 * ends are in the story, and the nodes that are in the story (introduced by then). Without a
 * cursor, everything. `edges[i]` answers for `graph.edges[i]`; the counts are for the toolbar chip.
 */
export function drawnAt(graph: { nodes: GraphNode[]; edges: GraphEdge[] }, cursor?: Pick<StoryCursor, 'order' | 'at' | 'status'>): { edges: boolean[]; nodeCount: number; edgeCount: number } {
  if (!cursor) return { edges: graph.edges.map(() => true), nodeCount: graph.nodes.length, edgeCount: graph.edges.length }
  const seen = (id: string) => cursor.status.get(id)?.kind !== 'unseen'
  const edges = graph.edges.map(e => seen(e.from) && seen(e.to) && edgeAt(e, cursor.order, cursor.at).phase !== 'future')
  return { edges, nodeCount: graph.nodes.filter(n => seen(n.id)).length, edgeCount: edges.filter(Boolean).length }
}

/** The story as of one event, for the views to read. */
export interface StoryCursor {
  event: StoryEvent
  /** The cursor's place in story order. */
  at: number
  order: StoryOrder
  status: Map<string, Status>
}

/** The cursor at an event key, or none when the key names no event of the project. */
export function makeCursor(data: ProjectData, order: StoryOrder, key?: string): StoryCursor | undefined {
  const at = key === undefined ? undefined : order.get(key)
  if (at === undefined) return undefined
  const event = data.events.find(e => e.key === key)!
  return { event, at, order, status: statusesAt(data, order, at) }
}

/**
 * The story as it stands at the cursor, as data a whole-story reader (the insights) can take: the
 * events after the cursor do not exist, nor do the people not introduced yet. Relations,
 * memberships, knowledge and arc stages follow `phaseAt`: a span not started yet is gone; one
 * that still holds loses its end, which lies in the future; one that ended keeps its end, as
 * history. Links and learnings that reach a removed event or person go with it.
 */
export function storyAsOf(data: ProjectData, cursor: StoryCursor): ProjectData {
  const { order, at, status } = cursor
  const spans = <T extends { since?: string; until?: string }>(items: T[] | undefined): T[] | undefined => items?.flatMap(item => {
    const phase = phaseAt(item, order, at)
    if (phase === 'future') return []
    if (phase === 'ended' || item.until === undefined) return [item]
    const { until: _, ...open } = item
    return [open as T]
  })
  const events = new Set(data.events.filter(e => reached(order, at, e.key)).map(e => e.key))
  const people = new Set(data.characters.filter(c => status.get(c.key)?.kind !== 'unseen').map(c => c.key))
  return {
    ...data,
    characters: data.characters.filter(c => people.has(c.key)).map(c => {
      const m = c.metadata
      const beats = m.reading?.beats?.filter(b => reached(order, at, b.since))
      return {
        ...c,
        metadata: {
          ...m,
          ...(m.relations && { relations: spans(m.relations)!.filter(r => people.has(r.character_id)) }),
          ...(m.knowledge && { knowledge: spans(m.knowledge) }),
          ...(m.reading && { reading: { ...m.reading, beats } }),
        },
      }
    }),
    events: data.events.filter(e => events.has(e.key)).map(e => {
      const m = e.metadata
      const learns = m.learns?.map(l => ({ ...l, who: l.who.filter(id => people.has(id)) })).filter(l => l.who.length)
      return {
        ...e,
        metadata: {
          ...m,
          ...(m.links && { links: m.links.filter(l => events.has(l.event)) }),
          ...(m.learns && { learns: learns!.length ? learns : undefined }),
        },
      }
    }),
  }
}

/** Where each act starts among events in story order: its first index, and its name. */
export function actStarts(events: StoryEvent[]): { index: number; act: string }[] {
  return events.flatMap((e, i) => {
    const act = e.metadata.act
    return act && act !== events[i - 1]?.metadata.act ? [{ index: i, act }] : []
  })
}

/** The event key `delta` steps from the cursor, held inside the story. With no cursor, a step back starts at the last event and a step on at the first. */
export function stepKey(events: StoryEvent[], key: string | undefined, delta: number): string | undefined {
  if (!events.length) return undefined
  const i = key === undefined ? -1 : events.findIndex(e => e.key === key)
  const next = i < 0 ? (delta < 0 ? events.length - 1 : 0) : Math.min(events.length - 1, Math.max(0, i + delta))
  return events[next].key
}
