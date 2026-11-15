import { useState, type ReactNode } from 'react'
import { ChevronRightIcon, GitForkIcon, HistoryIcon, LightbulbIcon, Share2Icon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { FieldGroup, FieldLegend, FieldSet } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useT } from '../i18n'
import type { StoryCursor } from '../cursor/state'
import type { Character, ProjectData, StoryEvent } from '../data/types'
import { actPresence, filterInsights, GAP_KINDS, insightPeople, PROBLEM_KINDS, storyActs, TOP_COUNT, type GapItem, type Insight, type TurnSpan, type InsightCategory, type InsightFilter, type InsightKind } from '../insights/build'
import type { Selection } from './DetailPanel'
import { PersonBadge, personColor, type LaneIndex } from './people'
import type { View } from './shell-state'

/** The findings, grouped as the page lays them out. */
const GROUPS: [string, InsightKind[]][] = [
  ['causal', ['chain', 'root', 'turningPoint', 'setup']],
  ['irony', ['irony']],
  ['relations', ['turn', 'neverMeet', 'unstated']],
  ['presence', ['dominant', 'absence']],
  ['exits', ['exitsByAct', 'exitPeak']],
]
/** How many chips a list shows before "all". */
const CHIPS = 6
const ROW = 'h-7 w-full justify-start gap-2 rounded-md px-2 text-sm font-normal'
const COUNT = 'ml-auto font-mono text-[11px] text-muted-foreground'

interface Props {
  data: ProjectData
  /** The whole project, for the chips of data problems that name events after the cursor. Defaults to `data`. */
  whole?: ProjectData
  insights: Insight[]
  laneIndex: LaneIndex
  filter: InsightFilter
  onFilter: (filter: InsightFilter) => void
  selection?: Selection
  select: (selection: Selection) => void
  onView: (view: View) => void
  /** The story cursor; with one, `data` and `insights` are the story as of its event, and the header says so. */
  cursor?: StoryCursor
  onCursor: (key?: string) => void
  /** Hands the causality graph a chain of event keys to light; none clears it. */
  onTrail?: (ids?: string[]) => void
  /** Phone: the filter sits on top of the page, as there is no sidebar. */
  phone?: boolean
}

/** Everything a card needs to turn references into chips and actions. */
interface Ctx {
  byKey: Map<string, StoryEvent>
  byId: Map<string, Character>
  laneIndex: LaneIndex
  selection?: Selection
  select: (selection: Selection) => void
  /** Selects and switches view, so the view opens on the subject; `trail` is a chain of event keys for the causality graph to light. */
  show: (selection: Selection, view: View, trail?: string[]) => void
  onCursor: (key?: string) => void
}

