import { storyEvents } from '../cursor/state'
import type { ProjectData, StoryEvent } from '../data/types'

/**
 * What one event does to another. `cause` drives the plot on, `setup` plants what a later event
 * pays off, `reveal` brings an earlier event to light, `echo` puts two events side by side
 * without one driving the other (a parallel, or two things at the same time). `other` is a
 * relation the words below do not name.
 */
export type LinkKind = 'cause' | 'setup' | 'reveal' | 'echo' | 'other'
export const LINK_KINDS: LinkKind[] = ['cause', 'setup', 'reveal', 'echo', 'other']
/** The kinds that point from one event to the next; chains follow them. */
export const DIRECTED = new Set<LinkKind>(['cause', 'setup', 'reveal'])

/** Prefixes of the free-text relation, Chinese and English, per kind. English is matched in lower case. */
const kindWords = [
  ['cause', ['导致', '促成', '引发', '造成', '促使', 'cause', 'lead', 'trigger', 'result', 'enable', 'drive']],
  ['setup', ['伏笔', '铺垫', '预示', '埋下', 'foreshadow', 'setup', 'set up', 'plant', 'presage']],
  ['reveal', ['揭示', '解释', '揭露', '回忆', '闪回', 'reveal', 'explain', 'expose', 'recall', 'flashback']],
  ['echo', ['呼应', '照应', '对照', '同时', '与此同时', 'echo', 'parallel', 'mirror', 'contrast', 'same time', 'simultaneous', 'meanwhile']],
] as const

/**
 * The kind of a link. A kind the author stored (`EventLink.kind`) wins. Without it, the words
 * decide, and a mutual link points neither way, so it is an echo whatever its words.
 */
export function linkKind(relation: string, mutual = false, stored?: Exclude<LinkKind, 'other'> | null): LinkKind {
  if (stored) return stored
  if (mutual) return 'echo'
  const word = relation.trim().toLowerCase()
  return kindWords.find(([, words]) => words.some(prefix => word.startsWith(prefix)))?.[0] ?? 'other'
}

export interface CausalNode {
  /** The event key, as `key`; edges and selections name the node by it. */
  id: string
  key: string
  title: string
  /** The title cut to fit the node. */
  short: string
  act: string
  /** The place of the event in the story, from 0, among all events of the project. */
  order: number
  core: boolean
  /** The column of the drawing, and the row in it. */
  layer: number
  row: number
  /** The centre of the node in the drawing. */
  x: number
  y: number
  /** How many events follow from this one, over directed links. */
  reach: number
}

/**
 * One link between two events, drawn once. For a directed kind the arrow points from `from` to
 * `to`: the cause to the effect, the setup to the payoff, and the revealed event to the event
 * that reveals it. An echo keeps the order the data states it in.
 */
export interface CausalEdge {
  from: string
  to: string
  kind: LinkKind
  /** The relation as the data writes it. */
  relation: string
  note?: string
}

/** An act's column band in the drawing. */
export interface CausalAct {
  name: string
  /** The name cut to fit over the band, with an ellipsis when it was cut (see `actLabel`). */
  label: string
  x0: number
  x1: number
}

export interface Causality {
  /** In story order. */
  nodes: CausalNode[]
  edges: CausalEdge[]
  acts: CausalAct[]
  width: number
  height: number
  /** The number of events on the longest directed chain. */
  longest: number
}

export const emptyCausality: Causality = { nodes: [], edges: [], acts: [], width: 0, height: 0, longest: 0 }

/** The size of an event node, and the step between columns and rows. */
export const NODE_W = 132
export const NODE_H = 26
const COL_W = NODE_W + 64
const ROW_H = NODE_H + 18
/** Extra air between two acts. */
const ACT_GAP = 36
/** The drawing aims to be about this many times as wide as it is high. */
const ASPECT = 2
/** How many crossing-reduction sweeps the layout makes. */
const SWEEPS = 12
/** The width of a short title: a CJK character counts 1, any other about half. */
const SHORT_WIDTH = 9

