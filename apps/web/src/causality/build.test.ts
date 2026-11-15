import { describe, expect, it } from 'vitest'
import { assemble } from '../data/assemble'
import type { EventLink, ProjectData, StoryEvent } from '../data/types'
import { fixture } from '../test/fixture'
import { actLabel, buildCausality, causalStart, downstream, READABLE_ZOOM, edgePath, kindCounts, linkKind, NODE_W, orderRows, rowCount, shortTitle, upstream } from './build'

/** An event with links stored on it; `build` adds the mirrored copies, as assemble does. */
const ev = (key: string, sort: number, act: string, links: [string, string, boolean?][] = [], core = false): StoryEvent => ({
  id: `id-${key}`, key, title: key.toUpperCase(), description: null, character_ids: [], is_core: core, sort_order: sort,
  metadata: { act, links: links.map(([event, relation, mutual]) => ({ event, relation, mutual: mutual ?? false, incoming: false })) },
})
function project(events: StoryEvent[]): ProjectData {
  const mirrored = events.map(e => ({
    ...e,
    metadata: {
      ...e.metadata,
      links: [
        ...(e.metadata.links ?? []),
        ...events.flatMap(o => (o.metadata.links ?? []).filter(l => l.event === e.key).map((l): EventLink => ({ ...l, event: o.key, incoming: true }))),
      ],
    },
  }))
  return { id: 'p', name: 'p', characters: [], events: mirrored }
}

describe('linkKind', () => {
  it('reads the relations the projects use', () => {
    expect(['导致', '促成', '伏笔', '揭示', '回忆', '呼应', '同时'].map(w => linkKind(w))).toEqual(['cause', 'cause', 'setup', 'reveal', 'reveal', 'echo', 'echo'])
  })
  it('reads English words by prefix, in any case', () => {
    expect(['causes', 'Leads to', 'foreshadows', 'Reveals', 'echoes', 'meanwhile'].map(w => linkKind(w))).toEqual(['cause', 'cause', 'setup', 'reveal', 'echo', 'echo'])
  })
  it('makes a mutual link an echo, and an unknown word other', () => {
    expect(linkKind('导致', true)).toBe('echo')
    expect(linkKind('相关')).toBe('other')
  })
  it('uses the stored kind when it is set, over the word and over mutual', () => {
    expect(linkKind('相关', false, 'setup')).toBe('setup')
    expect(linkKind('导致', false, 'reveal')).toBe('reveal')
    expect(linkKind('同时', true, 'cause')).toBe('cause')
    expect(linkKind('', false, 'echo')).toBe('echo')
  })
  it('falls back to the word rule, mutual included, when the stored kind is null or absent', () => {
    expect(linkKind('伏笔', false, null)).toBe('setup')
    expect(linkKind('伏笔', true, null)).toBe('echo')
    expect(linkKind('相关', false, undefined)).toBe('other')
  })
  it('draws a link by its stored kind', () => {
    const stored = project([
      ev('a', 1, 'act'),
      { ...ev('b', 2, 'act'), metadata: { act: 'act', links: [{ event: 'a', relation: '相关', mutual: false, incoming: false, kind: 'reveal' }] } },
    ])
    expect(buildCausality(stored).edges.map(e => [e.kind, e.from, e.to])).toEqual([['reveal', 'a', 'b']])
    expect(kindCounts(project([ev('a', 1, 'act', [['b', '相关']]), ev('b', 2, 'act')])).get('other')).toBe(1)
  })
})

describe('buildCausality', () => {
  const data = project([
    ev('a', 1, 'one', [['b', '导致'], ['c', '伏笔']], true),
    ev('b', 2, 'one', [['c', '导致'], ['d', '同时', true]]),
    ev('c', 3, 'two', [['a', '揭示']]),
    ev('d', 4, 'two'),
    ev('lone', 5, 'two'),
  ])
  const c = buildCausality(data)

  it('draws the linked events only, in story order', () => {
    expect(c.nodes.map(n => n.key)).toEqual(['a', 'b', 'c', 'd'])
    expect(c.nodes[0]).toMatchObject({ id: 'a', act: 'one', order: 0, core: true })
  })
  it('keeps each link once, though both ends carry it', () => {
    expect(c.edges).toHaveLength(5)
    expect(kindCounts(data)).toEqual(new Map([['cause', 2], ['setup', 1], ['echo', 1], ['reveal', 1]]))
  })
  it('points a reveal from the revealed event to the one that reveals it', () => {
    expect(c.edges.find(e => e.kind === 'reveal')).toMatchObject({ from: 'a', to: 'c' })
  })
  it('follows chains over directed links only', () => {
    expect(downstream(c, 'a')).toEqual(new Set(['b', 'c']))
    expect(upstream(c, 'c')).toEqual(new Set(['a', 'b']))
    expect(downstream(c, 'b')).toEqual(new Set(['c']))
    expect(c.nodes.map(n => n.reach)).toEqual([2, 1, 0, 0])
    expect(c.longest).toBe(3)
  })
  it('puts the acts in columns, left to right in story order', () => {
    expect(c.acts.map(a => a.name)).toEqual(['one', 'two'])
    const at = (key: string) => c.nodes.find(n => n.key === key)!
    expect(at('c').x).toBeGreaterThan(at('b').x)
    expect(c.acts[0].x1).toBeLessThan(c.acts[1].x0)
    expect(c.width).toBeGreaterThanOrEqual(at('d').x + NODE_W / 2)
  })
  it('drops the links of hidden kinds, and the events left without one', () => {
    const causes = buildCausality(data, new Set(['cause']))
    expect(causes.nodes.map(n => n.key)).toEqual(['a', 'b', 'c'])
    expect(causes.edges.every(e => e.kind === 'cause')).toBe(true)
    expect(buildCausality(data, new Set()).nodes).toEqual([])
  })
  it('is the same for the same input', () => {
    expect(buildCausality(data)).toEqual(c)
  })
  it('survives a cycle in the data', () => {
    const loop = buildCausality(project([ev('x', 1, 'one', [['y', '导致']]), ev('y', 2, 'one', [['z', '导致']]), ev('z', 3, 'one', [['x', '导致']])]))
    expect(downstream(loop, 'x')).toEqual(new Set(['y', 'z']))
    expect(upstream(loop, 'x')).toEqual(new Set(['y', 'z']))
    expect(loop.longest).toBe(3)
  })
  it('reads an assembled project', () => {
    const demo = buildCausality(assemble(fixture))
    expect(demo.edges.map(e => [e.from, e.to, e.kind])).toEqual([['flood', 'start', 'cause'], ['start', 'end', 'cause']])
    expect(demo.longest).toBe(3)
  })
})