/** The middle island of the insights view: a section per kind, each a compact card of findings or gaps. */
export function InsightsView({ data, whole = data, insights, laneIndex, filter, onFilter, selection, select, onView, cursor, onCursor, onTrail, phone = false }: Props) {
  const t = useT()
  const byKey = new Map(whole.events.map(e => [e.key, e]))
  const ctx: Ctx = {
    byKey, byId: new Map(whole.characters.map(c => [c.key, c])), laneIndex, selection, select, onCursor,
    show: (sel, view, trail) => { onTrail?.(trail); select(sel); onView(view) },
  }
  const shown = filterInsights(insights, filter, byKey)
  const byKind = new Map<InsightKind, Insight[]>()
  for (const i of shown) byKind.set(i.kind, [...(byKind.get(i.kind) ?? []), i])
  const groups = filter.category === 'finding'
    ? GROUPS.map(([name, kinds]) => [name, kinds.filter(k => byKind.has(k))] as const).filter(([, kinds]) => kinds.length)
    : ([['gaps', GAP_KINDS.filter(k => byKind.has(k))], ['problems', PROBLEM_KINDS.filter(k => byKind.has(k))]] as const).filter(([, kinds]) => kinds.length)
  const acts = storyActs(data.events)
  const presence = actPresence(data)

  return (
    <main aria-label={t.insightsAria} className={cn('island flex min-w-0 flex-1 flex-col overflow-hidden', phone && 'min-h-0')}>
      <div className={cn('flex shrink-0 items-center gap-2 border-b px-3', phone ? 'flex-wrap py-2.5' : 'h-12')}>
        {!phone && <h2 className="mx-1 font-heading text-base font-bold tracking-wide">{t.insightsView}</h2>}
        {phone ? <PhoneFilter data={data} insights={insights} filter={filter} onFilter={onFilter} /> : (
          <Badge variant="secondary" className="font-mono font-normal">{t.insightCount(insights.filter(i => i.category === 'finding').length, insights.filter(i => i.category === 'gap').length)}</Badge>
        )}
        {/* At a cursor the list is the story so far, as the scrubber reads it. */}
        {cursor && (
          <Badge variant="outline" title={`${t.asOf} ${cursor.event.title}`} className={cn('max-w-full min-w-0 gap-1 border-story/45 text-story', !phone && 'ml-auto')}>
            <HistoryIcon /><span className="shrink-0">{t.asOf}</span><span className="truncate">{cursor.event.title}</span>
          </Badge>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {groups.length ? (
          <div className={cn('mx-auto flex max-w-4xl flex-col gap-8 p-5', phone && 'gap-6 p-3')}>
            {groups.map(([name, kinds]) => (
              <section key={name} aria-labelledby={`ins-group-${name}`} className="flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <h2 id={`ins-group-${name}`} className="font-heading text-lg font-bold tracking-wide">{name === 'gaps' ? t.gaps : name === 'problems' ? t.problems : t.insightGroup[name]}</h2>
                  {/* The problems are of the data file: the cursor does not narrow them. */}
                  {name === 'problems' && <p className="text-xs text-muted-foreground">{t.problemsHint}</p>}
                </div>
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,22rem),1fr))]">
                  {kinds.map(kind => (
                    <KindCard key={kind} kind={kind} list={byKind.get(kind)!} ctx={ctx} acts={acts} presence={presence} total={data.events.length} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <Empty className="h-full">
            <EmptyHeader>
              <EmptyMedia variant="icon"><LightbulbIcon /></EmptyMedia>
              <EmptyTitle>{t.noInsights}</EmptyTitle>
              <EmptyDescription>{t.noInsightsHint}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </main>
  )
}

function CategoryToggle({ insights, filter, onFilter, className }: { insights: Insight[]; filter: InsightFilter; onFilter: (f: InsightFilter) => void; className?: string }) {
  const t = useT()
  const n = (c: InsightCategory) => insights.filter(i => i.category === c).length
  return (
    <ToggleGroup type="single" variant="outline" size="sm" aria-label={t.insightCategory} value={filter.category} onValueChange={value => value && onFilter({ ...filter, category: value as InsightCategory })} className={cn('w-full *:flex-1 *:px-0', className)}>
      <ToggleGroupItem value="finding" className="gap-1.5">{t.findings}<span className="font-mono text-[11px] text-muted-foreground">{n('finding')}</span></ToggleGroupItem>
      <ToggleGroupItem value="gap" className="gap-1.5">{t.gaps}<span className="font-mono text-[11px] text-muted-foreground">{n('gap')}</span></ToggleGroupItem>
    </ToggleGroup>
  )
}

/** The phone's filter bar: the category and a character picker. */
function PhoneFilter({ data, insights, filter, onFilter }: { data: ProjectData; insights: Insight[]; filter: InsightFilter; onFilter: (f: InsightFilter) => void }) {
  const t = useT()
  const people = insightPeople(data, insights.filter(i => i.category === filter.category))
  return (
    <>
      <CategoryToggle insights={insights} filter={filter} onFilter={onFilter} className="*:h-9 *:text-sm" />
      <Select value={filter.who ?? '*'} onValueChange={value => onFilter({ ...filter, who: value === '*' ? undefined : value })}>
        <SelectTrigger aria-label={t.insightPerson} className="h-9 w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="*">{t.anyone}</SelectItem>
          {people.map(p => <SelectItem key={p.character.key} value={p.character.key}>{p.character.name} · {p.count}</SelectItem>)}
        </SelectContent>
      </Select>
    </>
  )
}

/** The left island of the insights view: the category, the people to narrow to, and a jump list. */
export function InsightsSidebar({ data, insights, laneIndex, filter, onFilter }: { data: ProjectData; insights: Insight[]; laneIndex: LaneIndex; filter: InsightFilter; onFilter: (f: InsightFilter) => void }) {
  const t = useT()
  const byKey = new Map(data.events.map(e => [e.key, e]))
  const people = insightPeople(data, insights.filter(i => i.category === filter.category))
  const kinds = new Set(filterInsights(insights, filter, byKey).map(i => i.kind))
  const jump = filter.category === 'finding'
    ? GROUPS.filter(([, list]) => list.some(k => kinds.has(k))).map(([name]) => [name, t.insightGroup[name]] as const)
    : [...GAP_KINDS, ...PROBLEM_KINDS].filter(k => kinds.has(k)).map(k => [k, t.insightKind[k][0]] as const)
  const go = (id: string) => document.getElementById(filter.category === 'finding' ? `ins-group-${id}` : `ins-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })

  return (
    <FieldGroup className="gap-6 p-4 [&_[data-slot=field-legend]]:mb-0 [&_[data-slot=field-set]]:gap-2">
      <FieldSet>
        <FieldLegend variant="label">{t.insightCategory}</FieldLegend>
        <CategoryToggle insights={insights} filter={filter} onFilter={onFilter} />
      </FieldSet>
      {jump.length > 0 && (
        <FieldSet>
          <FieldLegend variant="label">{t.jump}</FieldLegend>
          <nav className="-mx-2 flex flex-col">
            {jump.map(([id, label]) => <Button key={id} variant="ghost" size="sm" className={ROW} onClick={() => go(id)}><span className="truncate">{label}</span></Button>)}
          </nav>
        </FieldSet>
      )}
      <FieldSet className="min-w-0">
        <FieldLegend variant="label">{t.insightPerson}</FieldLegend>
        <div className="-mx-2 flex flex-col">
          {people.map(({ character: c, count }) => (
            <Toggle key={c.key} size="sm" pressed={filter.who === c.key} onPressedChange={on => onFilter({ ...filter, who: on ? c.key : undefined })} style={personColor(laneIndex, c.key)} className={cn(ROW, 'data-[state=on]:bg-(--c)/15 data-[state=on]:text-person')}>
              <span className="size-2 shrink-0 rounded-full bg-(--c)" />
              <span className="truncate">{c.name}</span>
              <span className={COUNT}>{count}</span>
            </Toggle>
          ))}
        </div>
      </FieldSet>
    </FieldGroup>
  )
}

/** One kind as a card: its title, what it means, the count, and its rows; a long list shows its top rows until opened. */
function KindCard({ kind, list, ctx, acts, presence, total }: { kind: InsightKind; list: Insight[]; ctx: Ctx; acts: string[]; presence: Map<string, number[]>; total: number }) {
  const t = useT()
  const [all, setAll] = useState(false)
  const [title, hint] = t.insightKind[kind]
  const top = TOP_COUNT[kind] ?? Infinity
  const rows = all ? list : list.slice(0, top)
  const gap = list[0].category === 'gap'
  // A kind of one insight counts what is in it.
  const count = 'items' in list[0] ? list[0].items.length : kind === 'chain' ? list[0].events.length : kind === 'exitsByAct' ? list[0].score : list.length
  // A long list of rows (the irony cards, the turns) spans the whole width.
  const wide = kind === 'irony' || kind === 'turn' || kind === 'chain' || kind === 'setup' || kind === 'unstated' || kind === 'absence' || (gap && count > 8)
  return (
    <article id={`ins-${kind}`} aria-label={title} className={cn('flex min-w-0 scroll-mt-4 flex-col gap-3 rounded-xl border bg-card p-4', wide && 'col-span-full')}>
      <header className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <span className={cn('font-mono text-lg leading-none font-semibold', gap ? 'text-story' : 'text-muted-foreground')}>{count}</span>
      </header>
      <KindBody kind={kind} list={rows} ctx={ctx} acts={acts} presence={presence} total={total} />
      {list.length > top && (
        <Button variant="ghost" size="xs" aria-expanded={all} onClick={() => setAll(v => !v)} className="-mb-1 h-6 self-start px-1.5 text-xs text-muted-foreground">
          {all ? t.showFewer : t.showAllRows(list.length)}
        </Button>
      )}
    </article>
  )
}

function KindBody({ kind, list, ctx, acts, presence, total }: { kind: InsightKind; list: Insight[]; ctx: Ctx; acts: string[]; presence: Map<string, number[]>; total: number }) {
  const t = useT()
  const ev = (key: string) => <EventChip key={key} eventKey={key} ctx={ctx} />
  const who = (id: string) => <PersonChip key={id} id={id} ctx={ctx} />
  // A chain goes to the graph whole, so every step of it lights; a single event lights its causes and effects.
  const toCausal = (key: string, chain?: string[]) => <Action label={t.showInCausal} onClick={() => ctx.show({ kind: 'event', id: key }, 'causal', chain)}><GitForkIcon /></Action>
  const toGraph = (id: string) => <Action label={t.showInGraph} onClick={() => ctx.show({ kind: 'character', id }, 'graph')}><Share2Icon /></Action>
  const asOf = (key: string) => <Action label={t.viewAsOf} onClick={() => ctx.onCursor(key)}><HistoryIcon /></Action>
  const max = Math.max(...list.map(i => i.score))

  switch (kind) {
    case 'chain': {
      const [c] = list
      return (
        <Line trailing={toCausal(c.events[0], c.events)}>
          <div className="flex flex-wrap items-center gap-1">
            {c.events.map((key, i) => <span key={key} className="flex items-center gap-1">{i > 0 && <ChevronRightIcon className="size-3 text-muted-foreground" />}{ev(key)}</span>)}
          </div>
        </Line>
      )
    }
    case 'root':
    case 'turningPoint':
      return (
        <Rows>
          {list.map(i => (
            <Line key={i.id} trailing={toCausal(i.events[0])}>
              {ev(i.events[0])}
              <Meter value={i.score} max={max} label={t.reachN(i.score)} />
            </Line>
          ))}
        </Rows>
      )
    case 'setup':
      return (
        <Rows>
          {list.map(i => i.kind === 'setup' && (
            <Line key={i.id} trailing={toCausal(i.events[0])}>
              {ev(i.events[0])}<ChevronRightIcon className="size-3 shrink-0 text-muted-foreground" />{ev(i.events[1])}
              <Meter value={i.distance} max={total} label={t.apart(i.distance)} />
            </Line>
          ))}
        </Rows>
      )
    case 'irony':
      return (
        <Rows divided>
          {list.map(i => i.kind === 'irony' && (
            <div key={i.id} className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
              <Line trailing={asOf(i.events[0])}>
                <span className="min-w-0 text-sm font-medium">{t.ironyLine(i.text)}</span>
              </Line>
              <Folded count={t.ironyScenes(i.shared)} chips={i.events.slice(0, -1).map(ev)}>
                {who(i.characters[0])}<span>{t.ironyLate}</span>{ev(i.events.at(-1)!)}{t.ironyLearns && <span>{t.ironyLearns}</span>}
                <span className="ml-1">{t.ironyWith}</span>{i.characters.slice(1).map(who)}
              </Folded>
            </div>
          ))}
        </Rows>
      )
    case 'turn':
      return (
        <Rows divided>
          {list.map(i => i.kind === 'turn' && (
            <div key={i.id} className="flex flex-col gap-1.5 py-2 first:pt-0 last:pb-0">
              <Line trailing={<>{asOf(i.events[0])}{toGraph(i.characters[0])}</>}>
                {who(i.characters[0])}<span className="text-muted-foreground">—</span>{who(i.characters[1])}
              </Line>
              <Spans spans={i.spans} ev={ev} />
            </div>
          ))}
        </Rows>
      )
    case 'neverMeet':
      return (
        <Rows>
          {list.map(i => i.kind === 'neverMeet' && (
            <Line key={i.id} trailing={toGraph(i.characters[0])}>
              {who(i.characters[0])}<span className="text-muted-foreground">—</span>{who(i.characters[1])}
              <Badge variant="outline" className="ml-auto">{i.label}</Badge>
            </Line>
          ))}
        </Rows>
      )
    case 'unstated':
      return (
        <Rows divided>
          {list.map(i => i.kind === 'unstated' && (
            <div key={i.id} className="flex items-start gap-1.5 py-2 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <Folded count={t.together(i.shared)} chips={i.events.map(ev)}>
                  {who(i.characters[0])}<span>—</span>{who(i.characters[1])}
                </Folded>
              </div>
              {toGraph(i.characters[0])}
            </div>
          ))}
        </Rows>
      )
    case 'dominant':
      return (
        <Rows>
          {list.map(i => i.kind === 'dominant' && (
            <Line key={i.id}>
              <span className="w-24 shrink-0 truncate text-xs text-muted-foreground" title={i.act}>{i.act}</span>
              {who(i.characters[0])}
              <Meter value={i.count} max={i.actSize} label={t.ofAct(i.count, i.actSize)} />
            </Line>
          ))}
        </Rows>
      )
    case 'absence':
      return (
        <Rows divided>
          {list.map(i => i.kind === 'absence' && (
            <div key={i.id} className="flex flex-col gap-1.5 py-2 first:pt-0 last:pb-0">
              <Line>
                {who(i.characters[0])}
                <span className="font-mono text-xs text-muted-foreground">{t.goneFor(i.gap)}</span>
                <Strip acts={acts} counts={presence.get(i.characters[0]) ?? []} ctx={ctx} id={i.characters[0]} />
              </Line>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span>{t.goneAfter}</span>{ev(i.events[0])}<ChevronRightIcon className="size-3" /><span>{t.backAt}</span>{ev(i.events[1])}
              </div>
            </div>
          ))}
        </Rows>
      )
    case 'exitsByAct': {
      const [c] = list
      if (c.kind !== 'exitsByAct') return null
      const most = Math.max(1, ...c.acts.map(a => a.dies + a.leaves))
      return (
        <div className="flex flex-col gap-1.5">
          {c.acts.map(a => (
            <div key={a.act} className="flex items-center gap-2 text-xs">
              <span className="w-24 shrink-0 truncate text-muted-foreground" title={a.act}>{a.act}</span>
              <span className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                <i className="h-full bg-destructive/70" style={{ width: `${(a.dies / most) * 100}%` }} />
                <i className="h-full bg-ring" style={{ width: `${(a.leaves / most) * 100}%` }} />
              </span>
              <span className="w-14 shrink-0 text-right font-mono text-muted-foreground">{a.dies}{a.leaves > 0 && ` + ${a.leaves}`}</span>
            </div>
          ))}
          <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-destructive/70" />{t.exit.dies}</span>
            <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-ring" />{t.exit.leaves}</span>
          </div>
        </div>
      )
    }
    case 'exitPeak':
      return (
        <Rows divided>
          {list.map(i => i.kind === 'exitPeak' && (
            <div key={i.id} className="flex flex-col gap-1.5 py-2 first:pt-0 last:pb-0">
              <Line trailing={asOf(i.events[0])}>{ev(i.events[0])}<span className="ml-auto font-mono text-xs text-muted-foreground">{t.exitsN(i.exits)}</span></Line>
              <Chips items={i.characters.map(who)} />
            </div>
          ))}
        </Rows>
      )
    default: {
      const [c] = list
      return 'items' in c ? <Chips items={c.items.map((item, j) => <GapRow key={j} item={item} ev={ev} who={who} named={'file' in c} />)} limit={12} /> : null
    }
  }
}

/**
 * The relation rows of a pair in order: each label between the events that start and end it.
 * Where one row ends at the event the next starts at, the event shows once, as the turn.
 */
function Spans({ spans, ev }: { spans: TurnSpan[]; ev: (key: string) => ReactNode }) {
  const arrow = <ChevronRightIcon className="size-3 shrink-0" />
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      {spans.map((s, j) => {
        const joined = j > 0 && s.since !== undefined && spans[j - 1].until === s.since
        return (
          <span key={j} className="contents">
            {j > 0 && !joined && <span className="px-1">·</span>}
            {s.since && !joined && <>{ev(s.since)}{arrow}</>}
            <Badge variant="outline" className="text-foreground">{s.label}</Badge>
            {s.until && <>{arrow}{ev(s.until)}{spans[j + 1]?.since === s.until && arrow}</>}
          </span>
        )
      })}
    </div>
  )
}

/** One item of a data gap: its events and characters as chips, and its label. With `named`, a data problem, the characters are part of the item. */
function GapRow({ item, ev, who, named = false }: { item: GapItem; ev: (key: string) => ReactNode; who: (id: string) => ReactNode; named?: boolean }) {
  const t = useT()
  // An event's own participants are context, not the item; only the event is shown.
  const people = item.events.length && !named ? [] : item.characters
  return (
    <span className={cn('flex max-w-full min-w-0 items-center gap-1', named && 'flex-wrap', (people.length > 1 || item.label || item.note || item.events.length > 1) && 'rounded-lg bg-muted/60 py-0.5 pr-2 pl-0.5')}>
      {item.note && <Badge variant="outline" className="h-5 px-1.5 text-[11px] font-normal">{t.problemNote[item.note]}</Badge>}
      {item.events.map((key, i) => <span key={`${key}:${i}`} className="flex items-center gap-1">{i > 0 && <ChevronRightIcon className="size-3 text-muted-foreground" />}{ev(key)}</span>)}
      {people.map((id, i) => <span key={`${id}:${i}`} className="flex items-center gap-1">{i > 0 && <ChevronRightIcon className="size-3 text-muted-foreground" />}{who(id)}</span>)}
      {item.label && <span className="truncate text-xs text-muted-foreground" title={item.label}>{item.label}</span>}
    </span>
  )
}

function Rows({ children, divided = false }: { children: ReactNode; divided?: boolean }) {
  return <div className={cn('flex flex-col', divided ? 'divide-y' : 'gap-1.5')}>{children}</div>
}

/** A row: its content, then its actions at the end. */
function Line({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">{children}</div>
      {trailing && <div className="flex shrink-0 items-center">{trailing}</div>}
    </div>
  )
}

/** A bar for a number, as a share of `max`, with the number written beside it. */
function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted max-sm:w-10">
        <i className="block h-full rounded-full bg-story/80" style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` }} />
      </span>
      <span className="min-w-14 text-right font-mono text-xs text-muted-foreground">{label}</span>
    </span>
  )
}

/** A character's events per act, as one small bar per act. */
function Strip({ acts, counts, ctx, id }: { acts: string[]; counts: number[]; ctx: Ctx; id: string }) {
  const most = Math.max(1, ...counts)
  return (
    <span aria-hidden="true" className="ml-auto flex h-4 shrink-0 items-end gap-0.5" style={personColor(ctx.laneIndex, id)}>
      {acts.map((act, i) => (
        <i key={act} title={`${act} · ${counts[i] ?? 0}`} className={cn('w-2 rounded-[2px]', counts[i] ? 'bg-(--c)' : 'bg-muted')} style={{ height: `${counts[i] ? 25 + (75 * counts[i]) / most : 15}%` }} />
      ))}
    </span>
  )
}

/** A line of chips and words, with a count that shows or hides the events behind it. */
function Folded({ count, chips, children }: { count: string; chips: ReactNode[]; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {children}
        <Button variant="ghost" size="xs" aria-expanded={open} onClick={() => setOpen(v => !v)} className="ml-auto h-6 gap-0.5 px-1.5 font-mono text-xs font-normal text-muted-foreground">
          {count}<ChevronRightIcon className={cn('size-3 transition-transform', open && 'rotate-90')} />
        </Button>
      </div>
      {open && <div className="flex flex-wrap items-center gap-1.5">{chips}</div>}
    </div>
  )
}

/** Chips that wrap, the first `limit` of them, and a button for the rest. */
function Chips({ items, limit = CHIPS }: { items: ReactNode[]; limit?: number }) {
  const t = useT()
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, limit)
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown}
      {items.length > limit && (
        <Button variant="ghost" size="xs" className="h-6 px-1.5 text-xs text-muted-foreground" onClick={() => setAll(v => !v)}>
          {all ? t.less : t.showAll(items.length)}
        </Button>
      )}
    </div>
  )
}

/** An event as a chip; a click selects it. Core events carry the story accent. */
function EventChip({ eventKey, ctx }: { eventKey: string; ctx: Ctx }) {
  const e = ctx.byKey.get(eventKey)
  if (!e) return <span className="text-xs text-muted-foreground">{eventKey}</span>
  const pressed = ctx.selection?.kind === 'event' && ctx.selection.id === e.key
  return (
    <button
      type="button"
      title={e.title}
      aria-pressed={pressed}
      onClick={() => ctx.select({ kind: 'event', id: e.key })}
      className={cn(
        'inline-flex h-6 max-w-56 min-w-0 shrink items-center gap-1.5 rounded-md border bg-card px-1.5 text-xs outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:border-foreground/40 aria-pressed:bg-muted',
      )}
    >
      <i className={cn('h-3 w-[3px] shrink-0 rounded-full', e.is_core ? 'bg-story' : 'bg-ring/50')} />
      <span className="truncate">{e.title}</span>
    </button>
  )
}

function PersonChip({ id, ctx }: { id: string; ctx: Ctx }) {
  const c = ctx.byId.get(id)
  if (!c) return <span className="text-xs text-muted-foreground">{id}</span>
  const pressed = ctx.selection?.kind === 'character' && ctx.selection.id === id
  return <PersonBadge character={c} lanes={ctx.laneIndex} onClick={() => ctx.select({ kind: 'character', id })} className={cn('h-6 max-w-40 truncate', pressed && 'ring-2 ring-(--c)/50')} />
}

function Action({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} className="size-7 text-muted-foreground">{children}</Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}