/** The title cut to `max` width units, with an ellipsis when it was cut; no space is left before the ellipsis. */
export function shortTitle(title: string, max = SHORT_WIDTH): string {
  let width = 0
  const chars = [...title]
  for (let i = 0; i < chars.length; i++) {
    width += chars[i].charCodeAt(0) > 0x2e7f ? 1 : 0.55
    if (width > max) return `${chars.slice(0, i - 1).join('').trimEnd()}…`
  }
  return title
}

/**
 * One width unit of `shortTitle` (a CJK character) in px, for the act names: 13px bold. A Latin
 * letter counts half of that, and the band keeps 14px of air at the end for the wider ones.
 */
const ACT_UNIT = 13
/** The act name over a band from `x0` to `x1`: the band is 14px wider on each side than its nodes, less the inset of the name and some air. */
export function actLabel(name: string, x0: number, x1: number): string {
  return shortTitle(name, (x1 - x0 + 2) / ACT_UNIT)
}

/** Counts the links of each kind in the project, once per link. */
export function kindCounts(data: ProjectData): Map<LinkKind, number> {
  const counts = new Map<LinkKind, number>()
  for (const e of collectEdges(data)) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1)
  return counts
}

/**
 * Every link of the project, once. Links are stored on the owner and mirrored on the other end
 * as `incoming`, so only the owner's copy counts. A link to an unknown event is dropped.
 */
function collectEdges(data: ProjectData): CausalEdge[] {
  const byKey = new Map(data.events.map(e => [e.key, e]))
  const seen = new Set<string>()
  const edges: CausalEdge[] = []
  for (const owner of data.events) {
    for (const l of owner.metadata.links ?? []) {
      const other = byKey.get(l.event)
      if (l.incoming || !other || other.key === owner.key) continue
      const kind = linkKind(l.relation, l.mutual, l.kind)
      // A reveal is stored on the event that reveals; its arrow comes from the revealed one.
      const [from, to] = kind === 'reveal' ? [other.key, owner.key] : [owner.key, other.key]
      const id = `${DIRECTED.has(kind) ? [from, to].join('\0') : [from, to].sort().join('\0')}\0${kind}`
      if (seen.has(id)) continue
      seen.add(id)
      edges.push({ from, to, kind, relation: l.relation, note: l.note })
    }
  }
  return edges
}

/** Builds the graph of events and their links of the given kinds, and lays it out. */
export function buildCausality(data: ProjectData, kinds: Set<LinkKind> = new Set(LINK_KINDS)): Causality {
  const edges = collectEdges(data).filter(e => kinds.has(e.kind))
  if (!edges.length) return emptyCausality
  const linked = new Set(edges.flatMap(e => [e.from, e.to]))
  const story = storyEvents(data.events)
  const order = new Map(story.map((e, i) => [e.key, i]))
  // Acts in the order the story reaches them.
  const actNames = [...new Set(story.map(e => e.metadata.act ?? ''))]
  const byAct = new Map(actNames.map(a => [a, [] as StoryEvent[]]))
  for (const e of story) if (linked.has(e.key)) byAct.get(e.metadata.act ?? '')!.push(e)
  const acts = actNames.filter(a => byAct.get(a)!.length)

  const rows = rowCount(acts.map(a => byAct.get(a)!.length))
  // Each act splits into columns of consecutive events, as even as they can be.
  const layers: StoryEvent[][] = []
  const actLayers: { name: string; first: number; last: number }[] = []
  for (const name of acts) {
    const list = byAct.get(name)!
    const n = Math.ceil(list.length / rows)
    const first = layers.length
    for (let i = 0; i < n; i++) layers.push(list.slice(Math.floor((i * list.length) / n), Math.floor(((i + 1) * list.length) / n)))
    actLayers.push({ name, first, last: layers.length - 1 })
  }

  const rowOf = orderRows(layers.map(l => l.map(e => e.key)), edges, rows)
  const actOfLayer = new Map(actLayers.flatMap((a, i) => Array.from({ length: a.last - a.first + 1 }, (_, j) => [a.first + j, i] as const)))
  const layerX = (layer: number) => NODE_W / 2 + layer * COL_W + (actOfLayer.get(layer) ?? 0) * ACT_GAP
  const nodes: CausalNode[] = layers.flatMap((list, layer) => list.map(e => ({
    id: e.key,
    key: e.key,
    title: e.title,
    short: shortTitle(e.title),
    act: e.metadata.act ?? '',
    order: order.get(e.key)!,
    core: e.is_core,
    layer,
    row: rowOf.get(e.key)!,
    x: layerX(layer),
    y: NODE_H / 2 + rowOf.get(e.key)! * ROW_H,
    reach: 0,
  })))

  const next = successors(edges)
  for (const n of nodes) n.reach = closure(next, n.id).size
  return {
    nodes,
    edges,
    acts: actLayers.map(a => {
      const x0 = layerX(a.first) - NODE_W / 2
      const x1 = layerX(a.last) + NODE_W / 2
      return { name: a.name, label: actLabel(a.name, x0, x1), x0, x1 }
    }),
    width: layerX(layers.length - 1) + NODE_W / 2,
    height: (rows - 1) * ROW_H + NODE_H,
    longest: longestPath(nodes.map(n => n.id), next).length,
  }
}

