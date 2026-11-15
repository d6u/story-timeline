import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { GitForkIcon } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { cn } from '@/lib/utils'
import { useT } from '../i18n'
import { CAUSAL_HEADER, causalStart, DIRECTED, downstream, edgePath, NODE_H, NODE_W, upstream, type Causality, type CausalEdge, type LinkKind } from '../causality/build'
import { isAfter, type StoryCursor } from '../cursor/state'
import { usePanZoom, type Zoom } from '@/hooks/use-pan-zoom'

/** The colour of each link kind, from the theme palette so it reads in light and dark. */
export const KIND_COLOR: Record<LinkKind, string> = {
  cause: 'var(--person-0)',
  setup: 'var(--person-3)',
  reveal: 'var(--person-2)',
  echo: 'var(--person-4)',
  other: 'var(--ring)',
}
/** The dash of the kinds that point nowhere. */
const KIND_DASH: Partial<Record<LinkKind, string>> = { echo: '5 4', other: '2 4' }
/** The colours that mark the causes and the effects of the selected event. */
const CAUSES = 'var(--person-5)'
const EFFECTS = 'var(--story)'
/** Room above the nodes for the act names. */
const HEADER = CAUSAL_HEADER

/**
 * The events as cards in act columns, in story order from left to right, and every link between
 * them as a curve in the colour of its kind, with an arrow when it points one way. Hovering a
 * link shows its note. With an event selected, its causes, its effects and the links between
 * them stand out, and the rest fades. With `cursor`, the events after it and the links that
 * reach them fade, and the cursor event is outlined. The background pans; the wheel and a pinch zoom.
 * With `trail` (a chain from the insights, starting at the selection), only that chain and the
 * links along it stand out. Hovering or focusing an event shows its whole title.
 */
