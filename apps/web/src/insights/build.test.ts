import { describe, expect, it } from 'vitest'
import { assemble } from '../data/assemble'
import type { Character, CharacterMetadata, EventLink, Participant, ProjectData, StoryEvent } from '../data/types'
import { fixture } from '../test/fixture'
import { makeCursor, storyAsOf, storyOrder } from '../cursor/state'
import { actPresence, buildInsights, buildProblems, filterInsights, insightPeople, involves, narrowTo, storyActs, TOP_COUNT, type Insight } from './build'

type Link = [string, string, boolean?]
const ev = (key: string, sort: number, act: string, who: (string | Participant)[] = [], links: Link[] = []): StoryEvent => {
  const participants = who.map(p => (typeof p === 'string' ? { character_id: p, presence: 'body' } : p))
  return {
    id: `id-${key}`, key, title: key.toUpperCase(), description: null, character_ids: participants.map(p => p.character_id), is_core: false, sort_order: sort,
    metadata: { act, participants, links: links.map(([event, relation, mutual]) => ({ event, relation, mutual: mutual ?? false, incoming: false })) },
  }
}
const person = (id: string, metadata: Partial<CharacterMetadata> = {}): Character =>
  ({ key: id, name: id.toUpperCase(), description: null, metadata: { kind: 'person', category: 'main', ...metadata } })

/** Mirrors links and relations onto the other end, as assemble does. */
function project(events: StoryEvent[], characters: Character[]): ProjectData {
  return {
    id: 'p', name: 'p',
    events: events.map(e => ({
      ...e,
      metadata: {
        ...e.metadata,
        links: [
          ...(e.metadata.links ?? []),
          ...events.flatMap(o => (o.metadata.links ?? []).filter(l => l.event === e.key).map((l): EventLink => ({ ...l, event: o.key, incoming: true }))),
        ],
      },
    })),
    characters: characters.map(c => ({
      ...c,
      metadata: {
        ...c.metadata,
        relations: [
          ...(c.metadata.relations ?? []),
          ...characters.flatMap(o => (o.metadata.relations ?? []).filter(r => r.character_id === c.key).map(r => ({ ...r, character_id: o.key, incoming: true }))),
        ],
      },
    })),
  }
}
const of = <K extends Insight['kind']>(list: Insight[], kind: K) => list.filter((i): i is Extract<Insight, { kind: K }> => i.kind === kind)
const reaching = (list: Insight[], kind: 'root' | 'turningPoint') => list.flatMap(i => (i.kind === kind ? [[i.events[0], i.reach]] : []))
const rel = (character_id: string, label: string, since?: string, until?: string) => ({ character_id, label, mutual: false, member: false, incoming: false, since, until })

describe('causal findings', () => {
  // a → b → c → d → e is the spine; x and y cause d too; s sets up d from far back. r reveals
  // a, so its arrow runs from a to r.
  const data = project([
    ev('s', 1, 'one', [], [['d', '伏笔']]),
    ev('a', 2, 'one', [], [['b', '导致']]),
    ev('b', 3, 'one', [], [['c', '导致']]),
    ev('x', 4, 'one', [], [['d', '导致']]),
    ev('y', 5, 'one', [], [['d', '导致']]),
    ev('c', 6, 'two', [], [['d', '导致']]),
    ev('d', 7, 'two', [], [['e', '导致']]),
    ev('e', 8, 'two'),
    ev('r', 9, 'two', [], [['a', '揭示']]),
  ], [])
  const list = buildInsights(data)

  it('splits events that lead to three or more into roots and turning points', () => {
    expect(reaching(list, 'root')).toEqual([['a', 5]])
    expect(reaching(list, 'turningPoint')).toEqual([['b', 3]])
  })
  it('names the longest chain, first to last', () => {
    expect(of(list, 'chain')[0].events).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
  it('gives each setup its distance in story order', () => {
    expect(of(list, 'setup').map(i => [i.events, i.distance])).toEqual([[['s', 'd'], 6]])
  })
  it('keeps every setup, past the count a list shows at first', () => {
    const far = project(Array.from({ length: 12 }, (_, i) => ev(`e${i}`, i, 'one', [], i === 0 ? Array.from({ length: 11 }, (_, j): Link => [`e${j + 1}`, '伏笔']) : [])), [])
    const setups = of(buildInsights(far), 'setup')
    expect(setups.length).toBeGreaterThan(TOP_COUNT.setup!)
    expect(setups.map(i => i.distance)).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1])
  })
  it('at a cursor, finds only what the story has shown so far', () => {
    const at = (key: string) => buildInsights(storyAsOf(data, makeCursor(data, storyOrder(data.events), key)!))
    // At `b` the chain is a → b, too short, and the setup's payoff `d` has not come yet.
    expect(of(at('b'), 'chain')).toEqual([])
    expect(of(at('b'), 'setup')).toEqual([])
    expect(at('b').flatMap(i => i.events).every(k => ['s', 'a', 'b'].includes(k))).toBe(true)
    // At `d` the setup is paid off; at the last event the list is the whole story's.
    expect(of(at('d'), 'setup').map(i => i.events)).toEqual([['s', 'd']])
    expect(at('r')).toEqual(list)
  })
  it('finds nothing in a story without links', () => {
    expect(buildInsights(project([ev('a', 1, 'one')], [])).filter(i => i.category === 'finding')).toEqual([])
  })
})

