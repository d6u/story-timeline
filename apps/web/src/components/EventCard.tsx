import { useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { cn } from '@/lib/utils'
import { useT } from '../i18n'
import type { Entry } from '../timeline/build'
import { personColor, type LaneIndex } from './people'

/** The orange pill on the left edge of a core event. Drawn inside the tile, so the corners stay round. */
const CORE = 'before:absolute before:top-[7px] before:bottom-[7px] before:left-[3px] before:w-[3px] before:rounded-xs before:bg-story'

/**
 * Desktop: one line, title and clipped description; participants show on the lanes, and hover shows
 * what the row clips (the whole title, the whole description), nothing when it clips nothing.
 * Phone (`compact`): two lines with participant dots, no hover.
 */
export function EventCard({ entry, lanes, selected, onSelect, compact = false }: {
  entry: Entry
  lanes: LaneIndex
  selected: boolean
  onSelect: (id: string) => void
  compact?: boolean
}) {
  const t = useT()
  const { event } = entry
  // Close the hover text on click, so it does not cover the detail panel.
  const [hover, setHover] = useState(false)
  // What the row clips, measured when the hover would open.
  const [clipped, setClipped] = useState({ title: false, text: false })
  const titleEl = useRef<HTMLSpanElement>(null)
  const textEl = useRef<HTMLSpanElement>(null)
  const cut = (el: HTMLElement | null) => Boolean(el && el.scrollWidth > el.clientWidth + 1)
  const onHover = (open: boolean) => {
    if (!open) return setHover(false)
    const next = { title: cut(titleEl.current), text: cut(textEl.current) }
    setClipped(next)
    setHover(next.title || next.text)
  }
  const dots = entry.characters.map(c => <i key={c.key} style={personColor(lanes, c.key)} className="block size-[7px] rounded-full bg-(--c)" />)
  const worldBadge = entry.world && <Badge variant="outline" className="shrink-0 px-1.5 font-normal">{t.world}</Badge>

  if (compact) {
    return (
      <Button
        variant="outline"
        aria-pressed={selected}
        onClick={() => onSelect(event.key)}
        className={cn(
          'relative h-auto w-full min-w-0 flex-col items-stretch gap-0.5 rounded-[10px] px-3 py-2 text-left font-normal',
          event.is_core && CORE,
          entry.world && 'bg-muted',
          selected && 'border-ring bg-muted',
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {dots.length > 0 && <span className="flex shrink-0 gap-[3px]">{dots}</span>}
          {worldBadge}
          <span className="min-w-0 truncate font-medium">{event.title}</span>
        </span>
        {event.description && <span className="truncate text-xs text-muted-foreground">{event.description}</span>}
      </Button>
    )
  }

  const tile = (
    <Button
      variant="outline"
      aria-pressed={selected}
      onClick={() => { setHover(false); onSelect(event.key) }}
      className={cn(
        'relative h-8 w-full min-w-0 justify-start gap-2 px-2.5 font-normal',
        event.is_core && CORE,
        entry.world && 'border-dashed bg-muted',
        selected && 'border-ring bg-muted ring-2 ring-ring/40 dark:border-ring',
      )}
    >
      {worldBadge}
      <span ref={titleEl} className="max-w-[45%] shrink-0 truncate font-medium">{event.title}</span>
      {event.description && <span ref={textEl} className="min-w-0 flex-1 truncate text-left text-muted-foreground">{event.description}</span>}
    </Button>
  )
  return (
    <HoverCard open={hover} onOpenChange={onHover} openDelay={400} closeDelay={80}>
      <HoverCardTrigger asChild>{tile}</HoverCardTrigger>
      <HoverCardContent side="bottom" align="start" className="w-[min(32rem,90vw)] text-sm leading-relaxed whitespace-pre-line">
        {clipped.title && <p className="font-medium">{event.title}</p>}
        {clipped.text && <p className={cn(clipped.title && 'mt-1 text-muted-foreground')}>{event.description}</p>}
      </HoverCardContent>
    </HoverCard>
  )
}
