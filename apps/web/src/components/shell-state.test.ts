import { expect, it } from 'vitest'
import { assemble } from '../data/assemble'
import { fixture } from '../test/fixture'
import { emptyFilter } from '../timeline/build'
import { initialPeopleMode, resolveAt, resolveFilter, resolveInsightFilter, resolveSelection } from './shell-state'

const data = assemble(fixture)

it('accepts a character or an event by key, rewrites an old id link to the key, and drops one that names nothing', () => {
  // Character `a` has the id `uuid-a`; the URL writes the key, as the API and the briefs do.
  const byKey = { kind: 'character', id: 'a' } as const
  expect(resolveSelection(data, byKey)).toBe(byKey)
  expect(resolveSelection(data, { kind: 'character', id: 'uuid-a' })).toEqual(byKey)
  expect(resolveSelection(data, { kind: 'event', id: 'start' })).toEqual({ kind: 'event', id: 'start' })
  const withId = { ...data, events: data.events.map(e => (e.key === 'start' ? { ...e, id: 'e-start' } : e)) }
  expect(resolveSelection(withId, { kind: 'event', id: 'e-start' })).toEqual({ kind: 'event', id: 'start' })
  expect(resolveSelection(data, { kind: 'character', id: 'gone' })).toBeUndefined()
  expect(resolveSelection(data, undefined)).toBeUndefined()
})

it('a key wins over an id that has the same value', () => {
  // Event `end` has the key of nothing else; give `start` the id `end`: the value still names `end`.
  const clash = { ...data, events: data.events.map(e => (e.key === 'start' ? { ...e, id: 'end' } : e)) }
  expect(resolveSelection(clash, { kind: 'event', id: 'end' })).toEqual({ kind: 'event', id: 'end' })
  expect(resolveAt(clash, 'end')).toBe('end')
})

it('accepts the cursor event by key or by id', () => {
  const withId = { ...data, events: data.events.map(e => (e.key === 'start' ? { ...e, id: 'e-start' } : e)) }
  expect(resolveAt(withId, 'start')).toBe('start')
  expect(resolveAt(withId, 'e-start')).toBe('start')
  expect(resolveAt(withId, 'gone')).toBeUndefined()
  expect(resolveAt(withId, undefined)).toBeUndefined()
})

it('opens the people tab on the drawing the URL names, and on its list from a tap', () => {
  expect(initialPeopleMode('graph', false)).toBe('graph')
  expect(initialPeopleMode('chord', false)).toBe('chord')
  expect(initialPeopleMode('graph', true)).toBe('list')
  expect(initialPeopleMode('chord', true)).toBe('chord')
})

it('drops a person a filter names once the data no longer has them, and keeps an unchanged filter as is', () => {
  // After a refetch character `a` (id `uuid-a`) is gone.
  const refetched = { ...data, characters: data.characters.filter(c => c.key !== 'a') }
  const filter = { ...emptyFilter, who: ['a', 'b'] }
  expect(resolveFilter(data, filter)).toBe(filter)
  expect(resolveFilter(refetched, filter)).toEqual({ ...filter, who: ['b'] })
  // An id from an old link becomes the key.
  expect(resolveFilter(data, { ...emptyFilter, who: ['uuid-a', 'b'] }).who).toEqual(['a', 'b'])
  expect(resolveFilter(data, { ...emptyFilter, who: ['uuid-a', 'a'] }).who).toEqual(['a'])

  const insight = { category: 'gap', who: 'a' } as const
  expect(resolveInsightFilter(data, insight)).toBe(insight)
  expect(resolveInsightFilter(refetched, insight)).toEqual({ category: 'gap' })
  expect(resolveInsightFilter(data, { category: 'finding', who: 'uuid-a' })).toEqual({ category: 'finding', who: 'a' })
  const none = { category: 'finding' } as const
  expect(resolveInsightFilter(refetched, none)).toBe(none)
})
