import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type Force, type Simulation, type SimulationNodeDatum } from 'd3-force'
import { storyEvents } from '../cursor/state'
import { relationTone, TONES, type Tone } from '../data/relations'
import type { Character, ProjectData } from '../data/types'

export { TONES, type Tone } from '../data/relations'

export interface GraphNode {
  id: string
  name: string
  main: boolean
  /** The factions the character is a member of, in the order it lists them. */
  factions: NodeFaction[]
  /** The faction the node gathers with in the layout: its first one, or '' for none. */
  cluster: string
  /** The radius of the node's circle. */
  r: number
}

/** An event a relation starts or ends at. */
export interface EventRef {
  key: string
  title: string
  /** The key names an event of the project. Without one, `title` is the key. */
  known: boolean
}

/** One relation row between two characters, with the events that bound it. */
export interface RelationSpan {
  /** The owner of the row. The relation is stated from `from` toward `to`. */
  from: string
  to: string
  label: string
  tone: Tone
  mutual: boolean
  since?: EventRef
  until?: EventRef
}

/**
 * All relations between one pair of characters, drawn as one line. `label` names the relations
 * that still hold at the end of the story, or the last one when none does.
 */
export interface GraphEdge {
  /** The owner of the current relation. The arrow points at `to` unless the relation is mutual. */
  from: string
  to: string
  label: string
  /** The relation holds in both directions, or the pair states one toward each other. No arrow. */
  mutual: boolean
  tone: Tone
  /** The two ends share no faction. */
  between: boolean
  /** Every relation row of the pair, oldest first. */
  spans: RelationSpan[]
  /** The label of the last relation that ended and gave way to `label`. */
  previous?: string
  /** No relation of the pair holds at the end of the story. */
  ended: boolean
  /** The event the current relation starts at. Missing when it holds from the start of the story. */
  since?: EventRef
  /** The event the last relation ended at, for an `ended` edge. */
  until?: EventRef
}

/** A membership a node shows. */
export interface NodeFaction {
  id: string
  /** The membership ended before the end of the story. */
  ended: boolean
  /** The event keys the membership starts and ends at, for the story cursor. */
  since?: string
  until?: string
}

/** A faction some shown character is a member of. */
export interface GraphFaction {
  id: string
  name: string
  /** A CSS colour: the group's own, or a palette slot. */
  color: string
  /** How many shown characters belong to it. */
  members: number
}

/** The characters to draw and the relations among them. Where they sit is the simulation's business; see `seedNodes`. */
export interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  /** Largest first. */
  factions: GraphFaction[]
}

export const emptyGraph: Graph = { nodes: [], edges: [], factions: [] }

export interface GraphOptions {
  /** Draw every character that has a relation, not only the main ones and their partners. */
  showMinor: boolean
  /** Relation tones to draw. */
  tones: Set<Tone>
  /** Write the relation name on each edge. */
  labels: boolean
}

export const defaultGraphOptions: GraphOptions = { showMinor: false, tones: new Set(TONES), labels: true }

/**
 * How hard the layout forces act, each as a multiple of its default. `repel` is how far every
 * node pushes every other, `distance` how long a relation holds its ends apart, `cluster` how
 * hard the members of a faction pull together.
 */
export interface Forces {
  repel: number
  distance: number
  cluster: number
}

export const defaultForces: Forces = { repel: 1, distance: 1, cluster: 1 }
/** The range of each force slider. */
export const FORCE_MIN = 0.2
export const FORCE_MAX = 3

/** The radius of a main character's circle, and of anyone else's. */
export const MAIN_R = 12
export const MINOR_R = 8
/** How far a relation holds its two ends apart: shorter inside a faction, so its members sit together. */
const LINK_WITHIN = 110
const LINK_BETWEEN = 190

/** The factions a character belongs to: every group it is a member of, in the order it lists them. */
export function factionsOf(c: Character, groups: Set<string>): NodeFaction[] {
  const seen = new Set<string>()
  return (c.metadata.relations ?? []).flatMap(r => {
    if (!r.member || r.incoming || !groups.has(r.character_id) || seen.has(r.character_id)) return []
    seen.add(r.character_id)
    return [{ id: r.character_id, ended: Boolean(r.until), since: r.since, until: r.until }]
  })
}

/**
 * The palette slot of the i-th faction. Main characters take the slots from the first one, so the
 * factions start four slots on, and a faction rarely wears the colour of a lane beside it.
 */
export function factionColor(i: number): string {
  return `var(--person-${(i + 4) % 8})`
}

/** Relations that are not membership, in both directions, counted once per character. */
function partnerIds(c: Character): string[] {
  return (c.metadata.relations ?? []).filter(r => !r.member).map(r => r.character_id)
}

