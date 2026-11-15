import type { Selection } from '../components/DetailPanel'
import type { View } from '../components/shell-state'
import { emptyFilter, type Filter, type Mode } from '../timeline/build'

/** What the URL holds. */
export interface UrlState {
  project: string
  view: View
  mode: Mode
  filter: Filter
  selection?: Selection
  at?: string
}

/** The state a query string names. A value it does not know becomes the default. */
export function readUrl(search: string): UrlState {
  const p = new URLSearchParams(search)
  const selection: Selection | undefined = p.get('event')
    ? { kind: 'event', id: p.get('event')! }
    : p.get('character') ? { kind: 'character', id: p.get('character')! } : undefined
  const filter: Filter = {
    ...emptyFilter,
    query: p.get('q') ?? '',
    who: p.get('who')?.split(',').filter(Boolean) ?? [],
    match: p.get('match') === 'any' ? 'any' : 'all',
    coreOnly: p.get('core') === '1',
    hideWorld: p.get('world') === '0',
  }
  return {
    project: p.get('project') ?? '',
    view: readView(p.get('view')),
    mode: p.get('mode') === 'time' ? 'time' : 'act',
    selection,
    filter,
    at: p.get('at') ?? undefined,
  }
}

/** The view a URL names; `relations` is the old name of the graph. */
function readView(raw: string | null): View {
  if (raw === 'chord' || raw === 'causal' || raw === 'insights') return raw
  return raw === 'graph' || raw === 'relations' ? 'graph' : 'timeline'
}

/** The query string for a state, with `?`; defaults are left out. */
export function urlSearch({ project, view, mode, filter, selection, at }: UrlState): string {
  const p = new URLSearchParams()
  p.set('project', project)
  if (view !== 'timeline') p.set('view', view)
  if (mode !== 'act') p.set('mode', mode)
  if (filter.query) p.set('q', filter.query)
  if (filter.who.length) p.set('who', filter.who.join(','))
  if (filter.match !== 'all') p.set('match', filter.match)
  if (filter.coreOnly) p.set('core', '1')
  if (filter.hideWorld) p.set('world', '0')
  if (selection) p.set(selection.kind, selection.id)
  if (at) p.set('at', at)
  return `?${p}`
}

/**
 * The part of the state that makes a step in the browser history: the project, the view, and
 * the open event or character. Search, filters, the order mode and the story cursor are
 * adjustments of one step, so they are not in it.
 */
export function navKey({ project, view, selection }: Pick<UrlState, 'project' | 'view' | 'selection'>): string {
  return JSON.stringify([project, view, selection?.kind ?? null, selection?.id ?? null])
}

/**
 * What the user did to the navigation step: nothing of their own (`none`), a jump to a project,
 * a view, an event or a character (`jump`), or a sequential step to the previous or next event
 * (`step`, the J and K keys and the detail panel's arrows).
 */
export type NavIntent = 'none' | 'jump' | 'step'

/**
 * How to write the URL: a new history entry only when the user jumped and the step changed; a
 * sequential step replaces the entry, so Back leaves the run of steps at once instead of walking
 * back through every event. Anything else (the first write, an adjustment, an old link's id the data
 * rewrites to a key, a selection a refetch removed, a restore from Back or Forward) replaces the entry.
 */
export function historyAction(previous: string | undefined, next: string, intent: NavIntent): 'push' | 'replace' {
  return intent === 'jump' && previous !== undefined && previous !== next ? 'push' : 'replace'
}
