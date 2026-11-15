import type { CSSProperties } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Character } from '../data/types'

/** Character id → CSS color of its lane. Characters without a lane are absent and render neutral. */
export type LaneIndex = Map<string, string>

/** The eight palette slots, light and dark. Keep in sync with --person-0..7 in index.css, which the page uses. */
export const PALETTE = [
  { light: 'oklch(0.52 0.13 250)', dark: 'oklch(0.74 0.11 250)' },
  { light: 'oklch(0.58 0.16 40)', dark: 'oklch(0.76 0.12 45)' },
  { light: 'oklch(0.55 0.11 165)', dark: 'oklch(0.77 0.11 165)' },
  { light: 'oklch(0.55 0.16 300)', dark: 'oklch(0.76 0.12 300)' },
  { light: 'oklch(0.62 0.13 80)', dark: 'oklch(0.82 0.12 85)' },
  { light: 'oklch(0.56 0.17 355)', dark: 'oklch(0.76 0.13 355)' },
  { light: 'oklch(0.55 0.12 130)', dark: 'oklch(0.8 0.13 130)' },
  { light: 'oklch(0.52 0.05 245)', dark: 'oklch(0.76 0.04 245)' },
]

/**
 * Gives every lane a color. A character with an explicit color keeps it. The others take palette
 * slots in lane order, skipping a slot whose exact value an explicit color already uses, and
 * cycling past the last slot.
 */
export function laneColors(lanes: Character[]): LaneIndex {
  const explicit = lanes.flatMap(c => c.metadata?.color ?? [])
  const free = PALETTE.map((_, i) => i).filter(i => !explicit.some(v => v.includes(PALETTE[i].light) || v.includes(PALETTE[i].dark)))
  const slots = free.length ? free : PALETTE.map((_, i) => i)
  let next = 0
  return new Map(lanes.map(c => [c.key, c.metadata?.color ?? `var(--person-${slots[next++ % slots.length]})`]))
}

/** A Han, kana or Hangul character: one is a whole word's worth of a short label. */
const WIDE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u

/**
 * The short label of each lane head: the first character of the name, unless another lane starts
 * with the same one. Then each of those lanes takes the first later character of its name that no
 * other lane uses as its label; a CJK character stands alone, any other joins the first letter
 * (Ay, As). A name with no such character keeps its first one. The rule only looks at the lanes
 * given, in their order, so the labels are the same on every render.
 * Example: 李明远 and 李国栋 → 明 and 国; 王芳 stays 王.
 */
export function laneInitials(lanes: { key: string; name: string }[]): Map<string, string> {
  const chars = new Map(lanes.map(c => [c.key, Array.from(c.name.trim())]))
  const first = (id: string) => chars.get(id)![0] ?? ''
  const starts = new Map<string, number>()
  for (const c of lanes) starts.set(first(c.key), (starts.get(first(c.key)) ?? 0) + 1)
  const out = new Map<string, string>()
  for (const c of lanes) if (starts.get(first(c.key)) === 1) out.set(c.key, first(c.key))
  const used = new Set(out.values())
  for (const c of lanes) {
    if (out.has(c.key)) continue
    const [head, ...rest] = chars.get(c.key)!
    const pick = rest.find(ch => ch.trim() && !used.has(ch) && !used.has(head + ch))
    const label = pick === undefined ? (head ?? '') : WIDE.test(pick) ? pick : head + pick
    used.add(label)
    out.set(c.key, label)
  }
  return out
}

/** Main characters get their lane color; everyone else is neutral. */
export function personColor(lanes: LaneIndex, id: string): CSSProperties {
  return { '--c': lanes.get(id) ?? 'var(--muted-foreground)' } as CSSProperties
}

export function PersonBadge({ character, lanes, onClick, className }: {
  character: Character
  lanes: LaneIndex
  onClick?: (id: string) => void
  className?: string
}) {
  const style = personColor(lanes, character.key)
  const classes = cn('border-(--c)/40 bg-(--c)/10 text-person', className)
  if (!onClick) return <Badge variant="outline" className={classes} style={style}>{character.name}</Badge>
  return (
    <Badge asChild variant="outline" className={cn(classes, 'cursor-pointer hover:bg-(--c)/20')} style={style}>
      <button type="button" onClick={() => onClick(character.key)}>{character.name}</button>
    </Badge>
  )
}
