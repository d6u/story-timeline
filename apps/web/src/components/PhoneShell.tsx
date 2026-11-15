import { useState, type CSSProperties, type ReactNode } from 'react'
import { ChevronRightIcon, GitForkIcon, LightbulbIcon, ListIcon, MaximizeIcon, MinusIcon, PlusIcon, RotateCcwIcon, SearchIcon, SlidersHorizontalIcon, UsersIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { useT } from '../i18n'
import { kindCounts, LINK_KINDS } from '../causality/build'
import { factionMembers } from '../cursor/state'
import { TONES, toneCounts, type Tone } from '../relations/graph'
import { emptyFilter } from '../timeline/build'
import { CopyBrief } from './CopyBrief'
import { DetailPanel } from './DetailPanel'
import { LangToggle } from './LangToggle'
import { personColor } from './people'
import { ProjectPicker } from './ProjectPicker'
import { RefreshButton } from './RefreshButton'
import { CausalGraph, CausalLegend } from './CausalGraph'
import { ChordGraph } from './ChordGraph'
import { ForceControls } from './ForceControls'
import { InsightsView } from './InsightsView'
import { useZoom } from '@/hooks/use-pan-zoom'
import { GraphLegend, RelationGraph } from './RelationGraph'
import { Sidebar } from './Sidebar'
import { StoryScrubber } from './StoryScrubber'
import { initialPeopleMode, viewProps, type PeopleMode, type ShellState } from './shell-state'
import { ThemeToggle } from './ThemeToggle'
import { Timeline } from './Timeline'

type Tab = 'timeline' | 'people' | 'causal' | 'insights'

/**
 * Three islands: header, one main island per tab, and the tab bar. Details and filters slide up as
 * sheets over them, so the timeline keeps its scroll position.
 */
export function PhoneShell(s: ShellState) {
  const t = useT()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const tab: Tab = s.view === 'graph' || s.view === 'chord' ? 'people' : s.view
  // A tap on the 人物 tab opens its list; a URL or a link that names the graph opens the graph.
  const [peopleFromTab, setPeopleFromTab] = useState(false)
  const setTab = (next: Tab) => {
    if (next !== tab) setPeopleFromTab(next === 'people')
    s.onView(next === 'people' ? 'graph' : next)
  }
  const filtered = s.visible !== s.timeline.entries.length
  const changed = JSON.stringify(s.filter) !== JSON.stringify(emptyFilter)
  const v = viewProps(s, t)
  const stats = tab === 'people' ? t.relationStats(s.data.characters.length, s.relationCount) : tab === 'causal' ? t.causalCount(s.causal.nodes.length, s.causal.edges.length) : tab === 'insights' ? t.insightCount(s.insights.filter(i => i.category === 'finding').length, s.insights.filter(i => i.category === 'gap').length) : t.stats(s.data.events.length, s.data.characters.length)

  return (
    <div className="flex h-svh flex-col gap-2.5 bg-background p-2.5 text-sm" style={{ '--radius-island': '18px' } as CSSProperties}>
      <header className="island flex h-14 shrink-0 items-center gap-2 pr-1.5 pl-1.5">
        <ProjectPicker projects={s.projects} value={s.project} onChange={s.onProject} subtitle={stats} />
        <div className="ml-auto flex items-center gap-0.5">
          {/* The search filters events; the 人物 tab has no search of its own, so the button is not there. */}
          {tab !== 'people' && <Button variant="ghost" size="icon-lg" aria-label={t.search} onClick={() => setFiltersOpen(true)} className="size-11 rounded-xl"><SearchIcon className="size-[18px]" /></Button>}
          <RefreshButton phone onRefresh={s.onRefresh} refreshing={s.refreshing} failed={s.refreshFailed} />
          <LangToggle pill />
          <ThemeToggle cycle />
        </div>
      </header>
      <StoryScrubber compact {...v.scrubber} actions={<CopyBrief variant="ghost" {...v.storyBrief} />} />

      {tab === 'timeline' ? (
        <main aria-label={t.timeline} className="island relative min-h-0 flex-1 overflow-auto">
          <Timeline phone {...v.timeline} />
        </main>
      ) : tab === 'causal' ? <CausalTab {...s} /> : tab === 'insights' ? (
        <InsightsView phone data={s.insightData} whole={s.data} insights={s.insights} laneIndex={s.laneIndex} filter={s.insightFilter} onFilter={s.onInsightFilter} selection={s.selection} select={sel => s.select(sel)} onView={s.onView} cursor={s.cursor} onCursor={s.onCursor} onTrail={s.onTrail} />
      ) : <PeopleTab {...s} fromTab={peopleFromTab} />}

      <nav aria-label={t.mainNav} className="island flex shrink-0 gap-1 p-1">
        <TabButton label={t.timeline} current={tab === 'timeline'} onClick={() => setTab('timeline')}><ListIcon /></TabButton>
        <TabButton label={t.people} current={tab === 'people'} onClick={() => setTab('people')}><UsersIcon /></TabButton>
        <TabButton label={t.causalView} current={tab === 'causal'} onClick={() => setTab('causal')}><GitForkIcon /></TabButton>
        <TabButton label={t.insightsView} current={tab === 'insights'} onClick={() => setTab('insights')}><LightbulbIcon /></TabButton>
        <TabButton label={t.filters} current={filtersOpen} onClick={() => setFiltersOpen(true)} badge={filtered ? s.visible : undefined}><SlidersHorizontalIcon /></TabButton>
      </nav>

      <Sheet open={!!s.selection} onOpenChange={open => { if (!open) s.clearSelection() }}>
        <PhoneSheet title={t.detail} description={t.detailSub} height="h-[78svh]">
          <DetailPanel
            selection={s.selection ?? s.lastSelection}
            data={s.data}
            timeline={s.timeline}
            lanes={s.laneIndex}
            collapsed={s.collapsed}
            onCollapsedChange={s.onCollapsed}
            onSelect={sel => s.select(sel, true)}
            onClose={s.clearSelection}
            onOnly={id => { s.onOnly(id); setFiltersOpen(false) }}
            onStep={s.step}
            cursor={s.cursor}
            onCursor={s.onCursor}
          />
        </PhoneSheet>
      </Sheet>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <PhoneSheet title={t.filters} description={t.filterSub} height="h-[86svh]" header={
          <div className="flex items-center gap-2 py-1.5 pr-3 pl-5">
            <h2 className="font-heading text-lg font-bold tracking-wide">{t.filters}</h2>
            <span className="font-mono text-xs text-muted-foreground">{s.visible} / {s.timeline.entries.length}</span>
            {changed && <Button variant="ghost" size="sm" className="ml-auto h-9 text-muted-foreground" onClick={() => s.onFilter(() => emptyFilter)}>{t.clear}</Button>}
            <Button size="sm" className={cn('h-9 rounded-[10px] px-3.5', !changed && 'ml-auto')} onClick={() => setFiltersOpen(false)}>{t.done}</Button>
          </div>
        }>
          <Sidebar phone timeline={s.timeline} laneIndex={s.laneIndex} filter={s.filter} onFilter={s.onFilter} mode={s.mode} onMode={s.onMode} sections={s.sections} shown={s.visible} />
        </PhoneSheet>
      </Sheet>
    </div>
  )
}

function TabButton({ label, current, onClick, badge, children }: { label: string; current: boolean; onClick: () => void; badge?: number; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-current={current ? 'page' : undefined}
      onClick={onClick}
      className={cn('relative flex h-14 flex-1 flex-col items-center justify-center gap-[3px] rounded-xl text-[11px] text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-5', current && 'font-semibold text-foreground')}
    >
      {children}
      <span>{label}</span>
      {badge !== undefined && <span className="absolute top-1.5 left-[calc(50%+6px)] inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 font-mono text-[10px] text-background">{badge}</span>}
    </button>
  )
}

/** A floating zoom button of a phone graph. */
function fab(label: string, onClick: () => void, icon: ReactNode) {
  return <Button variant="outline" size="icon-lg" aria-label={label} onClick={onClick} className="size-10 rounded-xl bg-card shadow-island">{icon}</Button>
}

/** A bottom sheet flush with the screen edges, with a grab bar and a scrolling body. */
function PhoneSheet({ title, description, height, header, children }: { title: string; description: string; height: string; header?: ReactNode; children: ReactNode }) {
  return (
    <SheetContent
      side="bottom"
      showCloseButton={false}
      onOpenAutoFocus={event => event.preventDefault()}
      className={cn('gap-0 rounded-t-[20px] border-0 bg-card p-0 shadow-[0_-4px_40px_-8px_rgba(0,0,0,0.28)] dark:shadow-[0_-4px_48px_-8px_rgba(0,0,0,0.8)]', height)}
    >
      <span aria-hidden="true" className="mx-auto mt-2 block h-1 w-10 shrink-0 rounded-sm bg-ring/50" />
      <SheetHeader className={cn(!header && 'sr-only', header && 'p-0')}>
        <SheetTitle className={cn(header && 'sr-only')}>{title}</SheetTitle>
        <SheetDescription className={cn(header && 'sr-only')}>{description}</SheetDescription>
        {header}
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </SheetContent>
  )
}

/** The 人物 tab: a list of people, the relation graph with tone chips and zoom buttons, or the ring. */
function PeopleTab({ fromTab, ...s }: ShellState & { fromTab: boolean }) {
  const t = useT()
  // The URL's view picks the drawing; the list is this tab's own.
  const [mode, setMode] = useState<PeopleMode>(() => initialPeopleMode(s.view, fromTab))
  const pick = (next: PeopleMode) => {
    setMode(next)
    if (next !== 'list') s.onView(next)
  }
  const zoom = useZoom()
  const { scale, fit, zoomIn, zoomOut } = zoom
  const counts = new Map<string, number>()
  for (const entry of s.timeline.entries) for (const id of entry.event.character_ids) counts.set(id, (counts.get(id) ?? 0) + 1)
  const laneIds = new Set(s.timeline.lanes.map(c => c.key))
  const others = s.timeline.characters.filter(c => !laneIds.has(c.key)).sort((a, b) => (counts.get(b.key) ?? 0) - (counts.get(a.key) ?? 0) || a.name.localeCompare(b.name, 'zh'))
  const tones = TONES.filter(tone => toneCounts(s.data).has(tone))
  const allOn = tones.every(tone => s.graphOptions.tones.has(tone))
  // At a cursor, a faction with no member then fades.
  const members = factionMembers(s.graph.nodes, s.cursor)
  const only = (tone?: Tone) => s.onGraphOptions(o => ({ ...o, tones: new Set(tone ? [tone] : TONES) }))
  const v = viewProps(s, t)
  const kindOf = (c: typeof others[number]) => [t.category[c.metadata.category ?? ''] ?? c.metadata.category ?? t.person, c.metadata.kind === 'group' ? t.group : null].filter(Boolean).join(' · ')
  const row = (c: typeof others[number]) => (
    <button key={c.key} type="button" style={personColor(s.laneIndex, c.key)} onClick={() => s.select({ kind: 'character', id: c.key })} className="flex min-h-12 w-full items-center gap-2.5 rounded-[10px] px-3 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
      <i className="size-2.5 shrink-0 rounded-full bg-(--c)" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{c.name}</span>
        <span className="text-[11px] text-muted-foreground">{kindOf(c)}</span>
      </span>
      <span className="font-mono text-xs text-muted-foreground">{counts.get(c.key) ?? 0}</span>
      <ChevronRightIcon className="size-3.5 text-muted-foreground" />
    </button>
  )
  const heading = (label: string, n: number) => (
    <h2 className="sticky top-0 z-20 flex h-11 items-center gap-2 bg-card px-1.5 font-heading text-[17px] font-bold tracking-wide">{label}<Badge variant="secondary" className="font-mono font-normal">{n}</Badge></h2>
  )
  const seg = (
    <ToggleGroup type="single" variant="outline" size="sm" value={mode} onValueChange={value => value && pick(value as PeopleMode)} className="w-full *:h-9 *:flex-1 *:px-0 *:text-sm">
      <ToggleGroupItem value="list">{t.list}</ToggleGroupItem>
      <ToggleGroupItem value="graph">{t.graphView}</ToggleGroupItem>
      <ToggleGroupItem value="chord">{t.chordView}</ToggleGroupItem>
    </ToggleGroup>
  )

  if (mode === 'list') {
    return (
      <main aria-label={t.people} className="island min-h-0 flex-1 overflow-auto px-1.5 pt-1 pb-4">
        <div className="mx-1.5 mt-2 mb-1">{seg}</div>
        {heading(t.mainPeople, s.timeline.lanes.length)}
        {s.timeline.lanes.map(row)}
        {heading(t.otherPeople, others.length)}
        {others.map(row)}
      </main>
    )
  }
  return (
    <main aria-label={t.relations} className="island relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-col gap-2.5 border-b p-3 pb-2.5">
        {seg}
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
          <Toggle variant="outline" pressed={allOn} onPressedChange={() => only()} className="h-8 shrink-0 rounded-full bg-card px-3 text-[13px] font-normal data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background">{t.all}</Toggle>
          {tones.map(tone => (
            <Toggle key={tone} variant="outline" pressed={!allOn && s.graphOptions.tones.has(tone)} onPressedChange={() => only(tone)} className="h-8 shrink-0 rounded-full bg-card px-3 text-[13px] font-normal data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background">{t.tone[tone]}</Toggle>
          ))}
        </div>
        {s.graph.factions.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {s.graph.factions.map(f => (
              <Toggle key={f.id} variant="outline" pressed={s.highlight === f.id} onPressedChange={on => s.onHighlight(on ? f.id : undefined)} style={{ '--f': f.color } as CSSProperties} className={cn('h-8 shrink-0 gap-1.5 rounded-full bg-card px-3 text-[13px] font-normal data-[state=on]:border-(--f) data-[state=on]:bg-(--f)/15 data-[state=on]:text-foreground', !members.has(f.id) && 'opacity-50')}>
                <i className="size-2 rounded-full bg-(--f)" />{f.name}
              </Toggle>
            ))}
          </div>
        )}
      </div>
      <div aria-label={t.canvas} className="min-h-0 flex-1">
        {mode === 'chord'
          ? <ChordGraph {...v.chordGraph} />
          : <RelationGraph {...v.relationGraph} zoom={zoom} />}
      </div>
      {mode === 'graph' && <div className="absolute right-3 bottom-14 z-20 flex flex-col gap-1.5">
        {fab(t.zoomIn, zoomIn, <PlusIcon className="size-[18px]" />)}
        {fab(t.zoomOut, zoomOut, <MinusIcon className="size-[18px]" />)}
        {fab(t.fit, fit, <MaximizeIcon className="size-[18px]" />)}
        {fab(t.resetLayout, zoom.reset, <RotateCcwIcon className="size-[18px]" />)}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon-lg" aria-label={t.layoutForces} className="size-10 rounded-xl bg-card shadow-island data-open:bg-muted"><SlidersHorizontalIcon className="size-[18px]" /></Button>
          </PopoverTrigger>
          <PopoverContent side="left" align="end" className="w-56 p-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">{t.layoutForces}</p>
            <ForceControls forces={s.forces} onForces={s.onForces} />
          </PopoverContent>
        </Popover>
      </div>}
      <div className="shrink-0 border-t px-3 py-2">
        <GraphLegend compact cursor={Boolean(s.cursor)} trailing={<span className="ml-auto font-mono text-[11px] text-muted-foreground">{mode === 'chord' ? t.chordHint : t.zoomHint(Math.round(scale * 100))}</span>} />
      </div>
    </main>
  )
}

