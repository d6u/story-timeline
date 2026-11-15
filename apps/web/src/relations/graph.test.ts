import { describe, expect, it } from 'vitest'
import { storyEvents } from '../cursor/state'
import type { Character, ProjectData } from '../data/types'
import { applyForces, buildGraph, createSimulation, defaultForces, defaultGraphOptions, edgeEnds, edgeLabelEvent, edgeLabelText, extent, LABEL_LIMIT, labelMode, MAIN_R, matchPeople, MINOR_R, mergeSpans, neighbourhood, seedNodes, toneCounts, type RelationSpan } from './graph'

const person = (id: string, category: string | undefined, relations: Character['metadata']['relations'] = [], kind = 'person'): Character =>
  ({ key: id, name: id, description: null, metadata: { kind, category, relations } })

const data: ProjectData = {
  id: 'p', name: 'p',
  events: [],
  characters: [
    person('valley', 'faction', [], 'group'),
    person('empire', 'faction', [], 'group'),
    person('hero', 'main', [
      { character_id: 'valley', label: '成员', mutual: false, member: true, incoming: false },
      { character_id: 'mentor', label: '师父', mutual: false, member: false, incoming: false },
      { character_id: 'rival', label: '敌人', mutual: true, member: false, incoming: false },
    ]),
    person('mentor', 'minor', [
      { character_id: 'valley', label: '成员', mutual: false, member: true, incoming: false },
      { character_id: 'hero', label: '师父', mutual: false, member: false, incoming: true },
    ]),
    person('rival', 'main', [
      { character_id: 'empire', label: '成员', mutual: false, member: true, incoming: false },
      { character_id: 'hero', label: '敌人', mutual: true, member: false, incoming: true },
      { character_id: 'aide', label: '参谋', mutual: false, member: false, incoming: false },
    ]),
    person('aide', 'minor', [{ character_id: 'rival', label: '参谋', mutual: false, member: false, incoming: true }]),
    person('loner', 'minor', [{ character_id: 'other', label: '朋友', mutual: true, member: false, incoming: false }]),
    person('other', 'minor', [{ character_id: 'loner', label: '朋友', mutual: true, member: false, incoming: true }]),
  ],
}

