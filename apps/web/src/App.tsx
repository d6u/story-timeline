import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CircleAlertIcon, XIcon } from 'lucide-react'
import { useQuery } from 'urql'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useLastGood } from '@/hooks/use-last-good'
import { useStored } from '@/hooks/use-stored'
import { assemble } from './data/assemble'
import { ProjectQuery, ProjectsQuery } from './graphql/queries'
import { useT } from './i18n'
import { DesktopShell } from './components/DesktopShell'
import { initialCollapsed, type Selection } from './components/DetailPanel'
import { LangToggle } from './components/LangToggle'
import { PhoneShell } from './components/PhoneShell'
import { ProjectPicker } from './components/ProjectPicker'
import { resolveAt, resolveFilter, resolveInsightFilter, resolveSelection, type ShellState, type View } from './components/shell-state'
import { historyAction, navKey, readUrl, urlSearch, type NavIntent } from './url/state'
import { ThemeToggle } from './components/ThemeToggle'
import { laneColors } from './components/people'
import { makeCursor, stepKey, storyAsOf, storyEvents, storyOrder } from './cursor/state'
import { buildCausality, emptyCausality, LINK_KINDS, type LinkKind } from './causality/build'
import { buildInsights, buildProblems, type InsightFilter } from './insights/build'
import { buildGraph, defaultForces, emptyGraph, TONES, type Forces, type GraphOptions, type Tone } from './relations/graph'
import { applyFilter, buildTimeline, emptyFilter, sectionsFor, type Filter, type Mode } from './timeline/build'

const initial = readUrl(location.search)

/** Graph options as stored: the tone set becomes an array. */
type StoredGraph = Omit<GraphOptions, 'tones'> & { tones: Tone[] }
const initialGraph: StoredGraph = { showMinor: false, labels: true, tones: TONES }

function ErrorPage({ title, message, hint }: { title: string; message: string; hint: string }) {
  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p className="font-mono">{message}</p>
        <p>{hint}</p>
      </AlertDescription>
    </Alert>
  )
}

/**
 * Says that the project the URL named does not exist and which one shows instead. It floats over
 * the page, so the header keeps its layout, and stays until dismissed or the project changes. It
 * sits above the sheets (z-50) too, so an open detail sheet on the phone does not cover it.
 */
function ProjectNotice({ asked, shown, onDismiss }: { asked: string; shown?: string; onDismiss: () => void }) {
  const t = useT()
  if (!shown) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-[60] flex justify-center px-3">
      <Alert className="pointer-events-auto max-w-md shadow-island">
        <CircleAlertIcon />
        <AlertTitle>{t.projectNotFound}</AlertTitle>
        <AlertDescription>{t.projectFallback(asked, shown)}</AlertDescription>
        <AlertAction>
          <Button variant="ghost" size="icon-sm" aria-label={t.dismiss} onClick={onDismiss}><XIcon /></Button>
        </AlertAction>
      </Alert>
    </div>
  )
}

