import { describe, expect, it } from 'vitest'
import type { Character, Participant, ProjectData, StoryEvent } from '../data/types'
import { buildGraph, edgeLabelText } from '../relations/graph'
import { actStarts, drawnAt, edgeAt, factionMembers, factionsHeld, isAfter, knownAt, makeCursor, phaseAt, stageAt, statusesAt, stepKey, storyAsOf, storyEvents, storyOrder, type Status } from './state'

const ev = (key: string, sort: number, participants: Participant[] = [], act = 'one'): StoryEvent => ({
  id: `id-${key}`, key, title: key.toUpperCase(), description: null, character_ids: participants.map(p => p.character_id),
  is_core: false, sort_order: sort, metadata: { act, participants },
})
const person = (id: string, relations: Character['metadata']['relations'] = []): Character =>
  ({ key: id, name: id, description: null, metadata: { kind: 'person', category: 'main', relations } })

// Out of list order on purpose: story order comes from sort_order.
const events = [
  ev('c', 30, [{ character_id: 'hero', exit: 'leaves' }, { character_id: 'ghost', presence: 'body', exit: 'dies' }], 'two'),
  ev('a', 10, [{ character_id: 'hero', presence: 'body' }, { character_id: 'ghost', presence: 'body' }]),
  ev('b', 20, [{ character_id: 'late', presence: 'mentioned' }]),
  ev('d', 40, [{ character_id: 'hero', presence: 'spirit' }, { character_id: 'ghost', presence: 'spirit' }], 'two'),
  ev('e', 50, [{ character_id: 'hero', presence: 'body' }], 'three'),
]
const data: ProjectData = { id: 'p', name: 'p', events, characters: [person('hero'), person('ghost'), person('late'), person('never')] }
const order = storyOrder(events)

describe('storyOrder', () => {
  it('follows sort_order, not list order', () => {
    expect([...order]).toEqual([['a', 0], ['b', 1], ['c', 2], ['d', 3], ['e', 4]])
  })
  it('puts an unknown key past the end', () => {
    expect(isAfter(order, 4, 'nowhere')).toBe(true)
    expect(isAfter(order, 1, 'b')).toBe(false)
  })
})

describe('phaseAt', () => {
  it('starts at `since`, inclusive, and ends at `until`, inclusive', () => {
    const span = { since: 'b', until: 'd' }
    expect([0, 1, 2, 3, 4].map(at => phaseAt(span, order, at))).toEqual(['future', 'active', 'active', 'ended', 'ended'])
  })
  it('reads a missing `since` as the start and a missing `until` as the end', () => {
    expect(phaseAt({}, order, 0)).toBe('active')
    expect(phaseAt({ until: 'a' }, order, 0)).toBe('ended')
    expect(phaseAt({ since: 'e' }, order, 4)).toBe('active')
  })
  it('never starts at an unknown `since`, and never ends at an unknown `until`', () => {
    expect(phaseAt({ since: 'nowhere' }, order, 4)).toBe('future')
    expect(phaseAt({ until: 'nowhere' }, order, 4)).toBe('active')
  })
})

describe('statusesAt', () => {
  const at = (i: number) => Object.fromEntries([...statusesAt(data, order, i)].map(([id, s]) => [id, s.kind]))
  it('is unseen before the first appearance, a mention included', () => {
    expect(at(0)).toEqual({ hero: 'present', ghost: 'present', late: 'unseen', never: 'present' })
    expect(at(1).late).toBe('present')
  })
  it('marks an exit at the cursor event itself, with the event', () => {
    expect(at(2)).toMatchObject({ hero: 'left', ghost: 'dead' })
    expect(statusesAt(data, order, 2).get('ghost')).toEqual({ kind: 'dead', event: 'c' })
  })
  it('brings back one who left only in person, and never the dead', () => {
    expect(at(3)).toMatchObject({ hero: 'left', ghost: 'dead' })
    expect(at(4)).toMatchObject({ hero: 'present', ghost: 'dead' })
  })
  it('counts one who appears nowhere as present all through', () => {
    expect(at(0).never).toBe('present')
  })
})

describe('stageAt', () => {
  it('takes the last beat reached, and lets a leading untimed beat hold from the start', () => {
    const beats = [{ stage: 'calm' }, { stage: 'call', since: 'b' }, { stage: 'aside' }, { stage: 'fall', since: 'd' }]
    expect([0, 1, 2, 3].map(at => stageAt(beats, order, at))).toEqual([0, 1, 1, 3])
  })
  it('has no stage before the first timed beat, or in an arc without one', () => {
    expect(stageAt([{ stage: 'call', since: 'c' }], order, 1)).toBeUndefined()
    expect(stageAt([{ stage: 'a' }, { stage: 'b' }], order, 4)).toBeUndefined()
  })
})

