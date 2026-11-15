import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Share2Icon } from 'lucide-react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import type { Simulation } from 'd3-force'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useT } from '../i18n'
import { applyForces, createSimulation, defaultForces, edgeEnds, edgeLabelEvent, edgeLabelText, extent, labelMode, neighbourhood, seedNodes, type Forces, type Graph, type GraphEdge, type SimNode } from '../relations/graph'
import { wordColors } from '../data/relations'
import { drawnAt, edgeAt, factionsHeld, type StoryCursor } from '../cursor/state'
import { clamp, DRAG_START, usePanZoom, type Zoom } from '@/hooks/use-pan-zoom'
import { personColor, type LaneIndex } from './people'

/** How warm the simulation runs while a node drags, as in d3's own examples. */
const DRAG_HEAT = 0.3
/** Air around the drawing when it is fitted into the view. The names hang under the circles. */
const FIT_PAD = 28

/**
 * A node-link diagram of the characters: a circle and a name per character, a line per pair with
 * the relation written on it. The force simulation runs live, as in d3's force-directed graph: a
 * new graph unfolds and fits itself into view, a dragged node holds under the pointer while the
 * rest follows, and a dropped node is free again. The background pans; the wheel and a pinch zoom.
 * With `highlight`, the members of that faction and the edges among them stand out; the rest fades.
 * With `cursor`, the picture is the story as of that event: relations not started yet and people
 * not introduced yet are hidden or faint, ended relations are ghosted, the dead and the gone are
 * marked, and a node's ring and faction follow the memberships that hold then. The layout stays
 * where it is; only the styles change.
 * Hovering, focusing or selecting a person lights them, their neighbours and their relations, and
 * fades the rest; on a large graph the relation names show only there (see `labelMode`). With
 * `search`, the people it names are ringed and the rest fade; `find` centres the view on a person,
 * and clearing the search puts back the view from before the first find.
 *
 * Positions change on every tick, so the SVG elements take them straight from the simulation
 * instead of through React; React only draws the structure.
 */