export default function App() {
  const t = useT()
  const [project, setProject] = useState(initial.project)
  const [view, setView] = useState<View>(initial.view)
  const [mode, setMode] = useState<Mode>(initial.mode)
  const [filter, setFilter] = useState<Filter>(initial.filter)
  const [selection, setSelection] = useState<Selection | undefined>(initial.selection)
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  const [storedGraph, setStoredGraph] = useStored<StoredGraph>('story-timeline-graph', initialGraph)
  const [storedForces, setStoredForces] = useStored<Partial<Forces>>('story-timeline-graph-forces', {})
  const forces = useMemo((): Forces => ({ ...defaultForces, ...storedForces }), [storedForces])
  const [storedKinds, setStoredKinds] = useStored<LinkKind[]>('story-timeline-causal-kinds', LINK_KINDS)
  const causalKinds = useMemo(() => new Set(storedKinds), [storedKinds])
  const [highlight, setHighlight] = useState<string>()
  // The event the story is seen as of; none shows the whole story.
  const [at, setAt] = useState(initial.at)
  const [insightFilter, setInsightFilter] = useState<InsightFilter>({ category: 'finding' })
  // A chain the insights sent to the causality graph; it lights only while the selection is on it.
  const [trail, setTrail] = useState<string[]>()
  // Once the selection leaves the chain, the chain is done with.
  if (trail && !(selection?.kind === 'event' && trail.includes(selection.id))) setTrail(undefined)
  // Keeps the sheet's content while it animates closed.
  const [lastSelection, setLastSelection] = useState(selection)
  if (selection && selection !== lastSelection) setLastSelection(selection)
  const desktop = useMediaQuery('(min-width: 56rem)')

  const [list, refetchList] = useQuery({ query: ProjectsQuery })
  // A refetch that fails, or is in flight, keeps what is shown; one that brings the same data keeps the same objects.
  const projects = useLastGood(list.data?.projects, 'projects') ?? []
  const known = projects.some(p => p.id === project)
  // The project the URL named that does not exist, for the notice; dismissed, it is none.
  const [missing, setMissing] = useState<string>()
  // Fall back to the first project when the URL names none, or an unknown one; the notice says which.
  useEffect(() => {
    if (!projects.length || known) return
    if (project) setMissing(project)
    setProject(projects[0].id)
  }, [projects, known, project])

  const [load, refetchLoad] = useQuery({ query: ProjectQuery, variables: { id: project }, pause: !known })
  // Right after a project switch, urql still holds the old project's result; it is not this project's.
  const fresh = known && load.data?.project?.id === project ? load.data.project : undefined
  const loaded = useLastGood(fresh, project)
  const data = useMemo(() => (loaded && known ? assemble(loaded) : undefined), [loaded, known])

  // The client is cache-first; agents write through the API, so the data is fetched again from the
  // network on demand, and when the window comes back into focus. Focus and visibility often come together.
  const lastRefetch = useRef(0)
  const refetch = useCallback(() => {
    lastRefetch.current = Date.now()
    refetchList({ requestPolicy: 'network-only' })
    if (known) refetchLoad({ requestPolicy: 'network-only' })
  }, [refetchList, refetchLoad, known])
  useEffect(() => {
    const onBack = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRefetch.current > 2000) refetch()
    }
    addEventListener('focus', onBack)
    document.addEventListener('visibilitychange', onBack)
    return () => {
      removeEventListener('focus', onBack)
      document.removeEventListener('visibilitychange', onBack)
    }
  }, [refetch])
  // New data may no longer have what the URL or the user picked (the selection, the cursor, the people
  // a filter names); an id from an old link becomes the key, and the URL is rewritten in place.
  useEffect(() => {
    if (!data) return
    setSelection(s => resolveSelection(data, s))
    setAt(a => resolveAt(data, a))
    setFilter(f => resolveFilter(data, f))
    setInsightFilter(f => resolveInsightFilter(data, f))
  }, [data])

  // Back and Forward step through navigation: a project, a view, an event or a character. The user's
  // own jumps set `navigated` to `jump`; a run of J/K steps sets `step` and replaces the entry; every
  // other change (a search, a filter, the cursor, the order mode, an old id the data rewrites to a key, the first
  // write, a restore from the history) replaces the entry.
  const navigated = useRef<NavIntent>('none')
  const written = useRef<string | undefined>(undefined)
  const nav = navKey({ project, view, selection })
  useEffect(() => {
    if (!project) return
    const action = historyAction(written.current, nav, navigated.current)
    navigated.current = 'none'
    written.current = nav
    const search = urlSearch({ project, view, mode, filter, selection, at })
    if (action === 'push') history.pushState(null, '', search)
    else if (search !== location.search) history.replaceState(null, '', search)
  }, [project, view, mode, filter, selection, at, nav])
  useEffect(() => {
    const onPop = () => {
      const u = readUrl(location.search)
      navigated.current = 'none'
      setProject(u.project)
      setView(u.view)
      setMode(u.mode)
      setFilter(u.filter)
      setSelection(u.selection)
      setAt(u.at)
    }
    addEventListener('popstate', onPop)
    return () => removeEventListener('popstate', onPop)
  }, [])
  // The current step, for the handlers below to tell a real step from a repeat.
  const current = useRef({ project, view, selection })
  current.current = { project, view, selection }
  const goView = useCallback((next: View) => {
    if (next !== current.current.view) navigated.current = 'jump'
    setView(next)
  }, [])
  const clearSelection = useCallback(() => {
    if (current.current.selection) navigated.current = 'jump'
    setSelection(undefined)
  }, [])

  const timeline = useMemo(() => data && buildTimeline(data), [data])
  const laneIndex = useMemo(() => laneColors(timeline?.lanes ?? []), [timeline])
  const visible = useMemo(() => (timeline ? applyFilter(timeline.entries, filter) : []), [timeline, filter])
  const sections = useMemo(() => (timeline ? sectionsFor(visible, mode, timeline, t) : []), [timeline, visible, mode, t])
  const order = useMemo(() => sections.flatMap(s => s.groups.flatMap(g => g.entries)), [sections])
  const graphOptions = useMemo((): GraphOptions => ({ ...storedGraph, tones: new Set(storedGraph.tones) }), [storedGraph])
  const graph = useMemo(() => (data ? buildGraph(data, graphOptions) : emptyGraph), [data, graphOptions])
  const causal = useMemo(() => (data ? buildCausality(data, causalKinds) : emptyCausality), [data, causalKinds])
  const sorted = useMemo(() => (data ? storyEvents(data.events) : []), [data])
  const story = useMemo(() => (data ? storyOrder(data.events) : new Map<string, number>()), [data])
  const cursor = useMemo(() => (data ? makeCursor(data, story, at) : undefined), [data, story, at])
  // The insights read the story as of the cursor, as every other view does.
  const insightData = useMemo(() => (data && cursor ? storyAsOf(data, cursor) : data), [data, cursor])
  // Data problems are of the file, so they read the whole project whatever the cursor.
  const insights = useMemo(() => (insightData && data ? [...buildInsights(insightData), ...buildProblems(data)] : []), [insightData, data])
  const stepCursor = useCallback((delta: number) => setAt(key => stepKey(sorted, key, delta)), [sorted])

  const select = useCallback((next: Selection, scroll = false, intent: NavIntent = 'jump') => {
    const now = current.current.selection
    if (now?.kind !== next.kind || now.id !== next.id) navigated.current = intent
    setSelection(next)
    if (scroll && next.kind === 'event') {
      requestAnimationFrame(() => document.getElementById(`ev-${next.id}`)?.scrollIntoView({ block: 'nearest' }))
    }
  }, [])

  const step = useCallback((delta: number) => {
    if (!order.length) return
    const at = order.findIndex(e => e.event.key === selection?.id)
    const next = order[Math.min(order.length - 1, Math.max(0, at < 0 ? 0 : at + delta))]
    // From an open event, J and K are a sequential step and replace the history entry; from nothing
    // open, the first step opens an event as a jump does.
    select({ kind: 'event', id: next.event.key }, true, selection?.kind === 'event' ? 'step' : 'jump')
  }, [order, selection, select])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, select, textarea, [role=combobox], [role=listbox]')) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape') clearSelection()
      else if (e.key === 'j') step(1)
      else if (e.key === 'k') step(-1)
      else if (e.key === '[') stepCursor(-1)
      else if (e.key === ']') stepCursor(1)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [step, stepCursor, clearSelection])

  const changeProject = (id: string) => {
    if (id !== project) navigated.current = 'jump'
    setMissing(undefined)
    setProject(id)
    setSelection(undefined)
    setFilter(emptyFilter)
    setAt(undefined)
    setInsightFilter(f => ({ category: f.category }))
  }

  if (!projects.length && (list.error || !list.fetching)) {
    return (
      <main className="mx-auto max-w-xl p-6 pt-[15vh]">
        <ErrorPage title={t.listError} message={list.error?.message ?? t.noProjects} hint={t.listErrorHint} />
      </main>
    )
  }

  const notice = missing && <ProjectNotice asked={missing} shown={projects.find(p => p.id === project)?.name} onDismiss={() => setMissing(undefined)} />

  if (!data || !timeline) {
    return (
      <div className="flex min-h-svh flex-col gap-3 bg-background p-3 text-sm">
        <header className="island flex h-14 shrink-0 items-center gap-6 pr-3 pl-5">
          <ProjectPicker projects={projects} value={known ? project : ''} onChange={changeProject} />
          <div className="ml-auto flex items-center gap-2.5"><LangToggle /><ThemeToggle /></div>
        </header>
        <main className="island mx-auto flex w-full max-w-2xl flex-col gap-3 p-6">
          {load.error ? (
            <ErrorPage title={t.loadError} message={load.error.message} hint={t.loadErrorHint} />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t.loading(projects.find(p => p.id === project)?.name ?? t.project)}</p>
              {[0, 1, 2].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
            </>
          )}
        </main>
        {notice}
      </div>
    )
  }

  const groups = new Set(data.characters.filter(c => c.metadata.kind === 'group').map(c => c.key))
  const factions = new Set<string>()
  let relationCount = 0
  for (const c of data.characters) {
    for (const r of c.metadata.relations ?? []) {
      if (r.incoming) continue
      if (r.member && groups.has(r.character_id)) factions.add(r.character_id)
      else if (!r.member) relationCount++
    }
  }

  const state: ShellState = {
    projects,
    project: known ? project : '',
    onProject: changeProject,
    view,
    onView: goView,
    data,
    timeline,
    laneIndex,
    filter,
    onFilter: setFilter,
    mode,
    onMode: setMode,
    sections,
    visible: visible.length,
    selection,
    lastSelection,
    select,
    clearSelection,
    step,
    collapsed,
    onCollapsed: setCollapsed,
    onOnly: id => { setFilter(f => ({ ...f, who: [id] })); goView('timeline') },
    graph,
    graphOptions,
    highlight: graph.factions.some(f => f.id === highlight) ? highlight : undefined,
    onHighlight: setHighlight,
    forces,
    onForces: setStoredForces,
    onGraphOptions: update => setStoredGraph(prev => {
      const next = update({ ...prev, tones: new Set(prev.tones) })
      return { ...next, tones: [...next.tones] }
    }),
    relationCount,
    factionCount: factions.size,
    causal,
    causalKinds,
    onCausalKinds: kinds => setStoredKinds([...kinds]),
    trail,
    onTrail: setTrail,
    storyEvents: sorted,
    cursor,
    onCursor: setAt,
    stepCursor,
    insights,
    insightData: insightData ?? data,
    insightFilter,
    onInsightFilter: setInsightFilter,
    onRefresh: refetch,
    refreshing: list.fetching || load.fetching,
    refreshFailed: Boolean(list.error || load.error),
  }

  return (
    <>
      {desktop ? <DesktopShell {...state} /> : <PhoneShell {...state} />}
      {notice}
    </>
  )
}
