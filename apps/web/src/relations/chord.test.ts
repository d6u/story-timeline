import { describe, expect, it } from 'vitest'
import { phaseAt } from '../cursor/state'
import { arcPath, buildChord, chordBands, chordMiddle, control, polar } from './chord'
import type { Graph, NodeFaction } from './graph'

const node = (id: string, cluster: string, main = false, more: NodeFaction[] = []) => ({ id, name: id, main, factions: [...(cluster ? [{ id: cluster, ended: false }] : []), ...more], cluster, r: 8 })
const edge = (from: string, to: string) => ({ from, to, label: 'x', mutual: false, tone: 'neutral' as const, between: false, spans: [], ended: false })
const graph: Graph = {
  nodes: [node('a', 'red', true), node('b', 'blue'), node('c', 'red'), node('d', ''), node('e', 'blue')],
  edges: [edge('a', 'b'), edge('a', 'c'), edge('d', 'e')],
  factions: [
    { id: 'red', name: 'Red', color: 'r', members: 2 },
    { id: 'blue', name: 'Blue', color: 'b', members: 2 },
  ],
}

describe('buildChord', () => {
  const layout = buildChord(graph, 100)
  it('seats each faction together, in the graph order, with the unaffiliated last', () => {
    expect(layout.nodes.map(n => n.id)).toEqual(['a', 'c', 'b', 'e', 'd'])
    expect(layout.arcs.map(a => a.id)).toEqual(['red', 'blue'])
  })
  it('spreads the seats clockwise from the top on the ring, with a gap between groups', () => {
    const angles = layout.nodes.map(n => n.angle)
    for (let i = 1; i < angles.length; i++) expect(angles[i]).toBeGreaterThan(angles[i - 1])
    expect(angles[angles.length - 1]).toBeLessThan(2 * Math.PI)
    for (const n of layout.nodes) expect(Math.hypot(n.x, n.y)).toBeCloseTo(100)
    // The first seat sits just right of the top.
    expect(layout.nodes[0].x).toBeGreaterThan(0)
    expect(layout.nodes[0].y).toBeLessThan(0)
    // The gap between c (end of red) and b (start of blue) is wider than between a and c.
    expect(angles[2] - angles[1]).toBeGreaterThan(angles[1] - angles[0])
  })
  it('spans each arc over its members only', () => {
    const [red, blue] = layout.arcs
    const at = (id: string) => layout.nodes.find(n => n.id === id)!.angle
    expect(red.start).toBeLessThan(at('a'))
    expect(red.end).toBeGreaterThan(at('c'))
    expect(red.end).toBeLessThan(at('b'))
    expect(blue.start).toBeLessThan(at('b'))
    expect(blue.end).toBeGreaterThan(at('e'))
  })
  it('makes a chord per edge between seated nodes', () => {
    expect(layout.chords.map(c => [c.a.id, c.b.id])).toEqual([['a', 'b'], ['a', 'c'], ['d', 'e']])
  })
  it('is the same for the same input', () => {
    expect(buildChord(graph, 100)).toEqual(layout)
  })
  it('has no outer rings when nobody is in two factions', () => {
    expect(layout.bands).toEqual([])
    expect(layout.rings).toBe(0)
  })
  it('stacks further memberships on outer rings over the seat, merging neighbours that share one', () => {
    const multi: Graph = {
      ...graph,
      nodes: [
        node('a', 'red', true, [{ id: 'blue', ended: false }]),
        node('c', 'red', false, [{ id: 'blue', ended: true }, { id: 'green', ended: false }]),
        node('b', 'blue'),
        node('e', 'blue', false, [{ id: 'red', ended: true }]),
        node('d', ''),
      ],
      factions: [...graph.factions, { id: 'green', name: 'Green', color: 'g', members: 1 }],
    }
    const l = buildChord(multi, 100)
    const at = (id: string) => l.nodes.find(n => n.id === id)!
    // a and c sit side by side in red and both wear blue: one band over both seats, live because a's membership lives.
    const blue = l.bands.filter(b => b.id === 'blue' && b.ring === 1)
    expect(blue).toHaveLength(1)
    expect(blue[0].start).toBeCloseTo(at('a').angle - l.slot / 2)
    expect(blue[0].end).toBeCloseTo(at('c').angle + l.slot / 2)
    expect(blue[0].ended).toBe(false)
    // c's third faction goes one ring further out; e's ended red membership is marked.
    expect(l.bands.find(b => b.id === 'green')).toMatchObject({ ring: 2, ended: false })
    expect(l.bands.find(b => b.id === 'red')).toMatchObject({ ring: 1, ended: true })
    expect(l.rings).toBe(2)
  })
})

describe('chordBands', () => {
  // a joins red at `join` and leaves blue there; c is in red all along.
  const timed: Graph = {
    ...graph,
    nodes: [{ ...node('a', 'red', true), factions: [{ id: 'red', ended: false, since: 'join' }, { id: 'blue', ended: true, until: 'join' }] }, node('c', 'red'), node('b', 'blue')],
  }
  const layout = buildChord(timed, 100)
  const order = new Map([['start', 0], ['join', 1]])
  const at = (i: number) => chordBands(layout.nodes, layout.slot, timed, f => phaseAt(f, order, i)).map(b => [b.id, b.ring, b.ended, Math.round((b.end - b.start) / layout.slot)])

  it('draws a membership only once it has started, and ghosts it once it has ended', () => {
    expect(at(0)).toEqual([['blue', 1, false, 1], ['red', 0, false, 1], ['blue', 0, false, 1]])
    expect(at(1)).toEqual([['red', 0, false, 2], ['blue', 1, true, 1], ['blue', 0, false, 1]])
  })
  it('keeps the seats where the whole story puts them', () => {
    expect(layout.nodes.map(n => n.id)).toEqual(['a', 'c', 'b'])
  })
})

describe('control', () => {
  const at = (angle: number) => ({ angle, ...polar(100, angle) })
  it('pulls a chord across the ring through the centre, and leaves neighbours shallow', () => {
    const across = control(at(0), at(Math.PI))
    expect(Math.hypot(across.cx, across.cy)).toBeLessThan(1e-9)
    const near = control(at(0), at(0.2))
    expect(Math.hypot(near.cx, near.cy)).toBeGreaterThan(70)
    const quarter = control(at(0), at(Math.PI / 2))
    expect(Math.hypot(quarter.cx, quarter.cy)).toBeLessThan(Math.hypot(near.cx, near.cy))
  })
  it('puts the label at the middle of the curve', () => {
    const c = { a: at(0), b: at(Math.PI), cx: 0, cy: 0 }
    expect(chordMiddle(c).x).toBeCloseTo(0)
    expect(chordMiddle(c).y).toBeCloseTo(0)
  })
})

describe('arcPath', () => {
  it('draws a closed band with the large-arc flag past a half turn', () => {
    expect(arcPath(0, 1, 90, 100)).toMatch(/^M0 -100A100 100 0 0 1 .*Z$/)
    expect(arcPath(0, 4, 90, 100)).toContain('A100 100 0 1 1')
  })
})