export function RelationGraph({ graph, laneIndex, selectedId, onSelect, onSelectEvent, zoom, showLabels, highlight, forces = defaultForces, cursor, search, find }: {
  graph: Graph
  laneIndex: LaneIndex
  selectedId?: string
  onSelect: (id: string) => void
  /** Opens an event named in a relation's history. */
  onSelectEvent?: (id: string) => void
  zoom: Zoom
  showLabels: boolean
  /** The id of a faction to highlight. */
  highlight?: string
  /** How hard the layout forces act. A change takes hold in the running simulation. */
  forces?: Forces
  /** The story as of one event. */
  cursor?: StoryCursor
  /** The people a search names; none while there is no query. */
  search?: Set<string>
  /** A request to centre the view on a person; a new `n` repeats it. It selects nothing. */
  find?: { id: string; n: number }
}) {
  const t = useT()
  const forcesRef = useRef(forces)
  forcesRef.current = forces
  const sim = useRef<Simulation<SimNode, undefined> | null>(null)
  const nodeEls = useRef(new Map<string, SVGGElement>())
  const edgeEls = useRef(new Map<number, { line: SVGLineElement | null; label: SVGTextElement | null }>())
  // While the layout unfolds, the view follows it; the first touch of the user ends that.
  const autoFit = useRef(true)
  // The user has panned or zoomed (or a selection moved the view) since the last fit. Until then,
  // a resized box fits the drawing again, also once the layout has settled.
  const moved = useRef(false)
  // The view before the first find of a search, put back when the search is cleared; any other move forgets it.
  const beforeFind = useRef<{ k: number; x: number; y: number } | null>(null)
  const userMoved = () => { autoFit.current = false; moved.current = true; beforeFind.current = null }
  const anchor = useRef<HTMLDivElement>(null)
  const [openEdge, setOpenEdge] = useState<number | null>(null)
  const openEdgeRef = useRef(openEdge)
  openEdgeRef.current = openEdge
  // A tap on the background, with no pan, closes an open relation history.
  // The box only exists while there is something to draw, so the wheel stop follows that: a graph
  // that mounts empty and fills later still keeps the page from scrolling.
  const drawn = graph.nodes.length > 0 && graph.edges.length > 0
  const { box, world, view, size, applyView, zoomCentered, handlers } = usePanZoom({ setScale: zoom.setScale, onUserMove: userMoved, onTap: () => setOpenEdge(null), wheelKey: drawn })

  const fit = useCallback(() => {
    const nodes = sim.current?.nodes() ?? []
    const { w, h } = size.current
    if (!nodes.length || !w || !h) return
    const b = extent(nodes, FIT_PAD)
    const bw = b.maxX - b.minX
    const bh = b.maxY - b.minY
    const k = clamp(Math.min(w / bw, h / bh, 1))
    view.current = { k, x: w / 2 - k * (b.minX + bw / 2), y: h / 2 - k * (b.minY + bh / 2) }
    applyView()
  }, [applyView])

  // Moves every element to where its node is now.
  const draw = useCallback(() => {
    const s = sim.current
    if (!s) return
    const byId = new Map<string, SimNode>()
    for (const n of s.nodes()) {
      byId.set(n.id, n)
      nodeEls.current.get(n.id)?.setAttribute('transform', `translate(${n.x} ${n.y})`)
    }
    graph.edges.forEach((e, i) => {
      const a = byId.get(e.from)
      const b = byId.get(e.to)
      const els = edgeEls.current.get(i)
      if (!a || !b || !els) return
      const p = edgeEnds(a, b, !e.mutual)
      els.line?.setAttribute('x1', String(p.x1))
      els.line?.setAttribute('y1', String(p.y1))
      els.line?.setAttribute('x2', String(p.x2))
      els.line?.setAttribute('y2', String(p.y2))
      els.label?.setAttribute('transform', `translate(${(a.x + b.x) / 2} ${(a.y + b.y) / 2})`)
      if (openEdgeRef.current === i && anchor.current) {
        const { k, x, y } = view.current
        anchor.current.style.left = `${((a.x + b.x) / 2) * k + x}px`
        anchor.current.style.top = `${((a.y + b.y) / 2) * k + y}px`
      }
    })
  }, [graph])

  // Starts a simulation of the graph from the given places and lets it unfold into view.
  const start = useCallback((previous: Iterable<{ id: string; x: number; y: number }>) => {
    sim.current?.stop()
    const s = createSimulation(seedNodes(graph, previous), graph.edges, forcesRef.current)
    s.on('tick', () => {
      draw()
      if (autoFit.current) {
        fit()
        if (s.alpha() < 0.05) autoFit.current = false
      }
    })
    sim.current = s
    autoFit.current = true
    moved.current = false
    draw()
    fit()
    s.alpha(1).restart()
  }, [graph, draw, fit])

  // A new graph gets a new simulation. Nodes that stay keep their place; the rest join them.
  useEffect(() => {
    start(sim.current?.nodes() ?? [])
    return () => { sim.current?.stop() }
  }, [start])
  useEffect(() => () => { sim.current = null }, [])

  // New strengths take hold at once; the layout warms up a little to settle into them, and the view follows.
  useEffect(() => {
    const s = sim.current
    if (!s) return
    applyForces(s, forces)
    autoFit.current = true
    s.alpha(Math.max(s.alpha(), 0.3)).restart()
  }, [forces])

  // Follow the size of the box, so `fit` has a size to fit into.
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => {
      size.current = { w: el.clientWidth, h: el.clientHeight }
      if (autoFit.current || !moved.current) fit()
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fit])

  // Hands the toolbar its actions.
  useEffect(() => {
    zoom.view.current = {
      fit: () => { autoFit.current = false; moved.current = false; fit() },
      zoomBy: zoomCentered,
      reset: () => start([]),
    }
    return () => { zoom.view.current = null }
  }, [zoom.view, start, fit, zoomCentered])

  // Keep the selected node in view when the selection comes from a list.
  useEffect(() => {
    if (!selectedId || !sim.current) return
    const n = sim.current.nodes().find(m => m.id === selectedId)
    const { w, h } = size.current
    if (!n || !w || !h) return
    const { k, x, y } = view.current
    const sx = n.x * k + x
    const sy = n.y * k + y
    if (sx > 0 && sx < w && sy > 0 && sy < h) return
    userMoved()
    view.current = { k, x: w / 2 - n.x * k, y: h / 2 - n.y * k }
    applyView()
  }, [selectedId, applyView])

  // A find centres the view on the person at the present scale. It counts as the user's move, so
  // the auto-fit leaves the view alone; the view from before is kept for when the search clears.
  useEffect(() => {
    if (!find || !sim.current) return
    const n = sim.current.nodes().find(m => m.id === find.id)
    const { w, h } = size.current
    if (!n || !w || !h) return
    const before = beforeFind.current ?? { ...view.current }
    userMoved()
    beforeFind.current = before
    const { k } = view.current
    view.current = { k, x: w / 2 - n.x * k, y: h / 2 - n.y * k }
    applyView()
  }, [find, applyView])
  const searching = search !== undefined
  useEffect(() => {
    if (searching || !beforeFind.current) return
    view.current = beforeFind.current
    beforeFind.current = null
    applyView()
  }, [searching, applyView])

  // The person in focus: the hovered or keyboard-focused one, else the selected one.
  const [hover, setHover] = useState<string>()

  // A press on a node may become a drag; the background pans and zooms through `usePanZoom`.
  const press = useRef<{ id: string; sx: number; sy: number; x: number; y: number; dragged: boolean } | null>(null)
  const nodeOf = (id: string) => sim.current?.nodes().find(n => n.id === id)

  const onNodeDown = (id: string) => (e: React.PointerEvent<SVGGElement>) => {
    const n = nodeOf(id)
    if (!n || e.button !== 0) return
    e.stopPropagation()
    press.current = { id, sx: e.clientX, sy: e.clientY, x: n.x, y: n.y, dragged: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onNodeMove = (e: React.PointerEvent<SVGGElement>) => {
    const p = press.current
    const s = sim.current
    if (!p || !s) return
    const dx = e.clientX - p.sx
    const dy = e.clientY - p.sy
    if (!p.dragged && Math.hypot(dx, dy) < DRAG_START) return
    const n = nodeOf(p.id)
    if (!n) return
    if (!p.dragged) {
      p.dragged = true
      userMoved()
      s.alphaTarget(DRAG_HEAT).restart()
    }
    n.fx = p.x + dx / view.current.k
    n.fy = p.y + dy / view.current.k
  }
  const onNodeUp = (e: React.PointerEvent<SVGGElement>) => {
    const p = press.current
    if (!p) return
    e.stopPropagation()
    if (p.dragged) {
      // The node is free again; the simulation cools down with it in place.
      const n = nodeOf(p.id)
      if (n) { n.fx = null; n.fy = null }
      sim.current?.alphaTarget(0)
    } else {
      press.current = null
      onSelect(p.id)
      return
    }
    press.current = null
  }
  const onNodeCancel = () => {
    const p = press.current
    if (p?.dragged) {
      const n = nodeOf(p.id)
      if (n) { n.fx = null; n.fy = null }
      sim.current?.alphaTarget(0)
    }
    press.current = null
  }

  // The factions each node belongs to as the picture stands; its ring wears the first.
  const held = useMemo(() => new Map(graph.nodes.map(n => [n.id, factionsHeld(n.factions, cursor)])), [graph, cursor])
  const names = useMemo(() => new Map(graph.nodes.map(n => [n.id, n.name])), [graph])
  const colors = useMemo(() => new Map(graph.factions.map(f => [f.id, f.color])), [graph])
  const edgesAt = useMemo(() => (cursor ? graph.edges.map(e => edgeAt(e, cursor.order, cursor.at)) : undefined), [graph, cursor])
  const statusOf = (id: string) => cursor?.status.get(id)?.kind
  // At the cursor, an edge shows when its relation has started and both ends are in the story.
  const drawnEdges = useMemo(() => drawnAt(graph, cursor), [graph, cursor])
  const edgeHidden = (i: number) => !drawnEdges.edges[i]
  const ended = (i: number) => (edgesAt ? edgesAt[i].phase === 'ended' : graph.edges[i].ended)
  const lit = (id: string) => !highlight || (held.get(id)?.includes(highlight) ?? false)
  const focus = hover ?? selectedId
  const near = useMemo(() => (focus ? neighbourhood(graph.edges.filter((_, i) => drawnEdges.edges[i]), focus) : undefined), [graph, drawnEdges, focus])
  const touchesFocus = (e: GraphEdge) => e.from === focus || e.to === focus
  const nameMode = labelMode(showLabels, drawnEdges.edgeCount)
  const labelShown = (e: GraphEdge) => nameMode === 'all' || (nameMode === 'focus' && Boolean(focus) && touchesFocus(e))
  // An edge among highlighted members keeps its weight; one that touches one fades a little, the rest fade a lot.
  // A search fades the edges that touch no match; a person in focus fades the edges that are not theirs.
  const edgeFade = (e: GraphEdge) => {
    if (search && !search.has(e.from) && !search.has(e.to)) return 'opacity-10'
    if (focus && !touchesFocus(e)) return 'opacity-15'
    return !highlight ? '' : lit(e.from) && lit(e.to) ? '' : lit(e.from) || lit(e.to) ? 'opacity-45' : 'opacity-15'
  }
  const nodeFade = (id: string) => (search && !search.has(id) ? 'opacity-25' : near && !near.has(id) ? 'opacity-30' : !lit(id) && 'opacity-30')
  const setNodeEl = (id: string) => (el: SVGGElement | null) => { if (el) nodeEls.current.set(id, el); else nodeEls.current.delete(id) }
  const setEdgeEl = (i: number, part: 'line' | 'label') => (el: SVGLineElement & SVGTextElement | null) => {
    const els = edgeEls.current.get(i) ?? { line: null, label: null }
    els[part] = el
    edgeEls.current.set(i, els)
  }
  // Elements the simulation placed before React drew them get their place right after the draw.
  useLayoutEffect(() => { draw() })

  if (!drawn) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon"><Share2Icon /></EmptyMedia>
          <EmptyTitle>{t.noRelations}</EmptyTitle>
          <EmptyDescription>{t.noRelationsHint}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const open = openEdge != null ? graph.edges[openEdge] : undefined
  const hasHistory = (e: GraphEdge) => e.spans.length >= 2 || e.ended || Boolean(edgeLabelEvent(e))
  const keyActivates = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() }
  }

  return (
    <div ref={box} className="relative h-full w-full overflow-hidden select-none">
      <svg className="h-full w-full touch-none" {...handlers}>
        <defs>
          <marker id="rel-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0 0 L8 4 L0 8 Z" className="fill-ring" />
          </marker>
        </defs>
        <g ref={world}>
          {graph.edges.map((e, i) => (
            <line
              key={`l${i}`}
              ref={setEdgeEl(i, 'line')}
              className={cn('stroke-ring', ended(i) && 'opacity-40', edgeFade(e), edgeHidden(i) && 'hidden')}
              strokeWidth={focus && touchesFocus(e) ? 2 : 1.5}
              strokeLinecap="round"
              strokeDasharray={ended(i) ? '2 5' : (edgesAt?.[i].tone ?? e.tone) === 'hostile' ? '5 5' : undefined}
              markerEnd={e.mutual ? undefined : 'url(#rel-arrow)'}
            />
          ))}
          {nameMode !== 'none' && graph.edges.map((e, i) => {
            if (!labelShown(e)) return null
            const history = hasHistory(e)
            return (
              <text
                key={`t${i}`}
                ref={setEdgeEl(i, 'label')}
                textAnchor="middle"
                dominantBaseline="central"
                role={history ? 'button' : undefined}
                tabIndex={history ? 0 : undefined}
                aria-label={history ? `${t.relHistory}: ${names.get(e.from)} – ${names.get(e.to)}` : undefined}
                onPointerDown={history ? ev => ev.stopPropagation() : undefined}
                onClick={history ? () => setOpenEdge(i) : undefined}
                onKeyDown={history ? keyActivates(() => setOpenEdge(i)) : undefined}
                className={cn(
                  'text-[11px] [paint-order:stroke] [stroke:var(--card)] [stroke-width:4px] [stroke-linejoin:round]',
                  history ? 'cursor-pointer fill-foreground outline-none hover:fill-primary focus-visible:fill-primary' : 'pointer-events-none fill-muted-foreground',
                  // An ended relation's name is faded, as its dotted line is, rather than struck through.
                  ended(i) && 'opacity-60',
                  edgeFade(e),
                  edgeHidden(i) && 'hidden',
                )}
              >
                {edgeLabelText(edgesAt?.[i] ?? e)}
              </text>
            )
          })}
          {graph.nodes.map(n => {
            const ring = held.get(n.id)?.[0]
            const faction = ring ? colors.get(ring) : undefined
            const status = statusOf(n.id)
            const gone = status === 'dead' || status === 'left'
            return (
              <g
                key={n.id}
                ref={setNodeEl(n.id)}
                data-node={n.id}
                role="button"
                tabIndex={0}
                aria-pressed={n.id === selectedId}
                aria-label={status && status !== 'present' ? `${n.name} · ${t.status[status]}` : n.name}
                onPointerDown={onNodeDown(n.id)}
                onPointerMove={onNodeMove}
                onPointerUp={onNodeUp}
                onPointerCancel={onNodeCancel}
                onPointerEnter={() => setHover(n.id)}
                onPointerLeave={() => setHover(h => (h === n.id ? undefined : h))}
                onFocus={() => setHover(n.id)}
                onBlur={() => setHover(h => (h === n.id ? undefined : h))}
                onKeyDown={keyActivates(() => onSelect(n.id))}
                style={{ ...personColor(laneIndex, n.id), '--f': faction ?? 'transparent' } as CSSProperties}
                className={cn('cursor-grab outline-none transition-opacity active:cursor-grabbing', nodeFade(n.id), status === 'unseen' && 'opacity-15')}
              >
                {n.id === selectedId && <circle r={n.r + 7} className="fill-(--c)/15 stroke-(--c)/50" strokeWidth={2} />}
                {search?.has(n.id) && <circle r={n.r + 6} fill="none" className="stroke-primary" strokeWidth={2} />}
                {faction && <circle r={n.r + 3} fill="none" className="stroke-(--f)" strokeWidth={2} />}
                <NodeDot r={n.r} main={n.main} status={status} />
                <text y={n.r + 13} textAnchor="middle" className={cn('text-xs [paint-order:stroke] [stroke:var(--card)] [stroke-width:3px] [stroke-linejoin:round]', gone ? 'fill-muted-foreground' : 'fill-foreground', n.main && 'font-medium')}>{status === 'dead' ? `${n.name} †` : n.name}</text>
                <circle r={n.r + 8} fill="transparent" />
              </g>
            )
          })}
        </g>
      </svg>
      <PopoverPrimitive.Root open={open != null} onOpenChange={o => { if (!o) setOpenEdge(null) }}>
        <PopoverPrimitive.Anchor asChild><div ref={anchor} className="pointer-events-none absolute size-0" /></PopoverPrimitive.Anchor>
        {open && <EdgeHistory edge={open} names={names} onSelectEvent={onSelectEvent} />}
      </PopoverPrimitive.Root>
    </div>
  )
}

