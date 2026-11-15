import { describe, expect, it } from 'vitest'
import { resolveAt, resolveFilter, resolveSelection } from '../components/shell-state'
import { assemble } from '../data/assemble'
import { fixture } from '../test/fixture'
import { emptyFilter } from '../timeline/build'
import { historyAction, navKey, readUrl, urlSearch, type UrlState } from './state'

describe('URL state', () => {
  it('reads what it writes, and leaves defaults out', () => {
    const state: UrlState = { project: '故事', view: 'graph', mode: 'time', filter: { ...emptyFilter, query: 'ship', who: ['a', 'b'], coreOnly: true }, selection: { kind: 'event', id: 'landing' }, at: 'night' }
    expect(readUrl(urlSearch(state))).toEqual(state)
    expect(urlSearch({ project: 'p', view: 'timeline', mode: 'act', filter: emptyFilter })).toBe('?project=p')
  })
  it('reads the old name of the graph and turns an unknown view into the timeline', () => {
    expect(readUrl('?view=relations').view).toBe('graph')
    expect(readUrl('?view=zzz').view).toBe('timeline')
  })
})

describe('browser history', () => {
  const step = { project: 'p', view: 'timeline' as const, selection: undefined }
  it('makes a step of the project, the view and the selection only', () => {
    expect(navKey(step)).not.toBe(navKey({ ...step, project: 'q' }))
    expect(navKey(step)).not.toBe(navKey({ ...step, view: 'graph' }))
    expect(navKey(step)).not.toBe(navKey({ ...step, selection: { kind: 'event', id: 'e' } }))
    expect(navKey({ ...step, selection: { kind: 'event', id: 'e' } })).not.toBe(navKey({ ...step, selection: { kind: 'character', id: 'e' } }))
  })
  it('pushes only a step the user took', () => {
    const a = navKey(step)
    const b = navKey({ ...step, view: 'graph' })
    expect(historyAction(a, b, 'jump')).toBe('push')
    // An old link's id the data rewrites to a key, or a selection a refetch removes, is not the user's step.
    expect(historyAction(a, b, 'none')).toBe('replace')
    // A search, a filter or the cursor leaves the step as it is.
    expect(historyAction(a, a, 'jump')).toBe('replace')
    // The first write replaces the entry the page loaded with.
    expect(historyAction(undefined, b, 'jump')).toBe('replace')
  })
  it('replaces the entry on a sequential step through the events', () => {
    const one = navKey({ ...step, selection: { kind: 'event', id: 'e1' } })
    const two = navKey({ ...step, selection: { kind: 'event', id: 'e2' } })
    // J, K and the detail panel's arrows: Back leaves the whole run at once.
    expect(historyAction(one, two, 'step')).toBe('replace')
    // A click on another event is still a step of its own.
    expect(historyAction(one, two, 'jump')).toBe('push')
  })
})

describe('old links that name a row by its import id', () => {
  // Character `a` has the id `uuid-a`; event `start` gets the id `e-start`.
  const data = assemble({ ...fixture, events: fixture.events.map(e => (e.key === 'start' ? { ...e, id: 'e-start' } : e)) })
  /** What App does with a URL once the data is in: resolve each value, then write the URL back. */
  const open = (search: string) => {
    const u = readUrl(search)
    const resolved = { ...u, selection: resolveSelection(data, u.selection), at: resolveAt(data, u.at), filter: resolveFilter(data, u.filter) }
    return { search: urlSearch(resolved), action: historyAction(navKey(u), navKey(resolved), 'none') }
  }
  it('opens the row and rewrites the URL to its key in place', () => {
    expect(open('?project=demo&character=uuid-a')).toEqual({ search: '?project=demo&character=a', action: 'replace' })
    expect(open('?project=demo&event=e-start')).toEqual({ search: '?project=demo&event=start', action: 'replace' })
    expect(open('?project=demo&who=uuid-a%2Cb&at=e-start')).toEqual({ search: '?project=demo&who=a%2Cb&at=start', action: 'replace' })
  })
  it('keeps a URL that already names keys as it is', () => {
    const search = '?project=demo&who=a&event=start&at=start'
    expect(open(search).search).toBe(search)
  })
})
