import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { MaximizeIcon, MinusIcon, MousePointerClickIcon, PlusIcon, RotateCcwIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useStored } from '@/hooks/use-stored'
import { cn } from '@/lib/utils'
import { useT } from '../i18n'
import { LINK_KINDS } from '../causality/build'
import { drawnAt } from '../cursor/state'
import { matchPeople } from '../relations/graph'
import { CopyBrief } from './CopyBrief'
import { DetailPanel } from './DetailPanel'
import { LangToggle } from './LangToggle'
import { ProjectPicker } from './ProjectPicker'
import { RefreshButton } from './RefreshButton'
import { useZoom } from '@/hooks/use-pan-zoom'
import { GraphLegend, RelationGraph } from './RelationGraph'
import { CausalGraph, CausalLegend } from './CausalGraph'
import { CausalSidebar } from './CausalSidebar'
import { InsightsSidebar, InsightsView } from './InsightsView'
import { ChordGraph } from './ChordGraph'
import { RelationsSidebar } from './RelationsSidebar'
import { ResizeHandle } from './ResizeHandle'
import { Sidebar } from './Sidebar'
import { StoryScrubber } from './StoryScrubber'
import { viewProps, type ShellState, type View } from './shell-state'
import { ThemeToggle } from './ThemeToggle'
import { Timeline } from './Timeline'

/** Panel widths in px; the gap between islands is the drag handle. */
const SIDE = { min: 160, max: 320, initial: 220 }
const DETAIL = { min: 300, max: 520, initial: 380 }
const ISLAND = 'island min-w-0 overflow-auto'