describe('dramatic irony', () => {
  const knows = (key: string, since?: string, kind = 'knowledge') => ({ key, text: `${key} text`, kind, since })
  const data = project([
    ev('e1', 1, 'one', ['spy', 'mark']),
    ev('e2', 2, 'one', ['spy', { character_id: 'mark', presence: 'mentioned' }]),
    ev('e3', 3, 'one', ['spy', 'mark', 'other']),
    ev('e4', 4, 'one', ['mark']),
    ev('e5', 5, 'one', ['spy', 'mark']),
    ev('e6', 6, 'one', ['spy', 'mark']),
  ], [
    person('spy', { knowledge: [knows('secret'), knows('dream', undefined, 'idea')] }),
    person('mark', { knowledge: [knows('secret', 'e5'), knows('dream', 'e6', 'idea')] }),
    person('other'),
  ])
  const found = of(buildInsights(data), 'irony')

  it('counts the scenes the unaware character shares with one who knows, before it learns', () => {
    expect(found).toHaveLength(1)
    // e2 is a mention, not a shared scene; e4 has no knower; e5 is where mark learns.
    expect(found[0]).toMatchObject({ learning: 'secret', shared: 2, events: ['e1', 'e3', 'e5'], characters: ['mark', 'spy'] })
  })
  it('leaves out ideas, and characters with no row for the fact', () => {
    expect(found.some(i => i.learning === 'dream')).toBe(false)
    expect(found.some(i => i.characters[0] === 'other')).toBe(false)
  })
  it('needs two shared scenes', () => {
    const one = project([ev('e1', 1, 'one', ['spy', 'mark']), ev('e2', 2, 'one', ['mark'])], [
      person('spy', { knowledge: [knows('secret')] }), person('mark', { knowledge: [knows('secret', 'e2')] }),
    ])
    expect(of(buildInsights(one), 'irony')).toEqual([])
  })
})

describe('relation turns', () => {
  const data = project([ev('a', 1, 'one'), ev('b', 2, 'one'), ev('c', 3, 'one')], [
    person('p', { relations: [rel('q', '朋友', undefined, 'b'), rel('q', '敌人', 'b')] }),
    person('q'),
    person('r', { relations: [rel('p', '同伴', 'a', 'c'), rel('q', '同伴', 'a')] }),
  ])
  const found = of(buildInsights(data), 'turn')

  it('lists pairs whose relation changes before pairs whose relation only ends', () => {
    expect(found.map(i => [i.characters, i.changed, i.events])).toEqual([
      [['p', 'q'], true, ['b']],
      [['r', 'p'], false, ['c']],
    ])
    expect(found[0].spans).toEqual([{ label: '朋友', until: 'b' }, { label: '敌人', since: 'b' }])
  })
  it('does not count a relation that only starts', () => {
    expect(found.some(i => i.characters.includes('r') && i.characters.includes('q'))).toBe(false)
  })
})