/** Which tones the project's relations use, with how many relations each. */
export function toneCounts(data: ProjectData): Map<Tone, number> {
  const counts = new Map<Tone, number>()
  for (const c of data.characters) {
    for (const r of c.metadata.relations ?? []) {
      if (r.member || r.incoming) continue
      const tone = relationTone(r.label, r.tone)
      counts.set(tone, (counts.get(tone) ?? 0) + 1)
    }
  }
  return counts
}

/** Picks the characters to draw and joins them by their relations. */
export function buildGraph(data: ProjectData, options: GraphOptions = defaultGraphOptions): Graph {
  const byId = new Map(data.characters.map(c => [c.key, c]))
  const groups = new Set(data.characters.filter(c => c.metadata.kind === 'group').map(c => c.key))
  // A faction is a group somebody is a member of.
  const factions = new Set<string>()
  for (const c of data.characters) for (const r of c.metadata.relations ?? []) if (r.member && !r.incoming && groups.has(r.character_id)) factions.add(r.character_id)

  const mains = data.characters.filter(c => c.metadata.category === 'main')
  const shown = new Set<string>(mains.map(c => c.key))
  if (options.showMinor) {
    for (const c of data.characters) if (!factions.has(c.key) && partnerIds(c).length) shown.add(c.key)
  } else {
    for (const c of mains) for (const id of partnerIds(c)) if (!factions.has(id)) shown.add(id)
  }

  // Story order of the events, to sort the relation rows of a pair.
  const eventOrder = new Map<string, number>()
  const eventRef = new Map<string, EventRef>()
  for (const e of storyEvents(data.events)) {
    eventOrder.set(e.key, eventOrder.size)
    eventRef.set(e.key, { key: e.key, title: e.title, known: true })
  }
  const ref = (key?: string): EventRef | undefined => (key ? (eventRef.get(key) ?? { key, title: key, known: false }) : undefined)

  // The relation rows between each pair, in the order the owners list them.
  const pairs = new Map<string, RelationSpan[]>()
  for (const c of data.characters) {
    if (!shown.has(c.key)) continue
    for (const r of c.metadata.relations ?? []) {
      if (r.member || r.incoming || !shown.has(r.character_id)) continue
      const tone = relationTone(r.label, r.tone)
      if (!options.tones.has(tone)) continue
      const key = [c.key, r.character_id].sort().join('\0')
      pairs.set(key, [...(pairs.get(key) ?? []), { from: c.key, to: r.character_id, label: r.label, tone, mutual: r.mutual, since: ref(r.since), until: ref(r.until) }])
    }
  }
  const edges: GraphEdge[] = [...pairs.values()].map(rows => mergeSpans(rows, eventOrder))

  // The people, main characters first, then by lane and name.
  const order = (c: Character) => (c.metadata.category === 'main' ? 0 : 1)
  const people = [...shown].flatMap(id => byId.get(id) ?? []).sort((a, b) => order(a) - order(b) || (a.metadata.lane ?? 0) - (b.metadata.lane ?? 0) || a.name.localeCompare(b.name, 'zh'))
  const nameOf = (id: string) => byId.get(id)?.name ?? id
  const nodes: GraphNode[] = people.map(c => {
    const tags = factionsOf(c, factions)
    const main = c.metadata.category === 'main'
    return { id: c.key, name: c.name, main, factions: tags, cluster: tags[0]?.id ?? '', r: main ? MAIN_R : MINOR_R }
  })

  // The factions of the shown people, largest first, each with its colour.
  const members = new Map<string, number>()
  for (const n of nodes) for (const f of n.factions) members.set(f.id, (members.get(f.id) ?? 0) + 1)
  const factionList: GraphFaction[] = [...members]
    .sort((a, b) => b[1] - a[1] || nameOf(a[0]).localeCompare(nameOf(b[0]), 'zh'))
    .map(([id, count], i) => ({ id, name: nameOf(id), color: byId.get(id)?.metadata.color ?? factionColor(i), members: count }))

  const tagsOf = new Map(nodes.map(n => [n.id, new Set(n.factions.map(f => f.id))]))
  for (const e of edges) e.between = ![...(tagsOf.get(e.from) ?? [])].some(id => tagsOf.get(e.to)?.has(id))

  return { nodes, edges, factions: factionList }
}

/** A node while the simulation runs: `x`/`y` are its centre; `fx`/`fy` hold it under a dragging pointer. */
export interface SimNode extends SimulationNodeDatum {
  id: string
  /** The faction the node gathers with; '' for none. */
  cluster: string
  r: number
  x: number
  y: number
  vx: number
  vy: number
}