describe('knownAt', () => {
  it('keeps what is learned at or before the cursor and not forgotten yet', () => {
    const items = [
      { key: 'old', text: '', kind: 'knowledge' },
      { key: 'new', text: '', kind: 'knowledge', since: 'c' },
      { key: 'lost', text: '', kind: 'knowledge', since: 'a', until: 'c' },
    ]
    expect(knownAt(items, order, 1).map(k => k.key)).toEqual(['old', 'lost'])
    expect(knownAt(items, order, 2).map(k => k.key)).toEqual(['old', 'new'])
  })
})

describe('edgeAt', () => {
  const pair: ProjectData = {
    ...data,
    characters: [
      person('hero', [
        { character_id: 'ghost', label: '朋友', mutual: true, member: false, incoming: false, until: 'c' },
        { character_id: 'ghost', label: '敌人', mutual: true, member: false, incoming: false, since: 'c' },
        { character_id: 'late', label: '师父', mutual: false, member: false, incoming: false, since: 'd' },
        { character_id: 'never', label: '同学', mutual: true, member: false, incoming: false, until: 'b' },
      ]),
      person('ghost'), person('late'), person('never'),
    ],
  }
  const edges = buildGraph(pair).edges
  const edge = (to: string) => edges.find(e => e.to === to)!
  it('shows the relation that holds, with the one it replaced', () => {
    expect(edgeAt(edge('ghost'), order, 0)).toEqual({ phase: 'active', label: '朋友', previous: undefined, tone: 'friend' })
    const later = edgeAt(edge('ghost'), order, 2)
    expect(later).toEqual({ phase: 'active', label: '敌人', previous: '朋友', tone: 'hostile' })
    expect(edgeLabelText(later)).toBe('朋友 → 敌人')
  })
  it('is future before every row starts, and ended after every row ends', () => {
    expect(edgeAt(edge('late'), order, 2).phase).toBe('future')
    expect(edgeAt(edge('late'), order, 3).phase).toBe('active')
    expect(edgeAt(edge('never'), order, 0).phase).toBe('active')
    expect(edgeAt(edge('never'), order, 1)).toMatchObject({ phase: 'ended', label: '同学' })
  })
  it('counts what the graph draws at the cursor', () => {
    const graph = buildGraph(pair)
    expect(drawnAt(graph)).toMatchObject({ nodeCount: graph.nodes.length, edgeCount: graph.edges.length })
    // At c: 'late' is not introduced yet, so it and its relation (which starts at d) are not drawn; the ended one still is.
    const status = new Map<string, Status>([['late', { kind: 'unseen' }]])
    const at = drawnAt(graph, { order, at: 2, status })
    expect(at.nodeCount).toBe(graph.nodes.length - 1)
    expect(at.edgeCount).toBe(graph.edges.length - 1)
    expect(at.edges[graph.edges.findIndex(e => e.to === 'late')]).toBe(false)
    expect(at.edges[graph.edges.findIndex(e => e.to === 'never')]).toBe(true)
  })
})

describe('makeCursor', () => {
  it('needs a key of the project', () => {
    expect(makeCursor(data, order, undefined)).toBeUndefined()
    expect(makeCursor(data, order, 'nowhere')).toBeUndefined()
    const cursor = makeCursor(data, order, 'c')!
    expect(cursor.at).toBe(2)
    expect(cursor.event.key).toBe('c')
    expect(cursor.status.get('ghost')?.kind).toBe('dead')
  })
})

describe('stepKey', () => {
  const sorted = storyEvents(events)
  it('steps in story order and stays inside the story', () => {
    expect(stepKey(sorted, 'b', 1)).toBe('c')
    expect(stepKey(sorted, 'a', -1)).toBe('a')
    expect(stepKey(sorted, 'e', 1)).toBe('e')
  })
  it('starts at the last event going back, and at the first going on', () => {
    expect(stepKey(sorted, undefined, -1)).toBe('e')
    expect(stepKey(sorted, undefined, 1)).toBe('a')
  })
})

describe('actStarts', () => {
  it('marks the first event of each act', () => {
    expect(actStarts(storyEvents(events))).toEqual([{ index: 0, act: 'one' }, { index: 2, act: 'two' }, { index: 4, act: 'three' }])
  })
})