describe('pairs', () => {
  const data = project([
    ev('a', 1, 'one', ['p', 'q', 'r']),
    ev('b', 2, 'one', ['p', 'q', 'm']),
    ev('c', 3, 'one', ['p', 'q', 'm', { character_id: 'far', presence: 'mentioned' }]),
    ev('d', 4, 'one', ['far', 'm', 'g']),
  ], [
    person('p', { relations: [rel('far', '父亲'), rel('ghost', '朋友')] }),
    person('q'),
    person('r', { relations: [rel('q', '朋友')] }),
    person('m', { category: 'minor' }),
    person('far', { category: 'minor' }),
    person('ghost'),
    person('g', { kind: 'group' }),
  ])
  const list = buildInsights(data)

  it('finds a related pair who are never on stage together; a mention is no meeting', () => {
    expect(of(list, 'neverMeet').map(i => [i.characters, i.label])).toEqual([[['p', 'far'], '父亲']])
  })
  it('skips a partner who is never on stage at all', () => {
    expect(of(list, 'neverMeet').some(i => i.characters.includes('ghost'))).toBe(false)
  })
  it('finds main characters who share three events with no relation stated', () => {
    expect(of(list, 'unstated').map(i => [i.characters, i.shared])).toEqual([[['p', 'q'], 3]])
  })
})

describe('presence', () => {
  const many = Array.from({ length: 10 }, (_, i) => ev(`e${i}`, i, i < 5 ? 'one' : 'two', i === 0 || i === 9 ? ['lead', 'away'] : ['lead']))
  const data = project([...many, ev('f', 20, 'three', ['lead', 'away'])], [person('lead'), person('away')])
  const list = buildInsights(data)

  it('counts on-stage events per act', () => {
    expect(storyActs(data.events)).toEqual(['one', 'two', 'three'])
    expect(actPresence(data).get('away')).toEqual([1, 1, 1])
  })
  it('names who leads an act of four or more events, with half of them or more', () => {
    expect(of(list, 'dominant').map(i => [i.act, i.characters[0], i.count, i.actSize])).toEqual([['one', 'lead', 5, 5], ['two', 'lead', 5, 5]])
  })
  it('names a long absence and the events around it', () => {
    expect(of(list, 'absence').map(i => [i.characters[0], i.gap, i.events])).toEqual([['away', 8, ['e0', 'e9']]])
  })
  it('names no leader on a tie', () => {
    const tie = project([1, 2, 3, 4].map(i => ev(`e${i}`, i, 'one', ['a', 'b'])), [person('a'), person('b')])
    expect(of(buildInsights(tie), 'dominant')).toEqual([])
  })
})

describe('exits', () => {
  const data = project([
    ev('a', 1, 'one', [{ character_id: 'p', exit: 'dies' }]),
    ev('b', 2, 'two', [{ character_id: 'q', exit: 'dies' }, { character_id: 'r', exit: 'leaves' }]),
  ], [person('p'), person('q'), person('r')])
  const list = buildInsights(data)

  it('counts deaths and leavings per act', () => {
    expect(of(list, 'exitsByAct')[0].acts).toEqual([{ act: 'one', dies: 1, leaves: 0 }, { act: 'two', dies: 1, leaves: 1 }])
  })
  it('names an event where two or more exit', () => {
    expect(of(list, 'exitPeak').map(i => [i.events[0], i.exits, i.characters])).toEqual([['b', 2, ['q', 'r']]])
  })
})