export function DesktopShell(s: ShellState) {
  const t = useT()
  const [side, setSide] = useStored('story-timeline-side-width', SIDE.initial)
  const [detail, setDetail] = useStored('story-timeline-detail-width', DETAIL.initial)
  const relations = s.view === 'graph' || s.view === 'chord'
  const stats: [string, number][] = relations
    ? [[t.people, s.data.characters.length], [t.relationsN, s.relationCount], [t.factions, s.factionCount]]
    : s.view === 'causal'
      ? [[t.linkedN, s.causal.nodes.length], [t.linksN, s.causal.edges.length], [t.longestChain, s.causal.longest]]
      : s.view === 'insights'
        ? [[t.findingsN, s.insights.filter(i => i.category === 'finding').length], [t.gapsN, s.insights.filter(i => i.category === 'gap').length]]
        : [[t.events, s.data.events.length], [t.people, s.data.characters.length], [t.core, s.data.events.filter(e => e.is_core).length], [t.world, s.timeline.world]]
  const v = viewProps(s, t)
  const { selectedCharacter, selectedEvent } = v
  // The people search of the relations sidebar: it lights its matches in the graph and the ring,
  // and Enter there centres the graph on the first match. A new project starts with none.
  const [query, setQuery] = useState('')
  const [find, setFind] = useState<{ id: string; n: number }>()
  const [queryProject, setQueryProject] = useState(s.project)
  if (queryProject !== s.project) { setQueryProject(s.project); setQuery(''); setFind(undefined) }
  const search = useMemo(() => matchPeople(s.graph.nodes, id => s.data.characters.find(c => c.key === id)?.metadata.aliases, query), [s.graph, s.data, query])
  const people = { search, find }

  return (
    <div className="flex h-svh flex-col gap-3 bg-background p-3 text-sm" style={{ '--w-side': `${side}px`, '--w-detail': `${detail}px` } as CSSProperties}>
      <header className="island flex h-14 shrink-0 items-center gap-6 pr-3 pl-5 max-xl:gap-3 max-xl:pl-3">
        <ProjectPicker projects={s.projects} value={s.project} onChange={s.onProject} />
        <ToggleGroup type="single" variant="outline" size="sm" aria-label={t.view} className="shrink-0" value={s.view} onValueChange={value => value && s.onView(value as View)}>
          <ToggleGroupItem value="timeline" className="px-3">{t.timeline}</ToggleGroupItem>
          <ToggleGroupItem value="graph" className="px-3">{t.graphView}</ToggleGroupItem>
          <ToggleGroupItem value="chord" className="px-3">{t.chordView}</ToggleGroupItem>
          <ToggleGroupItem value="causal" className="px-3">{t.causalView}</ToggleGroupItem>
          <ToggleGroupItem value="insights" className="px-3">{t.insightsView}</ToggleGroupItem>
        </ToggleGroup>
        {/*
          Whole-project totals, the one part of the header that gives way. Totals that do not fit wrap
          to a second line that the fixed height hides, so the last ones go first and none is cut in
          half. Below 1280px they all give way to the views and the tools.
        */}
        <dl className="flex h-5 min-w-0 flex-wrap content-start items-baseline gap-x-5 overflow-hidden whitespace-nowrap max-xl:hidden">
          {stats.map(([label, value]) => (
            <div key={label} className="flex items-baseline gap-1.5">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-mono font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          <RefreshButton onRefresh={s.onRefresh} refreshing={s.refreshing} failed={s.refreshFailed} />
          <LangToggle />
          <ThemeToggle />
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside aria-label={t.filters} className={cn(ISLAND, 'flex flex-[0_0_var(--w-side)] flex-col')}>
          {relations ? (
            <RelationsSidebar data={s.data} graph={s.graph} laneIndex={s.laneIndex} options={s.graphOptions} onOptions={s.onGraphOptions} forces={s.view === 'graph' ? s.forces : undefined} onForces={s.onForces} highlight={s.highlight} onHighlight={s.onHighlight} selectedId={selectedCharacter} onSelect={id => s.select({ kind: 'character', id })} cursor={s.cursor} query={query} onQuery={setQuery} onFind={s.view === 'graph' ? id => setFind(f => ({ id, n: (f?.n ?? 0) + 1 })) : undefined} />
          ) : s.view === 'causal' ? (
            <CausalSidebar data={s.data} causal={s.causal} kinds={s.causalKinds} onKinds={s.onCausalKinds} selectedId={selectedEvent} onSelect={id => s.select({ kind: 'event', id })} />
          ) : s.view === 'insights' ? (
            <InsightsSidebar data={s.insightData} insights={s.insights} laneIndex={s.laneIndex} filter={s.insightFilter} onFilter={s.onInsightFilter} />
          ) : (
            <Sidebar timeline={s.timeline} laneIndex={s.laneIndex} filter={s.filter} onFilter={s.onFilter} mode={s.mode} onMode={s.onMode} sections={s.sections} shown={s.visible} />
          )}
        </aside>
        <ResizeHandle label={t.resizeSide} side="left" value={side} min={SIDE.min} max={SIDE.max} onChange={setSide} />

        {/* The middle column: the view, and the story cursor under it, between the two side islands. */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {s.view === 'graph' ? <RelationsMain {...s} {...people} /> : s.view === 'chord' ? <ChordMain {...s} {...people} /> : s.view === 'causal' ? <CausalMain {...s} /> : s.view === 'insights' ? (
            <InsightsView data={s.insightData} whole={s.data} insights={s.insights} laneIndex={s.laneIndex} filter={s.insightFilter} onFilter={s.onInsightFilter} selection={s.selection} select={sel => s.select(sel)} onView={s.onView} cursor={s.cursor} onCursor={s.onCursor} onTrail={s.onTrail} />
          ) : (
            <main className={cn(ISLAND, 'relative flex-1')}>
              <Timeline {...v.timeline} />
            </main>
          )}
          <StoryScrubber {...v.scrubber} actions={<CopyBrief variant="ghost" {...v.storyBrief} />} />
        </div>

        {/* Below 1280px the closed detail takes no room, and an open one at most 36% of the window; the stored width stays as it is. */}
        <ResizeHandle label={t.resizeDetail} side="right" value={detail} min={DETAIL.min} max={DETAIL.max} onChange={setDetail} className={cn(!s.selection && 'max-xl:hidden')} />
        {s.selection ? (
          <aside aria-label={t.detail} className={cn(ISLAND, 'flex-[0_0_var(--w-detail)] max-xl:basis-[min(var(--w-detail),36vw)]')}>
            <DetailPanel
              selection={s.selection}
              data={s.data}
              timeline={s.timeline}
              lanes={s.laneIndex}
              collapsed={s.collapsed}
              onCollapsedChange={s.onCollapsed}
              onSelect={sel => s.select(sel, true)}
              onClose={s.clearSelection}
              onOnly={s.onOnly}
              onStep={s.step}
              cursor={s.cursor}
              onCursor={s.onCursor}
            />
          </aside>
        ) : (
          // The closed detail keeps its place on a wide window, so the middle island does not jump.
          <div aria-label={t.detailClosed} className="flex min-w-0 max-xl:hidden flex-[0_0_var(--w-detail)] flex-col items-center justify-center gap-2.5 rounded-[var(--radius-island)] border border-dashed border-ring/45 p-6 text-center text-muted-foreground">
            <MousePointerClickIcon className="size-[22px]" />
            <span className="font-medium text-foreground">{t.noneSelected}</span>
            <span className="text-[13px] leading-normal">{t.selectHint}</span>
            <span className="mt-1.5 flex items-center gap-1.5 text-xs"><Kbd>J</Kbd><Kbd>K</Kbd><span>{t.stepHint}</span></span>
          </div>
        )}
      </div>
    </div>
  )
}

/** The `f` key fits the graph, unless the focus is in a field or a menu. */
function useFitKey(fit: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, select, textarea, [role=combobox], [role=listbox]')) return
      if (e.key === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey) fit()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [fit])
}

/** A toolbar button of a graph, with its label as a tooltip. */
function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild><Button variant="outline" size="icon-sm" aria-label={label} onClick={onClick} className="size-8 rounded-lg">{children}</Button></TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

/** The middle island of the chord view: a toolbar, the ring and the legend. */
/** What the people search hands the graph and the ring. */
interface PeopleSearch {
  search?: Set<string>
  find?: { id: string; n: number }
}

/** The toolbar chip: the people and relations drawn as the picture stands, so it follows the story cursor. */
function GraphCount({ s }: { s: ShellState }) {
  const t = useT()
  const drawn = useMemo(() => drawnAt(s.graph, s.cursor), [s.graph, s.cursor])
  return <Badge variant="secondary" className="min-w-0 shrink font-mono font-normal">{t.graphCount(drawn.nodeCount, drawn.edgeCount)}</Badge>
}

function ChordMain({ search, find: _, ...s }: ShellState & PeopleSearch) {
  const t = useT()
  return (
    <main aria-label={t.chordView} className="island flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <h2 className="mx-1 shrink-0 font-heading text-base font-bold tracking-wide">{t.chordView}</h2>
        <GraphCount s={s} />
        <span className="ml-auto min-w-0 truncate text-xs text-muted-foreground" title={t.chordHint}>{t.chordHint}</span>
      </div>
      <div className="min-h-0 flex-1">
        <ChordGraph {...viewProps(s, t).chordGraph} search={search} />
      </div>
      <div className="shrink-0 border-t px-4 py-2.5"><GraphLegend cursor={Boolean(s.cursor)} /></div>
    </main>
  )
}

/** The middle island of the graph view: a sticky toolbar, the graph and a sticky legend. */
function RelationsMain({ search, find, ...s }: ShellState & PeopleSearch) {
  const t = useT()
  const zoom = useZoom()
  const { scale, fit, zoomIn, zoomOut } = zoom
  useFitKey(fit)
  return (
    <main aria-label={t.graphAria} className="island flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <h2 className="mx-1 shrink-0 font-heading text-base font-bold tracking-wide">{t.graphView}</h2>
        <GraphCount s={s} />
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <ToolButton label={t.zoomOut} onClick={zoomOut}><MinusIcon /></ToolButton>
          <span className="min-w-11 text-center font-mono text-xs text-muted-foreground">{Math.round(scale * 100)}%</span>
          <ToolButton label={t.zoomIn} onClick={zoomIn}><PlusIcon /></ToolButton>
          <ToolButton label={t.fit} onClick={fit}><MaximizeIcon /></ToolButton>
          <ToolButton label={t.resetLayout} onClick={zoom.reset}><RotateCcwIcon /></ToolButton>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <RelationGraph {...viewProps(s, t).relationGraph} zoom={zoom} search={search} find={find} />
      </div>
      <div className="shrink-0 border-t px-4 py-2.5"><GraphLegend cursor={Boolean(s.cursor)} /></div>
    </main>
  )
}

/** The middle island of the causality view: a toolbar, the events and their links, and the legend. */
function CausalMain(s: ShellState) {
  const t = useT()
  const zoom = useZoom()
  const { scale, fit, zoomIn, zoomOut } = zoom
  useFitKey(fit)
  return (
    <main aria-label={t.causalAria} className="island flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <h2 className="mx-1 shrink-0 font-heading text-base font-bold tracking-wide">{t.causalView}</h2>
        <Badge variant="secondary" className="shrink-0 font-mono font-normal">{t.causalCount(s.causal.nodes.length, s.causal.edges.length)}</Badge>
        {/* The hint gives way before the count. */}
        <span className="ml-2 min-w-0 truncate text-xs text-muted-foreground max-xl:hidden">{t.causalHint}</span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <ToolButton label={t.zoomOut} onClick={zoomOut}><MinusIcon /></ToolButton>
          <span className="min-w-11 text-center font-mono text-xs text-muted-foreground">{Math.round(scale * 100)}%</span>
          <ToolButton label={t.zoomIn} onClick={zoomIn}><PlusIcon /></ToolButton>
          <ToolButton label={t.fit} onClick={fit}><MaximizeIcon /></ToolButton>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <CausalGraph {...viewProps(s, t).causalGraph} zoom={zoom} />
      </div>
      <div className="shrink-0 border-t px-4 py-2.5"><CausalLegend kinds={LINK_KINDS.filter(kind => s.causal.edges.some(e => e.kind === kind))} /></div>
    </main>
  )
}