describe('buildGraph', () => {
  it('draws main characters and their partners, with their faction tags', () => {
    const g = buildGraph(data)
    expect(g.nodes.map(n => n.id).sort()).toEqual(['aide', 'hero', 'mentor', 'rival'])
    // Factions largest first, each with a palette colour.
    expect(g.factions).toEqual([
      { id: 'valley', name: 'valley', color: 'var(--person-4)', members: 2 },
      { id: 'empire', name: 'empire', color: 'var(--person-5)', members: 1 },
    ])
    expect(g.nodes.find(n => n.id === 'hero')?.factions).toEqual([{ id: 'valley', ended: false }])
    expect(g.nodes.find(n => n.id === 'aide')?.factions).toEqual([])
    // A main character draws larger.
    expect(g.nodes.find(n => n.id === 'hero')?.r).toBe(MAIN_R)
    expect(g.nodes.find(n => n.id === 'aide')?.r).toBe(MINOR_R)
    // Each relation is one edge, from its owner, marked when the ends share no faction.
    expect(g.edges.map(e => [e.from, e.to, e.between])).toEqual([['hero', 'mentor', false], ['hero', 'rival', true], ['rival', 'aide', true]])
  })
  it('adds the unaffiliated and minor characters on request', () => {
    const g = buildGraph(data, { ...defaultGraphOptions, showMinor: true })
    expect(g.nodes.map(n => n.id).sort()).toEqual(['aide', 'hero', 'loner', 'mentor', 'other', 'rival'])
  })
  it('tags a character with every faction it belongs to, and keeps the group colour', () => {
    const dual: ProjectData = {
      ...data,
      characters: [
        { ...person('valley', 'faction', [], 'group'), metadata: { kind: 'group', category: 'faction', relations: [], color: 'oklch(0.5 0.1 100)' } },
        person('empire', 'faction', [], 'group'),
        person('hero', 'main', [
          { character_id: 'valley', label: '出身', mutual: false, member: true, incoming: false },
          { character_id: 'empire', label: '成员', mutual: false, member: true, incoming: false, until: 'war' },
          { character_id: 'rival', label: '敌人', mutual: true, member: false, incoming: false },
        ]),
        person('rival', 'main', [{ character_id: 'empire', label: '成员', mutual: false, member: true, incoming: false }]),
      ],
    }
    const g = buildGraph(dual)
    expect(g.nodes.find(n => n.id === 'hero')?.factions).toEqual([{ id: 'valley', ended: false }, { id: 'empire', ended: true, until: 'war' }])
    expect(g.factions.map(f => [f.id, f.color, f.members])).toEqual([['empire', 'var(--person-4)', 2], ['valley', 'oklch(0.5 0.1 100)', 1]])
    // The two share a faction, so the edge is not between factions.
    expect(g.edges[0].between).toBe(false)
  })
  it('filters relations by tone', () => {
    const g = buildGraph(data, { ...defaultGraphOptions, tones: new Set(['hostile']) })
    expect(g.edges.map(e => e.label)).toEqual(['敌人'])
  })
  it('gives the same graph for the same input', () => {
    expect(buildGraph(data)).toEqual(buildGraph(data))
  })
  it('counts tones over the owners only', () => {
    expect([...toneCounts(data)]).toEqual([['work', 2], ['hostile', 1], ['friend', 1]])
  })
  it('uses the stored tone when set, the word when not, and never counts a membership', () => {
    const stored: ProjectData = {
      ...data,
      characters: data.characters.map(c => c.key !== 'hero' ? c : person('hero', 'main', [
        { character_id: 'valley', label: '成员', mutual: false, member: true, incoming: false, tone: 'hostile' },
        { character_id: 'mentor', label: '师父', mutual: false, member: false, incoming: false, tone: 'family' },
        { character_id: 'rival', label: '敌人', mutual: true, member: false, incoming: false, tone: 'other' },
      ])),
    }
    expect([...toneCounts(stored)]).toEqual([['family', 1], ['neutral', 1], ['work', 1], ['friend', 1]])
    const g = buildGraph(stored, { ...defaultGraphOptions, tones: new Set(['family', 'neutral']) })
    expect(g.edges.map(e => [e.label, e.tone])).toEqual([['师父', 'family'], ['敌人', 'neutral']])
    // The membership with a stored tone stays a faction tag, not an edge.
    expect(buildGraph(stored).nodes.find(n => n.id === 'hero')?.factions).toEqual([{ id: 'valley', ended: false }])
    expect(buildGraph(stored, { ...defaultGraphOptions, tones: new Set(['hostile']) }).edges).toEqual([])
  })
})

describe('mergeSpans', () => {
  const order = new Map([['pact', 0], ['heist', 1], ['end', 2]])
  const ev = (key: string) => ({ key, title: key.toUpperCase(), known: true })
  const span = (from: string, to: string, label: string, since?: string, until?: string, mutual = false): RelationSpan =>
    ({ from, to, label, tone: label === '敌人' ? 'hostile' : label === '搭档' ? 'work' : 'neutral', mutual, since: since ? ev(since) : undefined, until: until ? ev(until) : undefined })

  it('shows the current relation and remembers the one it replaced', () => {
    const e = mergeSpans([span('rook', 'warden', '敌人', 'pact'), span('rook', 'warden', '搭档', undefined, 'pact')], order)
    expect(e.spans.map(sp => sp.label)).toEqual(['搭档', '敌人'])
    expect(e.label).toBe('敌人')
    expect(e.previous).toBe('搭档')
    expect(e.tone).toBe('hostile')
    expect(e.ended).toBe(false)
    expect(edgeLabelText(e)).toBe('搭档 → 敌人')
    expect(e.since?.key).toBe('pact')
  })
  it('names the start event of a single relation, and the end event of an ended one', () => {
    const started = mergeSpans([span('guard', 'scout', '同伴', 'heist')], order)
    expect(edgeLabelEvent(started)?.title).toBe('HEIST')
    const ended = mergeSpans([span('a', 'b', '旧友', undefined, 'end')], order)
    expect(edgeLabelEvent(ended)?.title).toBe('END')
    expect(mergeSpans([span('a', 'b', '师父')], order).since).toBeUndefined()
  })
  it('joins relations that hold at the same time', () => {
    const e = mergeSpans([span('k', 's', '参谋'), span('k', 's', '刺客', undefined, 'heist'), span('k', 's', '右臂', 'heist')], order)
    expect(e.label).toBe('参谋 · 右臂')
    expect(e.previous).toBe('刺客')
    // 参谋 holds from the start, so the pair has no start event.
    expect(e.since).toBeUndefined()
  })
  it('marks a pair whose every relation has ended', () => {
    const e = mergeSpans([span('a', 'b', '旧友', undefined, 'end', true)], order)
    expect(e.ended).toBe(true)
    expect(e.label).toBe('旧友')
    expect(e.previous).toBeUndefined()
  })
  it('draws a pair that names each other as one line without an arrow', () => {
    const e = mergeSpans([span('a', 'b', '姐姐'), span('b', 'a', '妹妹')], order)
    expect(e.mutual).toBe(true)
    expect(e.label).toBe('姐姐 · 妹妹')
  })
  it('keeps the arrow when every current relation points the same way', () => {
    const e = mergeSpans([span('a', 'b', '师父')], order)
    expect(e.mutual).toBe(false)
    expect([e.from, e.to]).toEqual(['a', 'b'])
  })
})