describe('orderRows', () => {
  it('uncrosses two links between two columns', () => {
    const rows = orderRows([['a1', 'a2'], ['b1', 'b2']], [{ from: 'a1', to: 'b2' }, { from: 'a2', to: 'b1' }], 2)
    expect(rows.get('a1')).toBe(rows.get('b2'))
    expect(rows.get('a2')).toBe(rows.get('b1'))
  })
  it('keeps a chain level and the rows of a column distinct', () => {
    const rows = orderRows([['a', 'x', 'y'], ['b'], ['c']], [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }], 3)
    expect(new Set([rows.get('a'), rows.get('x'), rows.get('y')]).size).toBe(3)
    expect(rows.get('b')).toBe(rows.get('a'))
    expect(rows.get('c')).toBe(rows.get('a'))
  })
})

describe('rowCount', () => {
  it('adds rows until the drawing is not much wider than high', () => {
    expect(rowCount([1, 1])).toBe(1)
    const rows = rowCount([20, 20, 20])
    expect(rows).toBeGreaterThan(3)
    expect(rows).toBeLessThan(20)
  })
})

describe('shortTitle', () => {
  it('cuts a long title with an ellipsis and leaves a short one', () => {
    expect(shortTitle('第二次冲击')).toBe('第二次冲击')
    expect(shortTitle('唯在初号机接触实验中消失')).toBe('唯在初号机接触实…')
    expect(shortTitle('A short one')).toBe('A short one')
  })
  it('leaves no space before the ellipsis', () => {
    expect(shortTitle('Books 9–12 · The tale', 10)).toBe('Books 9–12 · The…')
  })
})

describe('actLabel', () => {
  it('cuts an act name that is wider than its band, so it does not run into the next act', () => {
    // One column: a band of 132px holds about 10 CJK characters or 18 Latin letters.
    expect(actLabel('Books 9–12 · The tale in Alcinous’s hall', 0, NODE_W)).toBe('Books 9–12 · The…')
    expect(actLabel('第一幕：王生在路上遇见美女并带她回家', 0, NODE_W)).toBe('第一幕：王生在路上…')
  })
  it('keeps a name that fits, and gives a wider band more of it', () => {
    expect(actLabel('一 · 惑', 0, NODE_W)).toBe('一 · 惑')
    expect(actLabel('Books 9–12 · The tale in Alcinous’s hall', 0, 3 * NODE_W)).toBe('Books 9–12 · The tale in Alcinous’s hall')
  })
  it('labels every act of a drawing, within its band', () => {
    const c = buildCausality(assemble(fixture))
    for (const a of c.acts) expect(a.label).toBe(actLabel(a.name, a.x0, a.x1))
  })
})

describe('edgePath', () => {
  it('leaves the facing sides, and bows out right within a column', () => {
    expect(edgePath({ x: 0, y: 0 }, { x: 300, y: 50 })).toMatch(new RegExp(`^M${NODE_W / 2} 0C`))
    expect(edgePath({ x: 300, y: 0 }, { x: 0, y: 0 })).toMatch(new RegExp(`^M${300 - NODE_W / 2} 0C`))
    expect(edgePath({ x: 0, y: 0 }, { x: 0, y: 88 })).toMatch(new RegExp(`^M${NODE_W / 2} 0C${NODE_W / 2 + 46}`))
  })
})

describe('causalStart', () => {
  const box = { w: 800, h: 500 }
  it('fits the height of a short drawing, never above 1:1', () => {
    expect(causalStart(box, { width: 2000, height: 200 }).k).toBe(1)
    const k = causalStart(box, { width: 2000, height: 450 }).k
    expect(k).toBeGreaterThanOrEqual(READABLE_ZOOM)
    expect(k).toBeLessThan(1)
  })
  it('starts a tall drawing at a readable scale, at the top left or at the focus', () => {
    const tall = { width: 3000, height: 1200 }
    const v = causalStart(box, tall)
    expect(v.k).toBe(READABLE_ZOOM)
    // The first act's left edge and the act names are on screen.
    expect(v.x).toBeGreaterThan(0)
    expect(v.y).toBeGreaterThan(0)
    const f = causalStart(box, tall, false, { x: 1500, y: 900 })
    expect(f.k).toBe(READABLE_ZOOM)
    expect(1500 * f.k + f.x).toBeCloseTo(box.w / 2)
    expect(900 * f.k + f.y).toBeCloseTo(box.h / 2)
  })
  it('fits everything with whole, however small', () => {
    const v = causalStart(box, { width: 3000, height: 1200 }, true)
    expect(v.k).toBeLessThan(READABLE_ZOOM)
    expect(v.k * (3000 + 76)).toBeLessThanOrEqual(box.w + 1e-9)
  })
})