export function CausalGraph({ causal, selectedId, onSelect, zoom, cursor, trail }: {
  causal: Causality
  selectedId?: string
  onSelect: (id: string) => void
  zoom: Zoom
  /** The story as of one event. */
  cursor?: StoryCursor
  /** Event keys of a chain to light, first to last. */
  trail?: string[]
}) {
  const t = useT()
  const [hover, setHover] = useState<{ edge: CausalEdge; x: number; y: number }>()
  // The event whose whole title shows, on hover or keyboard focus.
  const [tip, setTip] = useState<string>()
  const byId = useMemo(() => new Map(causal.nodes.map(n => [n.id, n])), [causal])
  // A press on the background hides the link note and the title. The box only exists with nodes, so the wheel stop follows their count.
  const { box, world, view, size, applyView, local, zoomCentered, handlers } = usePanZoom({ setScale: zoom.setScale, onPress: () => { setHover(undefined); setTip(undefined) }, onUserMove: () => setTip(undefined), wheelKey: causal.nodes.length })
  // The event the start view centres on when the whole height would be too small to read: the selection, else the cursor event.
  const focusRef = useRef<{ x: number; y: number } | undefined>(undefined)
  focusRef.current = (selectedId ? byId.get(selectedId) : undefined) ?? causal.nodes.find(n => n.key === cursor?.event.key)

  /**
   * The start view (see `causalStart`): the height of the box at a readable scale, so the names
   * stay readable and the story pans sideways. With `whole`, everything fits.
   */
  const fit = useCallback((whole = false) => {
    const { w, h } = size.current
    if (!causal.nodes.length || !w || !h) return
    view.current = causalStart({ w, h }, causal, whole, whole ? undefined : focusRef.current)
    applyView()
  }, [causal, applyView])

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => {
      const first = !size.current.w
      size.current = { w: el.clientWidth, h: el.clientHeight }
      if (first) fit()
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fit])
  // A new layout starts fitted.
  useLayoutEffect(() => { fit() }, [fit])

  useEffect(() => {
    zoom.view.current = {
      fit: () => fit(true),
      zoomBy: zoomCentered,
      reset: () => fit(),
    }
    return () => { zoom.view.current = null }
  }, [zoom.view, fit, zoomCentered])

  // Keep the selected event in view when the selection comes from a list.
  useEffect(() => {
    const n = selectedId ? byId.get(selectedId) : undefined
    const { w, h } = size.current
    if (!n || !w || !h) return
    const { k, x, y } = view.current
    const sx = n.x * k + x
    const sy = n.y * k + y
    if (sx > 0 && sx < w && sy > 0 && sy < h) return
    view.current = { k, x: w / 2 - n.x * k, y: h / 2 - n.y * k }
    applyView()
  }, [selectedId, byId, applyView])

  // The chain of the selected event: what leads to it, and what follows from it. With a trail
  // through the selection, the trail before it and after it instead.
  const path = useMemo(() => {
    if (!trail || !selectedId) return undefined
    const at = trail.indexOf(selectedId)
    if (at < 0 || trail.some(id => !byId.has(id))) return undefined
    const steps = new Set(trail.slice(1).map((id, i) => `${trail[i]}>${id}`))
    return { before: new Set(trail.slice(0, at)), after: new Set(trail.slice(at + 1)), steps }
  }, [trail, selectedId, byId])
  const chain = useMemo(() => {
    if (!selectedId || !byId.has(selectedId)) return undefined
    if (path) return { causes: path.before, effects: path.after }
    return { causes: upstream(causal, selectedId), effects: downstream(causal, selectedId) }
  }, [causal, selectedId, byId, path])

  if (!causal.nodes.length) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon"><GitForkIcon /></EmptyMedia>
          <EmptyTitle>{t.noLinks}</EmptyTitle>
          <EmptyDescription>{t.noLinksHint}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const inCauses = (id: string) => id === selectedId || Boolean(chain?.causes.has(id))
  const inEffects = (id: string) => id === selectedId || Boolean(chain?.effects.has(id))
  /** Which side of the chain an edge is on: causes, effects, a direct echo of the selection, or none. */
  const sideOf = (e: CausalEdge): 'causes' | 'effects' | 'echo' | undefined => {
    if (!chain) return undefined
    // Along a trail, only the links between its steps.
    if (path) {
      if (!path.steps.has(`${e.from}>${e.to}`) && !path.steps.has(`${e.to}>${e.from}`)) return undefined
      return path.after.has(e.to) || path.after.has(e.from) ? 'effects' : 'causes'
    }
    if (DIRECTED.has(e.kind)) {
      if (chain.causes.has(e.from) && inCauses(e.to)) return 'causes'
      if (inEffects(e.from) && chain.effects.has(e.to)) return 'effects'
      return undefined
    }
    return e.from === selectedId || e.to === selectedId ? 'echo' : undefined
  }
  const echoed = new Set(chain && !path ? causal.edges.filter(e => sideOf(e) === 'echo').flatMap(e => [e.from, e.to]) : [])
  // Lit edges draw last, on top.
  const edges = causal.edges.map(e => ({ e, side: sideOf(e) })).sort((a, b) => Number(Boolean(a.side)) - Number(Boolean(b.side)))
  const nameOf = (id: string) => byId.get(id)?.title ?? id
  const tipNode = tip ? byId.get(tip) : undefined
  const later = (id: string) => Boolean(cursor && isAfter(cursor.order, cursor.at, byId.get(id)?.key ?? ''))
  const keyActivates = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() }
  }

  return (
    <div ref={box} className="relative h-full w-full overflow-hidden select-none">
      <svg className="h-full w-full touch-none" {...handlers}>
        <defs>
          {(['cause', 'setup', 'reveal'] as const).map(kind => (
            <marker key={kind} id={`causal-arrow-${kind}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0 0 L8 4 L0 8 Z" fill={KIND_COLOR[kind]} />
            </marker>
          ))}
        </defs>
        <g ref={world}>
          {causal.acts.map((a, i) => (
            <g key={a.name}>
              <rect x={a.x0 - 14} y={-HEADER} width={a.x1 - a.x0 + 28} height={causal.height + HEADER + 14} rx={12} className={i % 2 ? 'fill-muted/40' : 'fill-muted/80'} />
              <text x={a.x0 - 2} y={-HEADER / 2} dominantBaseline="central" className="fill-muted-foreground font-heading text-[13px] font-bold tracking-wide">{a.name}</text>
            </g>
          ))}
          {edges.map(({ e, side }) => {
            const a = byId.get(e.from)!
            const b = byId.get(e.to)!
            const d = edgePath(a, b)
            const directed = DIRECTED.has(e.kind)
            const show = (ev: React.PointerEvent) => { const l = local(ev); setHover({ edge: e, x: l.x, y: l.y }) }
            return (
              <g key={`${e.from}-${e.to}-${e.kind}`} className={cn('transition-opacity', chain ? (side ? 'opacity-100' : 'opacity-10') : (later(e.from) || later(e.to)) && 'opacity-30')}>
                <path d={d} fill="none" stroke={KIND_COLOR[e.kind]} strokeWidth={side ? 2.25 : 1.5} strokeLinecap="round" strokeDasharray={KIND_DASH[e.kind]} markerEnd={directed ? `url(#causal-arrow-${e.kind})` : undefined} className={cn(!chain && 'opacity-75', hover?.edge === e && 'opacity-100')} />
                <path d={d} fill="none" stroke="transparent" strokeWidth={10} onPointerEnter={show} onPointerMove={show} onPointerLeave={() => setHover(h => (h?.edge === e ? undefined : h))} />
              </g>
            )
          })}
          {causal.nodes.map(n => {
            const selected = n.id === selectedId
            const cause = chain?.causes.has(n.id)
            const effect = chain?.effects.has(n.id)
            const lit = !chain || selected || cause || effect || echoed.has(n.id)
            const mark = cause ? CAUSES : effect ? EFFECTS : undefined
            return (
              <g
                key={n.id}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                aria-label={n.title}
                transform={`translate(${n.x - NODE_W / 2} ${n.y - NODE_H / 2})`}
                style={{ '--m': mark ?? 'var(--ring)' } as CSSProperties}
                className={cn('cursor-pointer outline-none transition-opacity', !lit ? 'opacity-25' : later(n.id) && 'opacity-40')}
                onPointerDown={e => e.stopPropagation()}
                onPointerEnter={() => setTip(n.id)}
                onPointerLeave={() => setTip(id => (id === n.id ? undefined : id))}
                onFocus={() => setTip(n.id)}
                onBlur={() => setTip(id => (id === n.id ? undefined : id))}
                onClick={() => onSelect(n.id)}
                onKeyDown={keyActivates(() => onSelect(n.id))}
              >
                {n.key === cursor?.event.key && <rect x={-4} y={-4} width={NODE_W + 8} height={NODE_H + 8} rx={10} fill="none" className="stroke-story" strokeWidth={2} />}
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={7}
                  className={cn(
                    selected ? 'fill-primary stroke-primary' : mark ? 'fill-(--m)/15 stroke-(--m)' : 'fill-card stroke-ring/60',
                    n.core && !selected && !mark && 'stroke-foreground/70',
                  )}
                  strokeWidth={selected || mark || n.core ? 1.75 : 1}
                />
                {n.core && <rect x={4} y={6} width={3} height={NODE_H - 12} rx={1.5} className={selected ? 'fill-primary-foreground' : 'fill-story'} />}
                <text
                  x={n.core ? 13 : 9}
                  y={NODE_H / 2}
                  dominantBaseline="central"
                  className={cn('text-xs', selected ? 'fill-primary-foreground font-semibold' : 'fill-foreground', n.core && 'font-semibold')}
                >
                  {n.short}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
      {tipNode && !hover && (() => {
        // The whole title under the card, kept inside the box.
        const { k, x, y } = view.current
        const left = (tipNode.x - NODE_W / 2) * k + x
        const top = (tipNode.y + NODE_H / 2) * k + y + 6
        return (
          <div
            role="tooltip"
            id="causal-tip"
            className="pointer-events-none absolute z-10 max-w-72 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
            style={{ left: Math.max(4, Math.min(left, size.current.w - 292)), top: Math.min(top, size.current.h - 44) }}
          >
            <p className="font-medium">{tipNode.title}</p>
            {tipNode.reach > 0 && <p className="mt-0.5 text-muted-foreground">{t.reach(tipNode.reach)}</p>}
          </div>
        )
      })()}
      {hover && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 max-w-64 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
          style={{ left: Math.max(0, Math.min(hover.x + 12, size.current.w - 260)), top: hover.y + 14 }}
        >
          <p className="flex items-center gap-1.5 font-medium">
            <i className="size-2 shrink-0 rounded-full" style={{ background: KIND_COLOR[hover.edge.kind] }} />
            {hover.edge.relation || t.linkKind[hover.edge.kind]}
          </p>
          <p className="mt-0.5 text-muted-foreground">{nameOf(hover.edge.from)} {DIRECTED.has(hover.edge.kind) ? '→' : '·'} {nameOf(hover.edge.to)}</p>
          {hover.edge.note && <p className="mt-1">{hover.edge.note}</p>}
        </div>
      )}
    </div>
  )
}

/** The legend under the causality graph. `compact` drops the chain marks for the phone. */
export function CausalLegend({ kinds, compact = false, trailing }: { kinds: LinkKind[]; compact?: boolean; trailing?: React.ReactNode }) {
  const t = useT()
  const item = 'inline-flex items-center gap-1.5 whitespace-nowrap'
  const line = (kind: LinkKind) => (
    <svg aria-hidden="true" width="26" height="8" viewBox="0 0 26 8" className="shrink-0">
      <path d={DIRECTED.has(kind) ? 'M1 4h20' : 'M1 4h24'} stroke={KIND_COLOR[kind]} strokeWidth="2" fill="none" strokeDasharray={KIND_DASH[kind]} />
      {DIRECTED.has(kind) && <path d="M20 1l5 3-5 3z" fill={KIND_COLOR[kind]} />}
    </svg>
  )
  const box = (color: string) => <i className="h-3 w-4 shrink-0 rounded-[3px] border-[1.5px]" style={{ borderColor: color, background: `color-mix(in oklab, ${color} 15%, transparent)` }} />
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground', compact && 'gap-x-3 text-[11px]')}>
      {kinds.map(kind => <span key={kind} className={item}>{line(kind)}{t.linkKind[kind]}</span>)}
      <span className={item}><i className="h-3 w-[3px] rounded-full bg-story" />{t.legCore}</span>
      {!compact && <span className={item}>{box(CAUSES)}{t.legCauses}</span>}
      {!compact && <span className={item}>{box(EFFECTS)}{t.legEffects}</span>}
      {trailing}
    </div>
  )
}