describe('buildGraph with relation history', () => {
  it('folds the rows of a pair into one edge and resolves its events', () => {
    const d: ProjectData = {
      ...data,
      events: [
        { id: 'e1', key: 'pact', title: '桥上的协议', description: null, character_ids: [], is_core: true, sort_order: 10, metadata: {} },
      ],
      characters: [
        person('rook', 'main', [
          { character_id: 'warden', label: '搭档', mutual: false, member: false, incoming: false, until: 'pact' },
          { character_id: 'warden', label: '敌人', mutual: true, member: false, incoming: false, since: 'pact' },
        ]),
        person('warden', 'main', []),
      ],
    }
    const g = buildGraph(d)
    expect(g.edges).toHaveLength(1)
    expect(g.edges[0].label).toBe('敌人')
    expect(g.edges[0].previous).toBe('搭档')
    expect(g.edges[0].spans[0].until).toEqual({ key: 'pact', title: '桥上的协议', known: true })
  })
  it('orders the rows by story order, with the key breaking a sort_order tie as the cursor does', () => {
    const event = (key: string) => ({ id: key, key, title: key, description: null, character_ids: [], is_core: false, sort_order: 5, metadata: {} })
    const d: ProjectData = {
      ...data,
      // Tied sort_order, listed against key order: the story reads `alpha`, then `zeta`.
      events: [event('zeta'), event('alpha')],
      characters: [
        person('rook', 'main', [
          { character_id: 'warden', label: '搭档', mutual: false, member: false, incoming: false, until: 'alpha' },
          { character_id: 'warden', label: '敌人', mutual: false, member: false, incoming: false, until: 'zeta' },
        ]),
        person('warden', 'main', []),
      ],
    }
    expect(storyEvents(d.events).map(e => e.key)).toEqual(['alpha', 'zeta'])
    const [e] = buildGraph(d).edges
    // Every row has ended, so the one that ended last in story order makes the label.
    expect(e.spans.map(sp => sp.label)).toEqual(['搭档', '敌人'])
    expect(e.label).toBe('敌人')
    expect(e.ended).toBe(true)
  })
})

