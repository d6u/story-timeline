import type { Phase } from '../cursor/state'
import type { Graph, GraphEdge, NodeFaction } from './graph'

/** A character on the ring. The angle runs clockwise from the top; `x`/`y` are its centre at `radius`. */
export interface ChordNode {
  id: string
  name: string
  main: boolean
  /** The faction the node sits with; '' for none. */
  cluster: string
  angle: number
  x: number
  y: number
}

/** The band of the ring that one faction's members take, from `start` to `end` (radians, clockwise from the top). */
export interface ChordArc {
  id: string
  name: string
  color: string
  start: number
  end: number
}

/** A chord between two nodes: the edge, its two ends, and the control point of its curve. */
export interface Chord {
  edge: GraphEdge
  a: ChordNode
  b: ChordNode
  cx: number
  cy: number
}

/**
 * A further membership of some seats, drawn as a band on an outer ring: a character sits with
 * its first faction, and each faction after that stacks one ring further out over its slot.
 * Neighbouring seats that share a faction on the same ring share one band.
 */
export interface ChordBand extends ChordArc {
  /** 1 for the first ring outside the faction arcs, 2 for the next, and so on. */
  ring: number
  /** Every membership under the band ended before the end of the story. */
  ended: boolean
}

export interface ChordLayout {
  nodes: ChordNode[]
  arcs: ChordArc[]
  bands: ChordBand[]
  /** How many outer rings the bands take; 0 when nobody is in two factions. */
  rings: number
  chords: Chord[]
  radius: number
  /** The angle one seat takes. */
  slot: number
}

/** Air between two factions on the ring, as a share of one node's slot. */
const GROUP_GAP = 1.5

/** The point on a circle of `r` at `angle` (clockwise from the top). */
export function polar(r: number, angle: number): { x: number; y: number } {
  return { x: r * Math.sin(angle), y: -r * Math.cos(angle) }
}

/**
 * Puts the characters of a graph on a ring: each faction's members side by side, factions in the
 * graph's order (largest first), the unaffiliated last, with a gap between groups. Each edge
 * becomes a chord whose curve bends toward the centre: the further apart its ends, the deeper.
 */
export function buildChord(graph: Graph, radius = 1): ChordLayout {
  const order = [...graph.factions.map(f => f.id), '']
  const groups = order.map(id => graph.nodes.filter(n => n.cluster === id)).filter(g => g.length)
  const gaps = groups.length > 1 ? groups.length : 0
  const slot = (2 * Math.PI) / (graph.nodes.length + gaps * GROUP_GAP)
  const nodes: ChordNode[] = []
  const arcs: ChordArc[] = []
  let angle = 0
  for (const group of groups) {
    const start = angle
    for (const n of group) {
      const centre = angle + slot / 2
      nodes.push({ id: n.id, name: n.name, main: n.main, cluster: n.cluster, angle: centre, ...polar(radius, centre) })
      angle += slot
    }
    const faction = graph.factions.find(f => f.id === group[0].cluster)
    if (faction) arcs.push({ id: faction.id, name: faction.name, color: faction.color, start, end: angle })
    angle += slot * GROUP_GAP
  }
  const bands = chordBands(nodes, slot, graph).filter(b => b.ring > 0)
  const byId = new Map(nodes.map(n => [n.id, n]))
  const chords: Chord[] = graph.edges.flatMap(edge => {
    const a = byId.get(edge.from)
    const b = byId.get(edge.to)
    if (!a || !b || a === b) return []
    return [{ edge, a, b, ...control(a, b) }]
  })
  return { nodes, arcs, bands, rings: Math.max(0, ...bands.map(b => b.ring)), chords, radius, slot }
}

/**
 * The memberships of the seats as bands of the ring: a seat's first faction on ring 0, its arc,
 * and each further one a ring further out, so a faction keeps its ring whatever `phase` says.
 * Neighbouring seats that wear one faction on one ring share a band, ended only when every
 * membership under it ended. `phase` places each membership in the story; a `future` one draws
 * nothing. By default, as the story ends.
 */
export function chordBands(nodes: ChordNode[], slot: number, graph: Graph, phase: (f: NodeFaction) => Phase = f => (f.ended ? 'ended' : 'active')): ChordBand[] {
  const bands: ChordBand[] = []
  const factionOf = new Map(graph.factions.map(f => [f.id, f]))
  const membershipsOf = new Map(graph.nodes.map(n => [n.id, n.factions]))
  for (const n of nodes) {
    ;(membershipsOf.get(n.id) ?? []).forEach((f, ring) => {
      const faction = factionOf.get(f.id)
      const now = phase(f)
      if (!faction || now === 'future') return
      const start = n.angle - slot / 2
      const end = n.angle + slot / 2
      const ended = now === 'ended'
      // The seat before this one wore the same band on the same ring, with no gap between.
      const last = bands.findLast(b => b.ring === ring)
      if (last && last.id === f.id && Math.abs(last.end - start) < 1e-9) {
        last.end = end
        last.ended = last.ended && ended
        return
      }
      bands.push({ id: f.id, name: faction.name, color: faction.color, start, end, ring, ended })
    })
  }
  return bands
}

/**
 * The control point of a chord's quadratic curve: the middle of its ends pulled toward the
 * centre, all the way for ends across the ring, hardly at all for neighbours.
 */
export function control(a: { x: number; y: number; angle: number }, b: typeof a): { cx: number; cy: number } {
  let delta = Math.abs(a.angle - b.angle) % (2 * Math.PI)
  if (delta > Math.PI) delta = 2 * Math.PI - delta
  const pull = 1 - delta / Math.PI
  return { cx: ((a.x + b.x) / 2) * pull * 0.85, cy: ((a.y + b.y) / 2) * pull * 0.85 }
}

/** The SVG path of a chord. */
export function chordPath(c: Chord): string {
  return `M${c.a.x} ${c.a.y}Q${c.cx} ${c.cy} ${c.b.x} ${c.b.y}`
}

/** The middle of a chord's curve, where its label goes. */
export function chordMiddle(c: { a: { x: number; y: number }; b: { x: number; y: number }; cx: number; cy: number }): { x: number; y: number } {
  return { x: 0.25 * c.a.x + 0.5 * c.cx + 0.25 * c.b.x, y: 0.25 * c.a.y + 0.5 * c.cy + 0.25 * c.b.y }
}

/** The SVG path of a band of the ring from `start` to `end`, between radii `inner` and `outer`. */
export function arcPath(start: number, end: number, inner: number, outer: number): string {
  const large = end - start > Math.PI ? 1 : 0
  const o1 = polar(outer, start)
  const o2 = polar(outer, end)
  const i1 = polar(inner, end)
  const i2 = polar(inner, start)
  return `M${o1.x} ${o1.y}A${outer} ${outer} 0 ${large} 1 ${o2.x} ${o2.y}L${i1.x} ${i1.y}A${inner} ${inner} 0 ${large} 0 ${i2.x} ${i2.y}Z`
}
