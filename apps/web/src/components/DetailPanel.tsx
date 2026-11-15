import type { ReactNode } from 'react'
import { ArrowDownIcon, ChevronDownIcon, ChevronUpIcon, FilterIcon, HistoryIcon, MousePointerClickIcon, XIcon } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Kbd } from '@/components/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useT } from '../i18n'
import { briefFileName, characterBrief, eventBrief } from '../brief/build'
import { isAfter, knownAt, phaseAt, stageAt, type StoryCursor } from '../cursor/state'
import type { ArcBeat, Character, CharacterRelation, EventMetadata, ProjectData } from '../data/types'
import type { Entry, Timeline } from '../timeline/build'
import { CopyBrief } from './CopyBrief'
import { PersonBadge, type LaneIndex } from './people'
import { ConfidenceBadge, EventLearnings, EventLinks, EventReference, KnowledgeList, NameList, Participants, PlaceDetails, Relations, SourceList } from './ModuleDetails.tsx'

export type Selection = { kind: 'event' | 'character'; id: string }


function Paragraphs({ text }: { text?: string | null }) {
  if (!text) return null
  return <div className="flex flex-col gap-3 leading-relaxed">{text.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}</div>
}

/** A collapsible section of the detail panel. `id` stays stable while the title can carry counts. */
export interface Section {
  id: string
  title: ReactNode
  content: ReactNode
}

/** Section ids the reader collapsed; kept across selections. */
export const initialCollapsed = new Set<string>()