/**
 * A character's circle in the colour `--c`. At a cursor, the dead are a pale disc struck through,
 * and those who left an empty dashed ring.
 */
export function NodeDot({ r, main, status, cx, cy }: { r: number; main: boolean; status?: string; cx?: number; cy?: number }) {
  const width = main ? 'stroke-2' : 'stroke-[1.5]'
  if (status === 'left') return <circle cx={cx} cy={cy} r={r - 1} strokeDasharray="3 2" className={cn('fill-card stroke-(--c)', width)} />
  if (status !== 'dead') return <circle cx={cx} cy={cy} r={r} className={cn('fill-(--c) stroke-card', width)} />
  const d = r * 0.7
  const x = cx ?? 0
  const y = cy ?? 0
  return (
    <>
      <circle cx={cx} cy={cy} r={r - 1} className={cn('fill-(--c)/25 stroke-(--c)/70', width)} />
      <path d={`M${x - d} ${y - d}L${x + d} ${y + d}`} className="stroke-foreground/70" strokeWidth={1.5} strokeLinecap="round" />
    </>
  )
}

/** The history of a pair: every relation row, oldest first, with the events it ran between. */
const EdgeHistory = memo(function EdgeHistory({ edge: e, names, onSelectEvent }: { edge: GraphEdge; names: Map<string, string>; onSelectEvent?: (id: string) => void }) {
  const t = useT()
  const event = edgeLabelEvent(e)
  const when = (sp: GraphEdge['spans'][number]) => `${sp.since?.title ?? t.fromStart} → ${sp.until?.title ?? t.ongoing}`
  return (
    <PopoverContent className="w-auto max-w-72 p-3" updatePositionStrategy="always" onOpenAutoFocus={ev => ev.preventDefault()}>
      <p className="mb-2 text-xs font-semibold text-muted-foreground">{names.get(e.from)} {e.mutual ? '↔' : '→'} {names.get(e.to)}</p>
      {event && <p className="mb-2 text-[11px] text-muted-foreground/80">{e.ended ? t.until : t.since} {event.title}</p>}
      <ol className="flex flex-col gap-2">
        {e.spans.map((sp, i) => (
          <li key={i} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className={cn('rounded-md border px-1.5 text-xs leading-5', wordColors[sp.tone])}>{sp.label}</span>
              {sp.from !== e.from && !sp.mutual && <span className="text-[11px] text-muted-foreground">{names.get(sp.from)} → {names.get(sp.to)}</span>}
            </div>
            <div className="flex flex-wrap items-baseline gap-x-1 text-[11px] text-muted-foreground">
              <EventWord ref_={sp.since} fallback={t.fromStart} onSelectEvent={onSelectEvent} />
              <span aria-hidden="true">→</span>
              <EventWord ref_={sp.until} fallback={t.ongoing} onSelectEvent={onSelectEvent} />
            </div>
            <span className="sr-only">{when(sp)}</span>
          </li>
        ))}
      </ol>
    </PopoverContent>
  )
})

