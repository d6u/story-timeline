import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '@/lib/utils'

/**
 * The 12px gap between two islands, draggable. `onChange` gets the new width of the panel on
 * `side`: dragging right grows a left panel and shrinks a right one. Arrow keys move 16px.
 */
export function ResizeHandle({ label, side, value, min, max, onChange, className }: {
  label: string
  side: 'left' | 'right'
  value: number
  min: number
  max: number
  onChange: (width: number) => void
  className?: string
}) {
  const start = useRef<{ x: number; width: number }>(null)
  const clamp = (width: number) => Math.min(max, Math.max(min, Math.round(width)))
  const direction = side === 'left' ? 1 : -1

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    start.current = { x: e.clientX, width: value }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return
    onChange(clamp(start.current.width + (e.clientX - start.current.x) * direction))
  }
  const onPointerUp = () => { start.current = null }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' ? 16 : e.key === 'ArrowLeft' ? -16 : 0
    if (step) {
      e.preventDefault()
      onChange(clamp(value + step * direction))
    } else if (e.key === 'Home') onChange(min)
    else if (e.key === 'End') onChange(max)
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      className={cn('group flex w-3 shrink-0 cursor-col-resize touch-none items-center justify-center self-stretch outline-none select-none', className)}
    >
      <span className="h-9 w-1 rounded-sm bg-ring opacity-35 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-focus-visible:ring-3 group-focus-visible:ring-ring/35" />
    </div>
  )
}