describe('data gaps', () => {
  const data = project([
    ev('a', 1, 'one', ['p'], [['b', '相关']]),
    ev('b', 2, 'one', ['p']),
    ev('lone', 3, 'one'),
  ], [
    person('p', { relations: [rel('q', '朋友'), rel('q', '父亲'), { ...rel('g', '成员'), member: true }], knowledge: [{ key: 'k', text: 'K', kind: 'knowledge' }], reading: { beats: [{ stage: 'call' }] } }),
    person('q', { category: 'minor' }),
    person('g', { kind: 'group' }),
  ])
  const gaps = new Map(buildInsights(data).filter(i => i.category === 'gap').map(i => [i.kind, 'items' in i ? i.items : []]))

  it('lists each gap with its items', () => {
    expect(gaps.get('noParticipants')).toEqual([{ events: ['lone'], characters: [] }])
    expect(gaps.get('isolated')).toEqual([{ events: ['lone'], characters: [] }])
    expect(gaps.get('noEvents')).toEqual([{ events: [], characters: ['q'] }])
    expect(gaps.get('arcNoSince')).toEqual([{ events: [], characters: ['p'], label: 'call' }])
    expect(gaps.get('otherLinks')).toEqual([{ events: ['a', 'b'], characters: [], label: '相关' }])
    expect(gaps.get('knowledgeNoSince')).toEqual([{ events: [], characters: ['p'], label: 'K' }])
  })
  it('needs no start for a family tie or a membership', () => {
    expect(gaps.get('relationNoSince')).toEqual([{ events: [], characters: ['p', 'q'], label: '朋友' }])
  })
  it('leaves out a gap with no item, and a group with no event', () => {
    expect(gaps.has('noArc')).toBe(false)
    expect(gaps.get('noEvents')?.some(item => item.characters.includes('g'))).toBe(false)
  })
  it('misses no link in a project that links no events', () => {
    const plain = buildInsights(project([ev('a', 1, 'one', ['p'])], [person('p')]))
    expect(plain.some(i => i.kind === 'isolated')).toBe(false)
  })
  it('flags a main character with no arc stage', () => {
    expect(buildInsights(project([ev('a', 1, 'one', ['p'])], [person('p')])).find(i => i.kind === 'noArc')).toMatchObject({ items: [{ characters: ['p'] }] })
  })
})

describe('filtering by character', () => {
  const data = assemble(fixture)
  const list = buildInsights(data)
  const byKey = new Map(data.events.map(e => [e.key, e]))

  it('matches the characters an insight names, or else the people in its events', () => {
    const chain = list.find(i => i.kind === 'chain')!
    expect(chain.events).toEqual(['flood', 'start', 'end'])
    expect(involves(chain, 'a', byKey)).toBe(true)
    expect(involves(chain, 'b', byKey)).toBe(false)
    const pair: Insight = { id: 'x', category: 'finding', kind: 'unstated', score: 1, shared: 1, events: ['start'], characters: ['b', 'group'] }
    expect(involves(pair, 'a', byKey)).toBe(false)
  })
  it('narrows a gap to the items that name the character', () => {
    const gap = list.find(i => i.kind === 'noEvents')!
    expect(narrowTo(gap, 'b')).toMatchObject({ items: [{ characters: ['b'] }] })
    expect(narrowTo(gap, 'a')).toMatchObject({ items: [] })
  })
  it('shows one category, narrowed to a character', () => {
    expect(filterInsights(list, { category: 'gap' }, byKey).every(i => i.category === 'gap')).toBe(true)
    expect(filterInsights(list, { category: 'gap', who: 'b' }, byKey).find(i => i.kind === 'noEvents')).toMatchObject({ items: [{ characters: ['b'] }] })
  })
  it('offers the main characters first', () => {
    expect(insightPeople(data, list).map(p => p.character.key)[0]).toBe('a')
  })
  it('gives every insight its own id', () => {
    expect(new Set(list.map(i => i.id)).size).toBe(list.length)
  })
})

