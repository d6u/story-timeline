import { useMemo, type ReactNode } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, HistoryIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useT } from '../i18n'
import { actStarts, type StoryCursor } from '../cursor/state'
import type { StoryEvent } from '../data/types'

/** Half the width of the range thumb, so the act ticks line up with where the thumb stands. */
const THUMB = 8

/**
 * The story cursor as a slim bar: a slider over the events in story order with a tick where each
 * act starts, steps back and on, the event the story stands at, and a way back to the whole story.
 * With no cursor the thumb rests at the end and the bar reads "whole story". `compact` is the
 * phone's two-line form, at the top; the desktop bar sits at the bottom, so its tips open upward.
 * `actions` go at the end of the bar.
 */
export function StoryScrubber({ events, cursor, onCursor, onStep, actions, compact = false, className }: {
  events: StoryEvent[]
  cursor?: StoryCursor
  onCursor: (key?: string) => void
  onStep: (delta: number) => void
  actions?: ReactNode
  compact?: boolean
  className?: string
}) {
  const t = useT()
  const acts = useMemo(() => actStarts(events), [events])
  if (!events.length) return null
  const last = events.length - 1
  const value = cursor?.at ?? last
  const pos = (i: number) => `calc(${THUMB}px + (100% - ${2 * THUMB}px) * ${last ? i / last : 0})`
  const act = cursor?.event.metadata.act
  const tip = compact ? 'bottom' : 'top'

  const step = (label: string, keyName: string, delta: number, icon: ReactNode) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} onClick={() => onStep(delta)} disabled={cursor && cursor.at === (delta < 0 ? 0 : last)} className="size-8 shrink-0 rounded-lg">{icon}</Button>
      </TooltipTrigger>
      <TooltipContent side={tip}>{label}<Kbd>{keyName}</Kbd></TooltipContent>
    </Tooltip>
  )
  const slider = (
    <div className="relative h-6 min-w-24 flex-1">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 h-0">
        {acts.map(a => (
          <span key={a.index} className="absolute -top-2 h-4 w-px bg-ring/60" style={{ left: pos(a.index) }} />
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={last}
        step={1}
        value={value}
        aria-label={t.cursorSlider}
        aria-valuetext={cursor ? cursor.event.title : t.wholeStory}
        onChange={e => onCursor(events[Number(e.target.value)].key)}
        className={cn('relative h-6 w-full cursor-pointer accent-primary', !cursor && 'opacity-60')}
      />
    </div>
  )
  const here = (
    <span className={cn('flex min-w-0 items-baseline gap-1.5', compact ? 'text-xs' : 'flex-[0_1_18rem]')}>
      {cursor ? (
        <>
          <span className={cn('shrink-0 text-xs text-muted-foreground', !compact && '@max-lg:hidden')}>{t.asOf}</span>
          {act && <span className={cn('shrink-0 text-xs text-muted-foreground', !compact && '@max-xl:hidden')}>{act} ·</span>}
          <span className="truncate font-medium">{cursor.event.title}</span>
          <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">{cursor.at + 1}/{events.length}</span>
        </>
      ) : (
        <span className="text-muted-foreground">{t.wholeStory}</span>
      )}
    </span>
  )
  const clear = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t.cursorClear} onClick={() => onCursor(undefined)} className={cn('size-8 shrink-0 rounded-lg', !cursor && 'invisible')}><XIcon /></Button>
      </TooltipTrigger>
      <TooltipContent side={tip}>{t.cursorClear}</TooltipContent>
    </Tooltip>
  )

  if (compact) {
    return (
      <section aria-label={t.cursor} className={cn('island flex shrink-0 flex-col gap-0.5 px-2 pt-1.5 pb-1', className)}>
        <div className="flex h-5 items-center gap-1.5 px-1.5"><HistoryIcon className="size-3.5 shrink-0 text-muted-foreground" />{here}</div>
        <div className="flex items-center gap-1">{step(t.cursorBack, '[', -1, <ChevronLeftIcon />)}{slider}{step(t.cursorOn, ']', 1, <ChevronRightIcon />)}{clear}{actions}</div>
      </section>
    )
  }
  return (
    <section aria-label={t.cursor} className={cn('@container island flex h-11 shrink-0 items-center gap-2 pr-2 pl-4', className)}>
      {/* The bar is as wide as the view above it; a narrow one drops the words before the title. */}
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"><HistoryIcon className="size-3.5" /><span className="@max-2xl:hidden">{t.cursor}</span></span>
      {step(t.cursorBack, '[', -1, <ChevronLeftIcon />)}
      {slider}
      {step(t.cursorOn, ']', 1, <ChevronRightIcon />)}
      {here}
      {clear}
      {actions}
    </section>
  )
}