function Sections({ items, collapsed, onCollapsedChange }: {
  items: Section[]
  collapsed: Set<string>
  onCollapsedChange: (collapsed: Set<string>) => void
}) {
  const ids = items.map(item => item.id)
  const change = (open: string[]) => {
    const next = new Set(collapsed)
    for (const id of ids) {
      if (open.includes(id)) next.delete(id)
      else next.add(id)
    }
    onCollapsedChange(next)
  }
  return (
    <Accordion type="multiple" value={ids.filter(id => !collapsed.has(id))} onValueChange={change} className="border-t">
      {items.map(item => (
        <AccordionItem key={item.id} value={item.id}>
          <AccordionTrigger className="py-3 text-xs text-muted-foreground hover:text-foreground hover:no-underline">{item.title}</AccordionTrigger>
          <AccordionContent className="pb-4 [&_p:not(:last-child)]:mb-0">{item.content}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

function Facts({ items, className }: { items: [string, ReactNode][]; className?: string }) {
  if (!items.length) return null
  return (
    <dl className={cn('grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5', className)}>
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="break-words">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function IconButton({ label, shortcut, onClick, children }: { label: string; shortcut?: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon-sm" aria-label={label} onClick={onClick} className="size-8 rounded-lg">{children}</Button>
      </TooltipTrigger>
      <TooltipContent>{label}{shortcut && <Kbd>{shortcut}</Kbd>}</TooltipContent>
    </Tooltip>
  )
}

interface SectionProps {
  collapsed: Set<string>
  onCollapsedChange: (collapsed: Set<string>) => void
}

function EventDetail({ entry, timeline, lanes, onSelect, cursor, onCursor, ...sections }: SectionProps & CursorProps & {
  entry: Entry
  timeline: Timeline
  lanes: LaneIndex
  onSelect: (s: Selection) => void
}) {
  const t = useT()
  const { event } = entry
  const m: EventMetadata = event.metadata ?? {}
  const rows: [string, string | null | undefined][] = [[t.time, entry.timeLabel], [t.act, entry.act], [t.place, m.placeInfo?.name]]
  const facts = rows.filter((f): f is [string, string] => Boolean(f[1]))
  const items: Section[] = [
    ...(entry.characters.length ? [{
      id: 'people',
      title: `${t.peopleSec} · ${entry.characters.length}`,
      content: <Participants people={m.participants ?? entry.characters.map(c => ({ character_id: c.key }))} timeline={timeline} lanes={lanes} onSelect={onSelect} />,
    }] : []),
    ...(m.learns?.length ? [{ id: 'learns', title: `${t.learnsSec} · ${m.learns.length}`, content: <EventLearnings items={m.learns} timeline={timeline} lanes={lanes} onSelect={onSelect} /> }] : []),
    ...(m.placeInfo ? [{ id: 'place', title: t.placeSec, content: <PlaceDetails place={m.placeInfo} /> }] : []),
    ...(m.links?.length ? [{ id: 'links', title: `${t.linksSec} · ${m.links.length}`, content: <EventLinks links={m.links} timeline={timeline} onSelect={onSelect} /> }] : []),
    ...(m.sources?.length ? [{ id: 'sources', title: `${t.sourcesSec} · ${m.sources.length}`, content: <SourceList sources={m.sources} /> }] : []),
  ]

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{entry.world ? t.worldEvent : t.scene}</Badge>
          {entry.act && <Badge variant="outline">{entry.act}</Badge>}
          <ConfidenceBadge value={m.confidence} />
          {event.is_core && <Badge variant="outline" className="border-story/45 text-story">{t.coreBadge}</Badge>}
        </div>
        <h2 className="font-heading text-2xl leading-snug font-bold tracking-wide">{event.title}</h2>
      </div>
      {onCursor && (
        <div className="flex flex-wrap items-center gap-2">
          {cursor?.event.key === event.key ? (
            <>
              <Badge variant="outline" className="gap-1 border-story/45 text-story"><HistoryIcon />{t.cursorHere}</Badge>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onCursor(undefined)}>{t.cursorClear}</Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => onCursor(event.key)}><HistoryIcon />{t.viewAsOf}</Button>
          )}
        </div>
      )}
      <Facts items={facts} />
      <Paragraphs text={event.description} />
      <Sections items={items} {...sections} />
    </>
  )
}

/** The arc, stage by stage. At a cursor, `current` stands out and the stages not reached yet fade. */
function ArcStages({ beats, timeline, onSelect, cursor, current }: { beats: ArcBeat[]; timeline: Timeline; onSelect: (s: Selection) => void; cursor?: StoryCursor; current?: number }) {
  const t = useT()
  const ahead = (b: ArcBeat) => Boolean(cursor && b.since && isAfter(cursor.order, cursor.at, b.since))
  return (
    <ol className="flex flex-col items-stretch">
      {beats.map((b, i) => (
        <li key={i} className={cn('flex flex-col items-center', ahead(b) && 'opacity-45')}>
          {i > 0 && <ArrowDownIcon aria-hidden="true" className="my-1 size-4 text-muted-foreground" />}
          <Card size="sm" className={cn('w-full gap-3', i === current && 'ring-2 ring-story/60')}>
            <CardHeader className="gap-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="font-mono">{i + 1}</Badge>
                <CardTitle className="text-sm font-semibold">{b.stage}</CardTitle>
                {i === current && <Badge variant="outline" className="border-story/45 text-story">{t.stageNow}</Badge>}
              </div>
              {b.when && <CardDescription className="font-mono text-xs">{b.when}</CardDescription>}
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {b.since && <EventReference event={b.since} timeline={timeline} onSelect={onSelect} />}
              <Paragraphs text={b.description} />
            </CardContent>
          </Card>
        </li>
      ))}
    </ol>
  )
}

/** Where a character stands at the cursor: present, not introduced yet, or gone at an event. */
function StatusLine({ cursor, id, timeline, onSelect }: { cursor: StoryCursor; id: string; timeline: Timeline; onSelect: (s: Selection) => void }) {
  const t = useT()
  const status = cursor.status.get(id) ?? { kind: 'present' }
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Badge variant={status.kind === 'dead' ? 'destructive' : status.kind === 'present' ? 'secondary' : 'outline'}>{t.status[status.kind]}</Badge>
      {'event' in status && <EventReference event={status.event} timeline={timeline} onSelect={onSelect} />}
    </span>
  )
}

function CharacterDetail({ character, timeline, lanes, onSelect, onOnly, cursor, ...sections }: SectionProps & {
  cursor?: StoryCursor
  character: Character
  timeline: Timeline
  lanes: LaneIndex
  onSelect: (s: Selection) => void
  onOnly: (id: string) => void
}) {
  const t = useT()
  const m = character.metadata ?? {}
  const events = timeline.entries.filter(e => e.event.character_ids.includes(character.key))
  const relations = m.relations ?? []
  const sides = relations.filter(r => r.member && !r.incoming && timeline.characterById.get(r.character_id)?.metadata.kind === 'group')
  const otherRelations = relations.filter(r => !sides.includes(r))
  const beats = m.reading?.beats ?? []
  const stage = cursor ? stageAt(beats, cursor.order, cursor.at) : undefined
  const knowledge = m.knowledge ?? []
  const known = cursor ? knownAt(knowledge, cursor.order, cursor.at) : knowledge
  const facts: [string, ReactNode][] = [
    ...(cursor ? [[t.nowLabel, <StatusLine cursor={cursor} id={character.key} timeline={timeline} onSelect={onSelect} />] as [string, ReactNode]] : []),
    ...(stage !== undefined ? [[t.stageNow, beats[stage].stage ?? stage + 1] as [string, ReactNode]] : []),
    ...(m.aliases?.length ? [[t.aliases, m.names ? <NameList names={m.names} /> : m.aliases.join(t.listSep)] as [string, ReactNode]] : []),
  ]
  // At a cursor, the relations that hold come first, then those that ended or have not started.
  const relationSection = (id: string, title: string, rows: CharacterRelation[], label?: string): Section => {
    if (!cursor) return { id, title: `${title} · ${rows.length}`, content: <Relations label={label} character={character} rows={rows} timeline={timeline} lanes={lanes} onSelect={onSelect} /> }
    const phaseOf = (r: CharacterRelation) => phaseAt(r, cursor.order, cursor.at)
    const now = rows.filter(r => phaseOf(r) === 'active')
    const other = rows.filter(r => phaseOf(r) !== 'active')
    return {
      id,
      title: `${title} · ${now.length}/${rows.length}`,
      content: (
        <div className="flex flex-col gap-3">
          {now.length > 0 && <Relations label={`${label ?? title} · ${t.relNow}`} character={character} rows={now} timeline={timeline} lanes={lanes} onSelect={onSelect} />}
          {other.length > 0 && (
            <>
              <h4 className="text-xs text-muted-foreground">{t.relNotNow}</h4>
              <div className="opacity-70"><Relations label={`${label ?? title} · ${t.relNotNow}`} character={character} rows={other} timeline={timeline} lanes={lanes} onSelect={onSelect} phaseOf={phaseOf} /></div>
            </>
          )}
        </div>
      ),
    }
  }
  const items: Section[] = [
    ...(sides.length ? [relationSection('sides', t.sidesSec, sides, t.sidesSec)] : []),
    ...(otherRelations.length ? [relationSection('relations', t.relSec, otherRelations)] : []),
    ...(knowledge.length ? [{
      id: 'knowledge',
      title: cursor ? `${t.knowledgeSec} · ${known.length}/${knowledge.length}` : `${t.knowledgeSec} · ${knowledge.length}`,
      content: (
        <div className="flex flex-col gap-3">
          {known.length > 0 && <KnowledgeList items={known} timeline={timeline} onSelect={onSelect} />}
          {known.length < knowledge.length && <p className="text-xs text-muted-foreground">{t.notKnown(knowledge.length - known.length)}</p>}
        </div>
      ),
    }] : []),
    ...(beats.length ? [{
      id: 'arc',
      title: `${t.arcSec} · ${beats.length}`,
      content: <ArcStages beats={beats} timeline={timeline} onSelect={onSelect} cursor={cursor} current={stage} />,
    }] : []),
    {
      id: 'events',
      title: `${t.eventsSec} · ${events.length}`,
      content: (
        <div className="flex flex-col gap-2">
          {events.length > 0 && (
            <div><Button variant="outline" size="sm" onClick={() => onOnly(character.key)}><FilterIcon />{t.onlyThis}</Button></div>
          )}
          <ul className="-mx-2 flex flex-col">
            {events.map(e => (
              <li key={e.event.key} className={cn(cursor && isAfter(cursor.order, cursor.at, e.event.key) && 'opacity-45')}>
                <Button variant="ghost" size="sm" className="h-auto w-full justify-start gap-3 py-1 font-normal whitespace-normal" onClick={() => onSelect({ kind: 'event', id: e.event.key })}>
                  <span className="w-16 shrink-0 text-left font-mono text-[11px] text-muted-foreground">{e.timeLabel}</span>
                  <span className="text-left">{e.event.title}</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ),
    },
  ]
  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{t.category[m.category ?? ''] ?? m.category ?? t.person}</Badge>
          {m.kind === 'group' && <Badge variant="outline">{t.group}</Badge>}
          {m.color && <Badge variant="outline" title={m.color} className="gap-1.5 font-mono"><i className="size-2.5 rounded-full" style={{ background: m.color }} />{t.customColor}</Badge>}
        </div>
        <h2><PersonBadge character={character} lanes={lanes} className="h-8 px-3 font-heading text-xl font-bold" /></h2>
      </div>
      <Facts items={facts} />
      <Paragraphs text={character.description} />
      <Sections items={items} {...sections} />
    </>
  )
}

interface CursorProps {
  /** The story as of one event. */
  cursor?: StoryCursor
  /** Sets the story cursor to an event key, or clears it. */
  onCursor?: (key?: string) => void
}

export function DetailPanel({ selection, data, timeline, lanes, inSheet, collapsed, onCollapsedChange, onSelect, onClose, onOnly, onStep, cursor, onCursor }: SectionProps & CursorProps & {
  selection?: Selection
  /** The project, for the brief the copy button writes. */
  data: ProjectData
  timeline: Timeline
  lanes: LaneIndex
  /** In a sheet, the sheet supplies its own close button. */
  inSheet?: boolean
  onSelect: (s: Selection) => void
  onClose: () => void
  onOnly: (id: string) => void
  onStep: (delta: number) => void
}) {
  const t = useT()
  const entry = selection?.kind === 'event' ? timeline.entries.find(e => e.event.key === selection.id) : undefined
  const character = selection?.kind === 'character' ? timeline.characterById.get(selection.id) : undefined
  if (!entry && !character) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon"><MousePointerClickIcon /></EmptyMedia>
          <EmptyTitle>{t.noneSelected}</EmptyTitle>
          <EmptyDescription>{t.selectHint}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  const sections = { collapsed, onCollapsedChange }
  return (
    <div className="flex flex-col gap-5 px-5 pb-10 text-sm">
      <div className={cn('sticky top-0 z-10 -mx-1 flex justify-end gap-1.5 bg-card px-1 py-3', inSheet && 'bg-popover pr-10')}>
        {entry && <CopyBrief label={t.copyBrief} brief={() => eventBrief(data, entry.event.key, t)} file={briefFileName(data.id, entry.event.key)} downloadLabel={t.downloadBrief} />}
        {character && (
          <CopyBrief
            label={t.copyBriefAsOf(t.copyBrief, cursor?.event.title)}
            brief={() => characterBrief(data, character.key, t, cursor)}
            file={briefFileName(data.id, character.key, cursor ? `at-${cursor.event.key}` : '')}
            downloadLabel={t.copyBriefAsOf(t.downloadBrief, cursor?.event.title)}
          />
        )}
        {entry && (
          <>
            <IconButton label={t.prev} shortcut="K" onClick={() => onStep(-1)}><ChevronUpIcon /></IconButton>
            <IconButton label={t.next} shortcut="J" onClick={() => onStep(1)}><ChevronDownIcon /></IconButton>
          </>
        )}
        {!inSheet && <IconButton label={t.close} shortcut="Esc" onClick={onClose}><XIcon /></IconButton>}
      </div>
      {entry && <EventDetail entry={entry} timeline={timeline} lanes={lanes} onSelect={onSelect} cursor={cursor} onCursor={onCursor} {...sections} />}
      {character && <CharacterDetail character={character} timeline={timeline} lanes={lanes} onSelect={onSelect} onOnly={onOnly} cursor={cursor} {...sections} />}
    </div>
  )
}