/** An event title in the history, as a link when the event exists in the project. */
function EventWord({ ref_, fallback, onSelectEvent }: { ref_?: GraphEdge['spans'][number]['since']; fallback: string; onSelectEvent?: (id: string) => void }) {
  if (!ref_) return <span>{fallback}</span>
  if (!ref_.known || !onSelectEvent) return <span>{ref_.title}</span>
  return <button type="button" className="underline-offset-2 hover:text-foreground hover:underline" onClick={() => onSelectEvent(ref_.key)}>{ref_.title}</button>
}

/** The legend under a graph. `compact` drops the long labels for the phone. */
export function GraphLegend({ compact = false, cursor = false, trailing }: { compact?: boolean; cursor?: boolean; trailing?: React.ReactNode }) {
  const t = useT()
  const item = 'inline-flex items-center gap-1.5 whitespace-nowrap'
  const line = (dash?: string, arrow = false) => (
    <svg aria-hidden="true" width="26" height="8" viewBox="0 0 26 8" className="shrink-0">
      <path d={arrow ? 'M1 4h20' : 'M1 4h24'} className="stroke-ring" strokeWidth="2" fill="none" strokeDasharray={dash} />
      {arrow && <path d="M20 1l5 3-5 3z" className="fill-ring" />}
    </svg>
  )
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground', compact && 'gap-x-3 text-[11px]')}>
      <span className={item}><i className="size-2.5 rounded-full bg-(--person-0)" />{compact ? t.mainPeople : t.legMain}</span>
      <span className={item}><i className="size-2.5 rounded-full bg-muted-foreground" />{t.legOther}</span>
      <span className={item}>{line(undefined, true)}{t.legOneWay}</span>
      <span className={item}>{line()}{t.legMutual}</span>
      <span className={item}>{line('5 4')}{t.legHostile}</span>
      <span className={item}>{line('2 5')}{t.legEnded}</span>
      {!compact && <span className={item}><i className="text-[11px] text-foreground">A → B</i>{t.legChanged}</span>}
      {!compact && <span className={item}><i className="size-3 rounded-full border-2 border-(--person-4) bg-muted-foreground/60" />{t.legFaction}</span>}
      {cursor && (['dead', 'left', 'unseen'] as const).map(status => (
        <span key={status} className={item} style={{ '--c': 'var(--muted-foreground)' } as CSSProperties}>
          <svg aria-hidden="true" width="12" height="12" viewBox="-6 -6 12 12" className={cn('shrink-0', status === 'unseen' && 'opacity-30')}><NodeDot r={5} main={false} status={status} /></svg>
          {t.status[status]}
        </span>
      ))}
      {trailing}
    </div>
  )
}