describe('data problems', () => {
  const problems = (d: ProjectData) => new Map(buildProblems(d).map(i => [i.kind, 'items' in i ? i.items : []]))
  const dies = (id: string): Participant => ({ character_id: id, presence: 'body', exit: 'dies' })

  it('finds nothing in clean data', () => {
    expect(buildProblems(assemble(fixture))).toEqual([])
  })
  it('flags a membership of a person, with both characters named', () => {
    const d = project([ev('a', 1, 'one', ['p'])], [person('p', { relations: [{ ...rel('q', '成员'), member: true }, { ...rel('g', '成员'), member: true }] }), person('q'), person('g', { kind: 'group' })])
    expect(problems(d).get('memberNotGroup')).toEqual([{ events: [], characters: ['p', 'q'], label: '成员' }])
  })
  it('flags spans that end before they start, in story order', () => {
    const d = project([ev('a', 1, 'one', ['p']), ev('b', 2, 'one', ['p']), ev('c', 3, 'one', ['p'])], [
      person('p', {
        relations: [rel('q', '朋友', 'c', 'a'), rel('q', '敌人', 'a', 'c')],
        knowledge: [{ key: 'k', text: 'K', kind: 'knowledge', since: 'b', until: 'a' }, { key: 'ok', text: 'OK', kind: 'knowledge', since: 'a', until: 'b' }],
        reading: { beats: [{ stage: 'one', since: 'c' }, { stage: 'untimed' }, { stage: 'two', since: 'b' }] },
      }),
      person('q'),
    ])
    expect(problems(d).get('endBeforeStart')).toEqual([
      { events: ['c', 'a'], characters: ['p', 'q'], label: '朋友', note: 'relation' },
      { events: ['b', 'a'], characters: ['p'], label: 'K', note: 'knowledge' },
      { events: ['c', 'b'], characters: ['p'], label: 'one → two', note: 'arcStage' },
    ])
  })
  it('flags a character who dies twice, but not one who leaves and dies', () => {
    const d = project([ev('a', 1, 'one', [dies('p'), { character_id: 'q', exit: 'leaves' }]), ev('b', 2, 'one', [dies('p'), dies('q')])], [person('p'), person('q')])
    expect(problems(d).get('doubleDeath')).toEqual([{ events: ['a', 'b'], characters: ['p'] }])
  })
  it('flags a cycle of parent places once, with the events set there', () => {
    const at = (e: StoryEvent, placeKey: string) => ({ ...e, metadata: { ...e.metadata, placeKey } })
    const d = {
      ...project([at(ev('a', 1, 'one'), 'room'), at(ev('b', 2, 'one'), 'town')], []),
      places: [
        { key: 'room', name: 'Room', realm: 'physical', parent: 'ship' },
        { key: 'ship', name: 'Ship', realm: 'physical', parent: 'room' },
        { key: 'deck', name: 'Deck', realm: 'physical', parent: 'ship' },
        { key: 'town', name: 'Town', realm: 'physical' },
      ],
    }
    expect(problems(d).get('placeCycle')).toEqual([{ events: ['a'], characters: [], label: 'Room → Ship → Room' }])
  })
  it('flags repeated and reversed copies of links and relations, not a second span of a pair', () => {
    const d = project([
      ev('a', 1, 'one', ['p'], [['b', '导致'], ['b', '导致'], ['b', '伏笔'], ['b', '同时', true]]),
      ev('b', 2, 'one', ['p'], [['a', '同时', true]]),
    ], [
      person('p', { relations: [rel('q', '朋友'), rel('q', '朋友'), rel('q', '敌人', 'a'), rel('q', '敌人', 'b'), { ...rel('q', '同学'), mutual: true }] }),
      person('q', { relations: [{ ...rel('p', '同学'), mutual: true }] }),
    ])
    const found = problems(d)
    expect(found.get('duplicateLink')).toEqual([
      { events: ['a', 'b'], characters: [], label: '导致', note: 'repeat' },
      { events: ['a', 'b'], characters: [], label: '同时', note: 'reversed' },
    ])
    expect(found.get('duplicateRelation')).toEqual([
      { events: [], characters: ['p', 'q'], label: '朋友', note: 'repeat' },
      { events: [], characters: ['p', 'q'], label: '同学', note: 'reversed' },
    ])
  })
  it('flags references that name no row', () => {
    const d = assemble({
      ...fixture,
      acts: [{ name: 'act-0', position: 1, span: null, description: null }],
      places: [...fixture.places, { key: 'hut', position: 3, name: 'Hut', realm: 'physical', parentKey: 'nowhere', description: null }],
      events: fixture.events.map(e => (e.key === 'end' ? { ...e, placeKey: 'gone', links: [{ position: 1, toKey: 'later', relation: 'causes', mutual: false, note: null, kind: null }] } : e)),
      characters: fixture.characters.map(c => (c.key === 'b' ? { ...c, relations: [{ position: 1, otherKey: 'ghost', relation: 'friend', mutual: false, member: false, sinceKey: 'never', untilKey: null, tone: null }] } : c)),
    })
    const labels = problems(d).get('unresolved')!.map(i => i.label)
    expect(labels).toEqual(expect.arrayContaining(['otherKey → ghost', 'sinceKey → never', 'toKey → later', 'placeKey → gone', 'actName → act-1', 'Hut · parentKey → nowhere']))
  })
  it('marks every problem as of the whole file, as a gap', () => {
    const d = project([ev('a', 1, 'one', [dies('p')]), ev('b', 2, 'one', [dies('p')])], [person('p')])
    expect(buildProblems(d)).toEqual([expect.objectContaining({ id: 'problem:doubleDeath', category: 'gap', file: true })])
  })
})