/** The 因果 tab: link kind chips, the events and their links, and zoom buttons. */
function CausalTab(s: ShellState) {
  const t = useT()
  const zoom = useZoom()
  const counts = kindCounts(s.data)
  const kinds = LINK_KINDS.filter(kind => counts.has(kind))
  const toggle = (kind: typeof kinds[number], on: boolean) => {
    const next = new Set(s.causalKinds)
    if (on) next.add(kind)
    else next.delete(kind)
    s.onCausalKinds(next)
  }
  return (
    <main aria-label={t.causalAria} className="island relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex gap-1.5 overflow-x-auto border-b p-3 pb-2.5 [scrollbar-width:none]">
        {kinds.map(kind => (
          <Toggle key={kind} variant="outline" pressed={s.causalKinds.has(kind)} onPressedChange={on => toggle(kind, on)} className="h-8 shrink-0 rounded-full bg-card px-3 text-[13px] font-normal data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background">
            {t.linkKind[kind]} <span className="font-mono text-[11px] opacity-70">{counts.get(kind)}</span>
          </Toggle>
        ))}
      </div>
      <div aria-label={t.canvas} className="min-h-0 flex-1">
        <CausalGraph {...viewProps(s, t).causalGraph} zoom={zoom} />
      </div>
      <div className="absolute right-3 bottom-14 z-20 flex flex-col gap-1.5">
        {fab(t.zoomIn, zoom.zoomIn, <PlusIcon className="size-[18px]" />)}
        {fab(t.zoomOut, zoom.zoomOut, <MinusIcon className="size-[18px]" />)}
        {fab(t.fit, zoom.fit, <MaximizeIcon className="size-[18px]" />)}
      </div>
      <div className="shrink-0 border-t px-3 py-2">
        <CausalLegend compact kinds={LINK_KINDS.filter(kind => s.causal.edges.some(e => e.kind === kind))} trailing={<span className="ml-auto font-mono text-[11px] text-muted-foreground">{t.zoomHint(Math.round(zoom.scale * 100))}</span>} />
      </div>
    </main>
  )
}