/** A small deterministic random generator (mulberry32), so a fresh layout is the same on every run. */
function random(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The simulation nodes of a graph. A node that was already in `previous` keeps its place, so a
 * rebuilt graph does not scramble the picture; a new one starts near the members of its faction,
 * or, with none to join, on its faction's spot of a ring around the origin.
 */
export function seedNodes(graph: Graph, previous: Iterable<{ id: string; x: number; y: number }> = []): SimNode[] {
  const known = new Map<string, { x: number; y: number }>()
  for (const p of previous) known.set(p.id, p)
  const clusters = [...new Set(graph.nodes.map(n => n.cluster))].sort((a, b) => (a === '' ? 1 : 0) - (b === '' ? 1 : 0) || a.localeCompare(b))
  const ring = Math.max(1, clusters.length)
  const radius = ring === 1 ? 0 : LINK_BETWEEN * ring * 0.4
  const rnd = random(1)
  // Where each faction already sits, from the nodes that stay.
  const centre = new Map<string, { x: number; y: number; n: number }>()
  for (const n of graph.nodes) {
    const p = known.get(n.id)
    if (!p) continue
    const c = centre.get(n.cluster) ?? { x: 0, y: 0, n: 0 }
    c.x += p.x; c.y += p.y; c.n++
    centre.set(n.cluster, c)
  }
  return graph.nodes.map((n, i) => {
    const p = known.get(n.id)
    if (p) return { id: n.id, cluster: n.cluster, r: n.r, x: p.x, y: p.y, vx: 0, vy: 0 }
    const c = centre.get(n.cluster)
    const angle = (clusters.indexOf(n.cluster) / ring) * Math.PI * 2
    const cx = c ? c.x / c.n : Math.cos(angle) * radius
    const cy = c ? c.y / c.n : Math.sin(angle) * radius
    // A phyllotaxis spiral around the centre, like d3's own start positions.
    const spiral = i * 2.3999632297286533
    const dist = 30 * Math.sqrt(0.5 + i)
    return { id: n.id, cluster: n.cluster, r: n.r, x: cx + Math.cos(spiral) * dist + (rnd() - 0.5) * 40, y: cy + Math.sin(spiral) * dist + (rnd() - 0.5) * 40, vx: 0, vy: 0 }
  })
}

/** A force with a strength that can change while the simulation runs. */
export interface ClusterForce extends Force<SimNode, undefined> {
  strength(s: number): ClusterForce
}

/** Pulls each node toward the centre of its faction, so its members gather in one place. */
export function forceCluster(initial = 0.2): ClusterForce {
  let nodes: SimNode[] = []
  let strength = initial
  const force = ((alpha: number) => {
    const sums = new Map<string, { x: number; y: number; n: number }>()
    for (const n of nodes) {
      if (!n.cluster) continue
      const s = sums.get(n.cluster) ?? { x: 0, y: 0, n: 0 }
      s.x += n.x; s.y += n.y; s.n++
      sums.set(n.cluster, s)
    }
    for (const n of nodes) {
      const s = sums.get(n.cluster)
      if (!s || s.n < 2) continue
      n.vx += (s.x / s.n - n.x) * strength * alpha
      n.vy += (s.y / s.n - n.y) * strength * alpha
    }
  }) as ClusterForce
  force.initialize = (list: SimNode[]) => { nodes = list }
  force.strength = (s: number) => { strength = s; return force }
  return force
}

const CHARGE = -420
const CLUSTER = 0.2
type Link = { source: string; target: string; distance: number; strength: number }

/**
 * A plain force-directed layout, stopped: relations pull their ends together (closer inside a
 * faction), every node repels every other, circles do not overlap, the members of a faction
 * gather, and a light gravity keeps the parts of the graph together. `restart` it to watch it move.
 */
export function createSimulation(nodes: SimNode[], edges: GraphEdge[], forces: Forces = defaultForces): Simulation<SimNode, undefined> {
  const links: Link[] = edges.map(e => ({ source: e.from, target: e.to, distance: e.between ? LINK_BETWEEN : LINK_WITHIN, strength: e.ended ? 0.3 : 0.8 }))
  const sim = forceSimulation(nodes)
    .force('link', forceLink<SimNode, Link>(links).id(n => n.id).strength(l => l.strength))
    .force('charge', forceManyBody<SimNode>().distanceMax(500))
    .force('collide', forceCollide<SimNode>().radius(n => n.r + 22).strength(0.8))
    .force('cluster', forceCluster())
    .force('x', forceX<SimNode>(0).strength(0.04))
    .force('y', forceY<SimNode>(0).strength(0.04))
    .stop()
  applyForces(sim, forces)
  return sim
}

/** Sets the strengths of a running simulation's forces. The caller reheats it to see the change. */
export function applyForces(sim: Simulation<SimNode, undefined>, forces: Forces): void {
  const link = sim.force('link') as ReturnType<typeof forceLink<SimNode, Link>> | undefined
  link?.distance(l => l.distance * forces.distance)
  ;(sim.force('charge') as ReturnType<typeof forceManyBody<SimNode>> | undefined)?.strength(CHARGE * forces.repel)
  ;(sim.force('cluster') as ClusterForce | undefined)?.strength(CLUSTER * forces.cluster)
}

/**
 * Folds the relation rows of one pair into one edge. Rows that still hold at the end of the
 * story make the label; the last row that ended before them is `previous`. When every row has
 * ended, the last one makes the label and the edge is `ended`.
 */
export function mergeSpans(rows: RelationSpan[], eventOrder: Map<string, number>): GraphEdge {
  // Oldest first: a row without `since` holds from the start; an unknown event sorts last.
  const at = (e: EventRef | undefined, none: number) => (e ? (eventOrder.get(e.key) ?? Number.MAX_SAFE_INTEGER) : none)
  const spans = [...rows].sort((a, b) => at(a.since, -1) - at(b.since, -1) || at(a.until, Infinity) - at(b.until, Infinity))
  const current = spans.filter(sp => !sp.until)
  const shownSpans = current.length ? current : spans.slice(-1)
  const last = shownSpans[shownSpans.length - 1]
  const labels = [...new Set(shownSpans.map(sp => sp.label))]
  const bothWays = new Set(shownSpans.map(sp => sp.from)).size > 1
  const mutual = bothWays || shownSpans.some(sp => sp.mutual)
  const past = current.length ? spans.filter(sp => sp.until && !labels.includes(sp.label)) : []
  // The shown relations start when the first of them starts; one without `since` holds from the start.
  const since = shownSpans.every(sp => sp.since) ? shownSpans[0].since : undefined
  return {
    from: last.from,
    to: last.to,
    label: labels.join(' · '),
    mutual,
    tone: last.tone,
    between: false,
    spans,
    previous: past.length ? past[past.length - 1].label : undefined,
    ended: !current.length,
    since,
    until: current.length ? undefined : last.until,
  }
}

/**
 * The text an edge label shows: the previous relation, an arrow and the current one. It takes a
 * graph edge at the end of the story, or an `EdgeAt` from cursor/state.ts at the cursor.
 */
export function edgeLabelText(e: { label: string; previous?: string }): string {
  return e.previous ? `${e.previous} → ${e.label}` : e.label
}

/** The event an edge label names under the relation: where it starts, or where it ended. */
export function edgeLabelEvent(e: GraphEdge): EventRef | undefined {
  return e.ended ? e.until : e.since
}

/** Above this many drawn relations, the relation names show only around the person in focus; below it, all of them. */
export const LABEL_LIMIT = 30

/**
 * Which relation names the graph writes: none when the names are off; all of them on a small graph;
 * on a large one, only those on the edges of the person in focus (hovered, focused or selected),
 * as all of them at once overlap into noise.
 */
export function labelMode(showLabels: boolean, drawnEdges: number): 'none' | 'all' | 'focus' {
  if (!showLabels) return 'none'
  return drawnEdges > LABEL_LIMIT ? 'focus' : 'all'
}

/**
 * The people a search names: those whose name or an alias holds the query, ignoring case and the
 * spaces around it. An empty query names no search at all (undefined), so nothing dims.
 */
export function matchPeople(nodes: { id: string; name: string }[], aliases: (id: string) => string[] | undefined, query: string): Set<string> | undefined {
  const q = query.trim().toLowerCase()
  if (!q) return undefined
  return new Set(nodes.filter(n => n.name.toLowerCase().includes(q) || (aliases(n.id) ?? []).some(a => a.toLowerCase().includes(q))).map(n => n.id))
}

/** The ids next to `id` over the given edges, `id` included. */
export function neighbourhood(edges: { from: string; to: string }[], id: string): Set<string> {
  const out = new Set([id])
  for (const e of edges) {
    if (e.from === id) out.add(e.to)
    else if (e.to === id) out.add(e.from)
  }
  return out
}

/** The box around some circles, given by their centres and radii, with `pad` of air. */
export function extent(nodes: { x: number; y: number; r: number }[], pad = 0): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.r - pad)
    minY = Math.min(minY, n.y - n.r - pad)
    maxX = Math.max(maxX, n.x + n.r + pad)
    maxY = Math.max(maxY, n.y + n.r + pad)
  }
  return { minX, minY, maxX, maxY }
}

/**
 * The ends of the line between two circles, pulled in to their rims with `gap` of air, and a
 * little more at the target when an arrow head sits there.
 */
export function edgeEnds(a: { x: number; y: number; r: number }, b: { x: number; y: number; r: number }, arrow: boolean, gap = 3): { x1: number; y1: number; x2: number; y2: number } {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const ra = a.r + gap
  const rb = b.r + gap + (arrow ? 6 : 0)
  return { x1: a.x + ux * ra, y1: a.y + uy * ra, x2: b.x - ux * rb, y2: b.y - uy * rb }
}
