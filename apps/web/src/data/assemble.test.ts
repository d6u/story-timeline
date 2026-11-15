import { describe, expect, it } from 'vitest'
import { fixture } from '../test/fixture.ts'
import { assemble } from './assemble.ts'

const data = assemble(fixture)
const a = data.characters.find(c => c.key === 'a')!
const b = data.characters.find(c => c.key === 'b')!
const group = data.characters.find(c => c.key === 'group')!
const start = data.events.find(e => e.key === 'start')!
const end = data.events.find(e => e.key === 'end')!

describe('assemble', () => {
  it('identifies rows by key, and keeps the import id as a plain attribute', () => {
    expect([a.key, a.id]).toEqual(['a', 'uuid-a'])
    expect(b.key).toBe('b')
    expect('id' in b).toBe(false)
    const withId = assemble({ ...fixture, events: fixture.events.map(e => (e.key === 'start' ? { ...e, id: 'e-start' } : e)) })
    expect(withId.events.find(e => e.key === 'start')?.id).toBe('e-start')
    expect('id' in end).toBe(false)
    expect(group.name).toBe('group')
    expect(end.key).toBe('end')
    expect(end.title).toBe('end')
  })
  it('maps participants to character keys and keeps presence and exits', () => {
    expect(start.character_ids).toEqual(['a'])
    expect(end.metadata.participants).toEqual([{ character_id: 'a', presence: 'body', exit: 'dies' }])
  })
  it('shows relations at both ends and marks membership and time bounds', () => {
    expect(a.metadata.relations).toContainEqual({ character_id: 'b', label: 'friend', mutual: true, member: false, incoming: false, since: 'start', tone: 'friend' })
    expect(b.metadata.relations).toEqual([{ character_id: 'a', label: 'friend', mutual: true, member: false, incoming: true, since: 'start', tone: 'friend' }])
    expect(group.metadata.relations).toEqual([{ character_id: 'a', label: 'member', mutual: false, member: true, incoming: true }])
    expect(group.metadata.kind).toBe('group')
  })
  it('shows an event link at both ends with its direction', () => {
    expect(start.metadata.links).toEqual([
      { event: 'end', relation: 'causes', mutual: false, incoming: false, kind: 'cause' },
      { event: 'flood', relation: 'causes', mutual: false, incoming: true },
    ])
    expect(end.metadata.links).toEqual([{ event: 'start', relation: 'causes', mutual: false, incoming: true, kind: 'cause' }])
  })
  it('lists the sources of an event by position, with unnumbered ones last in API order', () => {
    const books = ['x', 'y', 'z'].map(key => ({ key, position: null, title: key.toUpperCase(), lang: null, location: null, note: null }))
    const project = {
      ...fixture,
      sources: [...fixture.sources, ...books],
      events: fixture.events.map(e => e.key !== 'start' ? e : {
        ...e,
        sources: [{ sourceKey: 'y', ref: null, position: null }, { sourceKey: 'book', ref: '1:3-24', position: 2 }, { sourceKey: 'x', ref: null, position: null }, { sourceKey: 'z', ref: 'p. 4', position: 1 }],
      }),
    }
    const sources = assemble(project).events.find(e => e.key === 'start')!.metadata.sources!
    expect(sources.map(s => [s.key, s.ref])).toEqual([['z', 'p. 4'], ['book', '1:3-24'], ['y', undefined], ['x', undefined]])
  })
  it('resolves places, sources, and confidence', () => {
    expect(start.metadata.placeInfo).toEqual({ key: 'cabin', name: 'Cabin', realm: 'physical', parent: 'ship', parentName: 'Ship' })
    expect(start.metadata.placeKey).toBe('cabin')
    expect(data.places?.map(p => p.key)).toEqual(['ship', 'cabin'])
    expect(start.metadata.sources).toEqual([{ key: 'book', title: 'The Book', location: 'https://example.com', ref: '1:3-24' }])
    expect(start.metadata.confidence).toBe('likely')
    expect(end.metadata.placeInfo).toBeUndefined()
  })
  it('derives knowledge per character and learning changes per event', () => {
    expect(a.metadata.knowledge).toEqual([{ key: 'idea', text: 'The door is beyond the sea', kind: 'idea', since: 'start', until: 'end' }])
    expect(start.metadata.learns).toEqual([{ key: 'idea', who: ['a'], text: 'The door is beyond the sea' }])
    expect(end.metadata.learns).toEqual([{ key: 'idea', who: ['a'], text: 'The door is beyond the sea', forgotten: true }])
  })
  it('names learners by character key, so two characters with one name stay apart', () => {
    const twin = { ...fixture.characters[1], key: 'b2', id: 'uuid-b2', name: 'B' }
    const learnings = [{ ...fixture.learnings[0], characters: [
      { ...fixture.learnings[0].characters[0], characterKey: 'b' },
      { ...fixture.learnings[0].characters[0], characterKey: 'b2', position: 2 },
    ] }]
    const twins = assemble({ ...fixture, characters: [...fixture.characters, twin], learnings })
    expect(twins.events.find(e => e.key === 'start')!.metadata.learns?.[0].who).toEqual(['b', 'b2'])
  })
  it('keeps aliases, lanes, and arc stages', () => {
    expect(a.metadata.aliases).toEqual(['Alpha'])
    expect(a.metadata.lane).toBe(1)
    expect(a.metadata.reading?.beats).toEqual([{ since: 'start', stage: 'call' }])
    expect(b.metadata.aliases).toBeUndefined()
  })
  it('orders acts by position, then in API order, and keeps span and description', () => {
    const acts = [
      { name: 'late', position: 2, span: 'days 5-9', description: 'The end' },
      { name: 'loose', position: null, span: null, description: null },
      { name: 'early', position: 1, span: null, description: 'The start' },
    ]
    expect(assemble({ ...fixture, acts }).acts).toEqual([
      { name: 'early', position: 1, description: 'The start' },
      { name: 'late', position: 2, span: 'days 5-9', description: 'The end' },
      { name: 'loose' },
    ])
  })
  it('carries the learning description to knowledge and learning changes', () => {
    const learnings = [{ ...fixture.learnings[0], description: 'Told by the keeper' }]
    const d = assemble({ ...fixture, learnings })
    expect(d.characters.find(c => c.key === 'a')!.metadata.knowledge?.[0].description).toBe('Told by the keeper')
    expect(d.events.find(e => e.key === 'start')!.metadata.learns?.[0].description).toBe('Told by the keeper')
    expect(a.metadata.knowledge?.[0]).not.toHaveProperty('description')
  })
  it('keeps the language and note of other names', () => {
    expect(a.metadata.names).toEqual([{ name: 'Alpha', lang: 'en' }])
    const noted = assemble({ ...fixture, characters: [{ ...fixture.characters[0], names: [{ name: 'Al', position: 1, lang: null, note: 'as a child' }] }, ...fixture.characters.slice(1)] })
    expect(noted.characters[0].metadata.names).toEqual([{ name: 'Al', note: 'as a child' }])
  })
})