describe('layout', () => {
  const g = buildGraph(data, { ...defaultGraphOptions, showMinor: true })
  const settle = (nodes = seedNodes(g)) => {
    const sim = createSimulation(nodes, g.edges)
    sim.tick(300)
    return sim.nodes()
  }
  const dist = (a: { x: number; y: number }, b: typeof a) => Math.hypot(a.x - b.x, a.y - b.y)
  it('starts every node at a fresh, repeatable place', () => {
    const a = seedNodes(g)
    expect(a.map(n => n.id)).toEqual(g.nodes.map(n => n.id))
    expect(a).toEqual(seedNodes(g))
    // Members of one faction start together, apart from the other faction.
    const at = (id: string) => a.find(n => n.id === id)!
    expect(dist(at('hero'), at('mentor'))).toBeLessThan(dist(at('hero'), at('rival')))
  })
  it('keeps the place of a node that was already there', () => {
    const before = seedNodes(buildGraph(data)).map(n => ({ ...n, x: n.x + 500, y: n.y + 500 }))
    const after = seedNodes(g, before)
    for (const p of before) expect(after.find(n => n.id === p.id)).toMatchObject({ x: p.x, y: p.y })
    // A newcomer with no faction starts near nobody in particular, but a member starts by its faction.
    expect(after.find(n => n.id === 'loner')).toBeDefined()
  })
  it('settles with the members of a faction closer than outsiders, and no circles overlapping', () => {
    const nodes = settle()
    const at = (id: string) => nodes.find(n => n.id === id)!
    expect(dist(at('hero'), at('mentor'))).toBeLessThan(dist(at('hero'), at('rival')))
    expect(dist(at('hero'), at('mentor'))).toBeLessThan(dist(at('mentor'), at('rival')))
    for (const a of nodes) for (const b of nodes) if (a !== b) expect(dist(a, b)).toBeGreaterThan(a.r + b.r)
    // Everybody ends up near the origin, where gravity pulls.
    const box = extent(nodes)
    expect(Math.abs((box.minX + box.maxX) / 2)).toBeLessThan(150)
    expect(Math.abs((box.minY + box.maxY) / 2)).toBeLessThan(150)
  })
  it('settles to the same picture every run', () => {
    expect(settle()).toEqual(settle())
  })
  it('spreads out with more repulsion or longer links, and gathers factions with more pull', () => {
    const spread = (forces: typeof defaultForces) => {
      const sim = createSimulation(seedNodes(g), g.edges, forces)
      sim.tick(300)
      const box = extent(sim.nodes())
      return (box.maxX - box.minX) * (box.maxY - box.minY)
    }
    const base = spread(defaultForces)
    expect(spread({ ...defaultForces, repel: 2.5 })).toBeGreaterThan(base)
    expect(spread({ ...defaultForces, distance: 2.5 })).toBeGreaterThan(base)
    const faction = (forces: typeof defaultForces) => {
      const sim = createSimulation(seedNodes(g), g.edges, forces)
      sim.tick(300)
      const at = (id: string) => sim.nodes().find(n => n.id === id)!
      return dist(at('hero'), at('mentor'))
    }
    expect(faction({ ...defaultForces, cluster: 3 })).toBeLessThan(faction({ ...defaultForces, cluster: 0.2 }))
  })
  it('takes new strengths into a running simulation', () => {
    const sim = createSimulation(seedNodes(g), g.edges)
    sim.tick(300)
    const before = extent(sim.nodes())
    applyForces(sim, { ...defaultForces, repel: 2.5 })
    sim.alpha(1).tick(300)
    const after = extent(sim.nodes())
    expect((after.maxX - after.minX) * (after.maxY - after.minY)).toBeGreaterThan((before.maxX - before.minX) * (before.maxY - before.minY))
  })
  it('measures the box around circles with air', () => {
    expect(extent([{ x: 0, y: 0, r: 10 }, { x: 100, y: 50, r: 5 }], 4)).toEqual({ minX: -14, minY: -14, maxX: 109, maxY: 59 })
  })
})

describe('edgeEnds', () => {
  it('pulls the line in to the rims, further at an arrow head', () => {
    const plain = edgeEnds({ x: 0, y: 0, r: 10 }, { x: 100, y: 0, r: 10 }, false)
    expect(plain).toEqual({ x1: 13, y1: 0, x2: 87, y2: 0 })
    const arrow = edgeEnds({ x: 0, y: 0, r: 10 }, { x: 100, y: 0, r: 10 }, true)
    expect(arrow.x2).toBe(81)
  })
})

describe('relation names, search and focus', () => {
  it('writes every name on a small graph and only the focused ones on a large one', () => {
    expect(labelMode(false, 5)).toBe('none')
    expect(labelMode(true, LABEL_LIMIT)).toBe('all')
    expect(labelMode(true, LABEL_LIMIT + 1)).toBe('focus')
  })
  it('matches a name or an alias, ignoring case, and names no search for an empty query', () => {
    const nodes = [{ id: 'a', name: '李明远' }, { id: 'b', name: 'Anna' }, { id: 'c', name: '王芳' }]
    const aliases = (id: string) => (id === 'c' ? ['Fang'] : undefined)
    expect(matchPeople(nodes, aliases, '  ')).toBeUndefined()
    expect([...matchPeople(nodes, aliases, '明')!]).toEqual(['a'])
    expect([...matchPeople(nodes, aliases, 'ann')!]).toEqual(['b'])
    expect([...matchPeople(nodes, aliases, 'fang')!]).toEqual(['c'])
    expect(matchPeople(nodes, aliases, 'zzz')!.size).toBe(0)
  })
  it('finds the neighbours of a node, both ways', () => {
    const edges = [{ from: 'a', to: 'b' }, { from: 'c', to: 'a' }, { from: 'b', to: 'c' }]
    expect(neighbourhood(edges, 'a')).toEqual(new Set(['a', 'b', 'c']))
    expect(neighbourhood(edges, 'x')).toEqual(new Set(['x']))
  })
})
