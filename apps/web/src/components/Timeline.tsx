import { useMemo, type CSSProperties } from 'react'
import { SearchXIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useT } from '../i18n'
import { isAfter, type StoryCursor } from '../cursor/state'
import type { Character } from '../data/types'
import type { Section } from '../timeline/build'
import { EventCard } from './EventCard'
import { laneInitials, personColor, type LaneIndex } from './people'

/**
 * Two columns in one scrolling island: the lanes panel on the left, the events on the right.
 * Each lane is one slot of --lane-s; the panel adds half a slot of padding on each side, so
 * the edge-to-line and line-to-line distances are all one slot. Each event row draws its
 * anchors back into the panel, so they stay aligned with the row.
 */
const LAYOUT = [
  '[--lane-s:18px]',
  '[--lane-pad:calc(var(--lane-s)/2)]',
  '[--lanes-w:calc(var(--lanes)*var(--lane-s)+2*var(--lane-pad))]',
  '[--content-px:1.25rem]',
].join(' ')

/** The phone's sticky act bar: its height is the offset of the section headers under it. */
const ACT_BAR = 'h-[53px]'

export function Timeline({ sections, lanes, laneIndex, who, worldLane, worldHidden, selectedId, selectedCharacterId, cursor, onSelect, onCharacter, onWorld, onClear, phone = false }: {
  sections: Section[]
  lanes: Character[]
  laneIndex: LaneIndex
  who: string[]
  /** Show the 世界 lane: the project has world events. */
  worldLane: boolean
  /** The 隐藏世界事件 filter is on. */
  worldHidden: boolean
  selectedId?: string
  selectedCharacterId?: string
  /** The story as of one event: later events fade, and a line marks where the story stands. */
  cursor?: StoryCursor
  onSelect: (id: string) => void
  onCharacter: (id: string) => void
  /** Toggles the 隐藏世界事件 filter. */
  onWorld: () => void
  onClear: () => void
  /** Phone: no lanes, an act bar on top, two-line tiles with participant dots. */
  phone?: boolean
}) {
  const t = useT()
  // Two lanes that start with the same character (李明远, 李国栋) get distinct short labels.
  const initials = useMemo(() => laneInitials(lanes), [lanes])
  // A later event fades; the cursor event gets a line under it.
  const atCursor = (key: string) => cn(
    cursor && isAfter(cursor.order, cursor.at, key) && 'opacity-40',
    cursor?.event.key === key && 'after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-story',
  )
  const jump = (key: string) => document.getElementById(`sec-${key}`)?.scrollIntoView({ block: 'start' })
  if (!sections.length) {
    return (
      <Empty className="mt-8 px-5">
        <EmptyHeader>
          <EmptyMedia variant="icon"><SearchXIcon /></EmptyMedia>
          <EmptyTitle>{t.noMatch}</EmptyTitle>
          <EmptyDescription>{t.noMatchHint}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent><Button variant="outline" size="sm" onClick={onClear}>{t.clearFilter}</Button></EmptyContent>
      </Empty>
    )
  }

  if (phone) {
    return (
      <div>
        <nav aria-label={t.jump} className={cn('sticky top-0 z-30 flex items-center gap-1.5 overflow-x-auto border-b bg-card px-3 [scrollbar-width:none]', ACT_BAR)}>
          {sections.map(s => (
            <Button key={s.key} variant="outline" size="sm" onClick={() => jump(s.key)} className="h-8 shrink-0 gap-1.5 rounded-full bg-card px-3 text-[13px] font-normal">
              {s.label}
              <span className="font-mono text-[11px] opacity-75">{s.groups.reduce((n, g) => n + g.entries.length, 0)}</span>
            </Button>
          ))}
        </nav>
        <div className="px-3 pb-6">
          {sections.map(section => (
            <section key={section.key} id={`sec-${section.key}`} aria-label={section.label} className="scroll-mt-[53px]">
              <header className="sticky top-[53px] z-20 -mx-3 flex h-11 items-center gap-2 bg-card px-3">
                <h2 className="shrink-0 font-heading text-[17px] font-bold tracking-wide">{section.label}</h2>
                <Badge variant="secondary" className="font-mono font-normal">{t.count(section.groups.reduce((n, g) => n + g.entries.length, 0))}</Badge>
                {section.span && <span className="min-w-0 truncate text-xs text-muted-foreground" title={section.span}>{section.span}</span>}
              </header>
              <ActNote text={section.description} />
              {section.groups.map(group => (
                <div key={group.key} className="flex flex-col gap-1.5 pb-2.5">
                  <h3 className="py-0.5 font-mono text-[11px] font-medium text-muted-foreground">{group.label}</h3>
                  {group.entries.map(entry => (
                    <div key={entry.event.key} id={`ev-${entry.event.key}`} className={cn('relative scroll-mt-[6.5rem]', atCursor(entry.event.key))}>
                      <EventCard entry={entry} lanes={laneIndex} selected={entry.event.key === selectedId} onSelect={onSelect} compact />
                    </div>
                  ))}
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    )
  }

  const lane = (id: string) => cn(who.length > 0 && !who.includes(id) && 'opacity-35')
  const style = { '--lanes': lanes.length + (worldLane ? 1 : 0), '--c': 'var(--muted-foreground)' } as CSSProperties
  const worldLaneClass = cn('w-(--lane-s)', worldHidden && 'opacity-35')

  return (
    <div className={cn('grid min-h-full grid-cols-[var(--lanes-w)_minmax(0,1fr)]', LAYOUT)} style={style}>
      <div aria-label={t.lanes} className="relative border-r bg-strip">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex px-(--lane-pad)">
          {/* The 世界 lane comes first: world events have no participant, so they get a lane of their own. */}
          {worldLane && <span className={cn('relative before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:border-l before:border-dashed before:border-(--c)/50', worldLaneClass)} />}
          {lanes.map(c => (
            <span
              key={c.key}
              style={personColor(laneIndex, c.key)}
              className={cn(
                'relative w-(--lane-s) before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-(--c)/35',
                who.includes(c.key) && 'before:w-0.5 before:bg-(--c)',
                lane(c.key),
              )}
            />
          ))}
        </div>
        {/* As tall as the sticky section and day headers (h-12 + h-6), so rows under them hide their anchors too. */}
        <nav aria-label={t.laneNav} className="sticky top-0 z-20 h-18 border-b bg-strip px-(--lane-pad)">
          <div className="flex h-12 items-center">
          {worldLane && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label={t.worldEvents}
                  aria-pressed={worldHidden}
                  onClick={onWorld}
                  className={cn('min-w-0 rounded-sm px-0 text-xs font-bold text-person hover:bg-(--c)/15 hover:text-person aria-pressed:bg-(--c)/20', worldLaneClass)}
                >
                  {t.worldLane}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{worldHidden ? t.showWorld : t.hideWorldEvents}</TooltipContent>
            </Tooltip>
          )}
          {lanes.map(c => (
            <Tooltip key={c.key}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label={c.name}
                  aria-pressed={c.key === selectedCharacterId}
                  style={personColor(laneIndex, c.key)}
                  onClick={() => onCharacter(c.key)}
                  className={cn(
                    'w-(--lane-s) min-w-0 rounded-sm px-0 text-xs font-bold text-person hover:bg-(--c)/15 hover:text-person aria-pressed:bg-(--c)/20',
                    lane(c.key),
                  )}
                >
                  {initials.get(c.key)}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{c.name}</TooltipContent>
            </Tooltip>
          ))}
          </div>
        </nav>
      </div>

      <div className="min-w-0 px-(--content-px) pb-12">
        {sections.map(section => (
          <section key={section.key} id={`sec-${section.key}`} aria-label={section.label}>
            <header className="sticky top-0 z-20 flex h-12 items-center gap-3 bg-card">
              <h2 className="shrink-0 font-heading text-lg font-bold tracking-wide">{section.label}</h2>
              <Badge variant="secondary" className="font-mono font-normal">{t.count(section.groups.reduce((n, g) => n + g.entries.length, 0))}</Badge>
              {section.span && <span className="min-w-0 truncate text-xs text-muted-foreground" title={section.span}>{section.span}</span>}
            </header>
            <ActNote text={section.description} />
            {section.groups.map(group => (
              <div key={group.key}>
                <h3 className="sticky top-12 z-10 flex h-6 items-center gap-2 bg-card font-mono text-xs font-medium text-muted-foreground">
                  <span className="text-foreground/80">{group.label}</span>
                </h3>
                {group.entries.map(entry => (
                  <div key={entry.event.key} id={`ev-${entry.event.key}`} className={cn('relative scroll-mt-20 py-0.5', atCursor(entry.event.key))}>
                    <div aria-hidden="true" className="absolute inset-y-0 right-[calc(100%+var(--content-px))] flex w-(--lanes-w) items-center px-(--lane-pad)">
                      {/* A world event has no participant: a diamond in the 世界 lane and an era line across the other lanes. */}
                      {entry.world && <span className="absolute inset-x-(--lane-pad) top-1/2 border-t border-dashed border-foreground/40" />}
                      {worldLane && (
                        <span className={cn('relative flex justify-center', worldLaneClass)}>
                          {entry.world && <i className="block size-2.5 rotate-45 bg-foreground ring-2 ring-strip" />}
                        </span>
                      )}
                      {lanes.map(c => (
                        <span key={c.key} style={personColor(laneIndex, c.key)} className={cn('flex w-(--lane-s) justify-center', lane(c.key))}>
                          {entry.event.character_ids.includes(c.key) && <i className="block size-2.5 rounded-full bg-(--c) ring-2 ring-strip" />}
                        </span>
                      ))}
                    </div>
                    <EventCard entry={entry} lanes={laneIndex} selected={entry.event.key === selectedId} onSelect={onSelect} />
                  </div>
                ))}
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}

/** An act's summary under its heading, kept small so the events stay the focus. */
function ActNote({ text }: { text?: string }) {
  if (!text) return null
  return <p className="mb-2 max-w-prose text-xs leading-relaxed whitespace-pre-line text-muted-foreground">{text}</p>
}