/** The fewest rows that keep the drawing within `ASPECT` times as wide as it is high. */
export function rowCount(actSizes: number[]): number {
  const most = Math.max(1, ...actSizes)
  for (let rows = 1; rows < most; rows++) {
    const columns = actSizes.reduce((sum, n) => sum + Math.ceil(n / rows), 0)
    if (columns * COL_W + (actSizes.length - 1) * ACT_GAP <= ASPECT * rows * ROW_H) return rows
  }
  return most
}

/**
 * The row of each node. Columns start in story order from the top; then each sweep, left to right and back,
 * moves every node toward the mean row of its partners in other columns and keeps the rows of a
 * column distinct. Linked events end up level with each other, and fewer links cross.
 */
export function orderRows(layers: string[][], edges: { from: string; to: string }[], rows: number): Map<string, number> {
  const partners = new Map<string, string[]>()
  for (const e of edges) {
    partners.set(e.from, [...(partners.get(e.from) ?? []), e.to])
    partners.set(e.to, [...(partners.get(e.to) ?? []), e.from])
  }
  const layerOf = new Map(layers.flatMap((l, i) => l.map(id => [id, i] as const)))
  const row = new Map<string, number>()
  for (const l of layers) l.forEach((id, i) => row.set(id, i))
  for (let sweep = 0; sweep < SWEEPS; sweep++) {
    const pass = sweep % 2 ? [...layers].reverse() : layers
    for (const l of pass) {
      const wish = new Map(l.map(id => {
        const others = (partners.get(id) ?? []).filter(p => layerOf.get(p) !== layerOf.get(id))
        return [id, others.length ? others.reduce((s, p) => s + row.get(p)!, 0) / others.length : row.get(id)!] as const
      }))
      const sorted = [...l].sort((a, b) => wish.get(a)! - wish.get(b)! || row.get(a)! - row.get(b)!)
      placeRows(sorted.map(id => wish.get(id)!), rows).forEach((r, i) => row.set(sorted[i], r))
    }
  }
  return row
}

/** Distinct rows in 0..rows-1, in the order given, each as near its wish as the others allow. */
function placeRows(wishes: number[], rows: number): number[] {
  const out: number[] = []
  wishes.forEach((w, i) => out.push(Math.max(i ? out[i - 1] + 1 : 0, Math.round(w))))
  for (let i = out.length - 1; i >= 0; i--) out[i] = Math.min(out[i], i === out.length - 1 ? rows - 1 : out[i + 1] - 1)
  return out
}

/** The events each event points at over directed links. */
function successors(edges: CausalEdge[]): Map<string, string[]> {
  const next = new Map<string, string[]>()
  for (const e of edges) if (DIRECTED.has(e.kind)) next.set(e.from, [...(next.get(e.from) ?? []), e.to])
  return next
}

/** Every event reached from `id` over `next`, without `id` itself. A cycle stops where it closes. */
function closure(next: Map<string, string[]>, id: string): Set<string> {
  const seen = new Set<string>([id])
  const stack = [id]
  while (stack.length) for (const n of next.get(stack.pop()!) ?? []) if (!seen.has(n)) { seen.add(n); stack.push(n) }
  seen.delete(id)
  return seen
}