describe('factionsHeld', () => {
  // In the guard from b on; in the old order until c, so not at c.
  const factions = [{ id: 'old', ended: true, until: 'c' }, { id: 'guard', ended: false, since: 'b' }]
  it('keeps the memberships that hold at the cursor, as phaseAt reads them', () => {
    expect([0, 1, 2, 3].map(at => factionsHeld(factions, { order, at }))).toEqual([['old'], ['old', 'guard'], ['guard'], ['guard']])
  })
  it('keeps every membership without a cursor', () => {
    expect(factionsHeld(factions)).toEqual(['old', 'guard'])
  })
  it('counts the members of each faction', () => {
    const nodes = [{ id: 'x', name: 'x', main: true, factions, cluster: 'old', r: 1 }, { id: 'y', name: 'y', main: true, factions: [factions[1]], cluster: 'guard', r: 1 }]
    expect([...factionMembers(nodes, { order, at: 0 })]).toEqual([['old', 1]])
    expect([...factionMembers(nodes, { order, at: 2 })]).toEqual([['guard', 2]])
    expect([...factionMembers(nodes)]).toEqual([['old', 1], ['guard', 2]])
  })
})

describe('storyAsOf', () => {
  const rich: ProjectData = {
    ...data,
    events: events.map(e => (e.key === 'a'
      ? { ...e, metadata: { ...e.metadata, links: [{ event: 'b', relation: '导致', mutual: false, incoming: false }, { event: 'e', relation: '伏笔', mutual: false, incoming: false }], learns: [{ key: 'k', who: ['hero', 'late'], text: 'fact' }] } }
      : e)),
    characters: [
      person('hero', [
        { character_id: 'ghost', label: '朋友', mutual: true, member: false, incoming: false, until: 'c' },
        { character_id: 'ghost', label: '敌人', mutual: true, member: false, incoming: false, since: 'c', until: 'e' },
        { character_id: 'ghost', label: '恋人', mutual: true, member: false, incoming: false, since: 'e' },
        { character_id: 'late', label: '同学', mutual: true, member: false, incoming: false },
      ]),
      { ...person('ghost'), metadata: { ...person('ghost').metadata, knowledge: [
        { key: 'k1', text: 'one', kind: 'knowledge', since: 'a', until: 'b' },
        { key: 'k2', text: 'two', kind: 'knowledge', since: 'a', until: 'e' },
        { key: 'k3', text: 'three', kind: 'knowledge', since: 'd' },
      ], reading: { beats: [{ stage: 'first', since: 'a' }, { stage: 'untimed' }, { stage: 'later', since: 'd' }] } } },
      person('late'), person('never'),
    ],
  }
  const asOf = (key: string) => storyAsOf(rich, makeCursor(rich, order, key)!)
  const of = (d: ProjectData, id: string) => d.characters.find(c => c.key === id)

  it('drops the events after the cursor and the people not introduced yet', () => {
    const d = asOf('a')
    expect(d.events.map(e => e.key)).toEqual(['a'])
    expect(d.characters.map(c => c.key)).toEqual(['hero', 'ghost', 'never'])
  })
  it('drops links and learners that reach what is gone', () => {
    const a = asOf('a').events[0].metadata
    expect(a.links).toEqual([])
    expect(a.learns).toEqual([{ key: 'k', who: ['hero'], text: 'fact' }])
    expect(asOf('b').events.find(e => e.key === 'a')!.metadata.links!.map(l => l.event)).toEqual(['b'])
  })
  it('keeps relations by phase: ended ones as history, open ones without their future end', () => {
    // At `a`, the friendship still holds, so its end at `c` is not known yet; `late` is not in the story.
    expect(of(asOf('a'), 'hero')!.metadata.relations).toEqual([{ character_id: 'ghost', label: '朋友', mutual: true, member: false, incoming: false }])
    expect(of(asOf('c'), 'hero')!.metadata.relations!.map(r => [r.label, r.since, r.until])).toEqual([
      ['朋友', undefined, 'c'], ['敌人', 'c', undefined], ['同学', undefined, undefined],
    ])
  })
  it('keeps knowledge and arc stages by phase too', () => {
    const ghost = of(asOf('b'), 'ghost')!.metadata
    expect(ghost.knowledge!.map(k => [k.key, k.until])).toEqual([['k1', 'b'], ['k2', undefined]])
    expect(ghost.reading!.beats!.map(b => b.stage)).toEqual(['first', 'untimed'])
  })
  it('keeps the whole story at the last event, apart from ends that are never reached', () => {
    const d = asOf('e')
    expect(d.events).toHaveLength(events.length)
    expect(d.characters.map(c => c.key)).toEqual(rich.characters.map(c => c.key))
  })
})