/** The events that lead to `id`: its causes, their causes, and so on. */
export function upstream(c: Causality, id: string): Set<string> {
  const back = new Map<string, string[]>()
  for (const e of c.edges) if (DIRECTED.has(e.kind)) back.set(e.to, [...(back.get(e.to) ?? []), e.from])
  return closure(back, id)
}

/** The events that follow from `id`: its effects, their effects, and so on. */
export function downstream(c: Causality, id: string): Set<string> {
  return closure(successors(c.edges), id)
}

/**
 * The events of the longest directed path, first to last. Of two paths as long, the one that
 * starts earlier in `ids` wins. A link that closes a cycle is not followed.
 */
function longestPath(ids: string[], next: Map<string, string[]>): string[] {
  const memo = new Map<string, string[]>()
  const open = new Set<string>()
  const path = (id: string): string[] => {
    const known = memo.get(id)
    if (known) return known
    open.add(id)
    let best: string[] = []
    for (const n of next.get(id) ?? []) {
      if (open.has(n)) continue
      const p = path(n)
      if (p.length > best.length) best = p
    }
    open.delete(id)
    const out = [id, ...best]
    memo.set(id, out)
    return out
  }
  return ids.reduce<string[]>((best, id) => {
    const p = path(id)
    return p.length > best.length ? p : best
  }, [])
}

/** The event keys of the longest directed chain, first to last. */
export function longestChain(c: Causality): string[] {
  return longestPath(c.nodes.map(n => n.id), successors(c.edges))
}

/**
 * The curve of an edge between two nodes. It leaves the side that faces the target and enters
 * the target's facing side; between nodes of one column it bows out to the right.
 */
export function edgePath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const half = NODE_W / 2
  if (a.x === b.x) {
    const x = a.x + half
    const bow = 24 + Math.abs(b.y - a.y) * 0.25
    return `M${x} ${a.y}C${x + bow} ${a.y} ${x + bow} ${b.y} ${x} ${b.y}`
  }
  const dir = b.x > a.x ? 1 : -1
  const x1 = a.x + dir * half
  const x2 = b.x - dir * half
  const pull = Math.max(30, Math.abs(x2 - x1) * 0.45) * dir
  return `M${x1} ${a.y}C${x1 + pull} ${a.y} ${x2 - pull} ${b.y} ${x2} ${b.y}`
}

/** Below this scale the titles are too small to read, so the graph starts here instead of fitting everything. */
export const READABLE_ZOOM = 0.8
/** Room above the nodes for the act names, and air around the drawing when it is fitted. */
export const CAUSAL_HEADER = 44
export const CAUSAL_PAD = 24

/**
 * The view the causality graph starts in, as `screen = world * k + (x, y)`. With `whole`, the whole
 * drawing fits the box (the Fit button and the `f` key). Otherwise the drawing fits the height of
 * the box, never above 1:1; when that would go below `READABLE_ZOOM`, the graph starts at that
 * scale instead, centred on `focus` (the selected or cursor event) when there is one, else at the
 * top left, where the story starts. A drawing narrower than the box is centred across.
 */
export function causalStart(box: { w: number; h: number }, size: { width: number; height: number }, whole = false, focus?: { x: number; y: number }): { k: number; x: number; y: number } {
  const { w, h } = box
  const bw = size.width + 2 * CAUSAL_PAD + 28
  const bh = size.height + CAUSAL_HEADER + 2 * CAUSAL_PAD
  const fitted = Math.min(h / bh, whole ? w / bw : 1, 1)
  const k = whole ? fitted : Math.max(fitted, Math.min(READABLE_ZOOM, 1))
  const narrow = k * bw <= w
  if (!whole && k > fitted) {
    // Too tall to fit readably: start at the focus, or at the top left.
    if (focus) return { k, x: narrow ? (w - k * size.width) / 2 : w / 2 - k * focus.x, y: h / 2 - k * focus.y }
    return { k, x: narrow ? (w - k * size.width) / 2 : CAUSAL_PAD + 14 * k, y: CAUSAL_PAD + k * CAUSAL_HEADER }
  }
  return { k, x: narrow ? (w - k * size.width) / 2 : CAUSAL_PAD + 14 * k, y: (h - k * (size.height - CAUSAL_HEADER)) / 2 }
}
