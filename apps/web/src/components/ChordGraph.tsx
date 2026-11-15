import { useMemo, useState, type CSSProperties } from 'react'
import { CircleDashedIcon } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { cn } from '@/lib/utils'
import { useT } from '../i18n'
import { arcPath, buildChord, chordBands, chordMiddle, chordPath, polar, type Chord } from '../relations/chord'
import { edgeLabelText, type Graph, type GraphEdge } from '../relations/graph'
import { edgeAt, factionsHeld, phaseAt, type EdgeAt, type StoryCursor } from '../cursor/state'
import { NodeDot } from './RelationGraph'
import { personColor, type LaneIndex } from './people'

/** The ring the characters sit on, and the room around it for their names. */
const R = 260
const LABEL_ROOM = 115
/** The faction arcs sit just outside the seats; each further ring of bands is this much further out. */
const ARC_IN = R + 10
const ARC_W = 6
const RING_STEP = 9

/**
 * The characters on a ring, each faction's members side by side under a band in its colour, and
 * every relation as a curve through the inside. Hovering or selecting a character lights its
 * chords and writes the relation on each; the rest fades. With `highlight`, the members of that
 * faction and the chords among them stand out instead. With `cursor`, only the relations that
 * have started by then are drawn, ended ones ghosted; people not introduced yet are faint, and
 * the dead and the gone are marked. A membership shows its band only once it has started, ghosted
 * once it has ended. The seats stay where they are.
 */
export function ChordGraph({ graph, laneIndex, selectedId, onSelect, showLabels, highlight, cursor, search, className }: {
  graph: Graph
  laneIndex: LaneIndex
  selectedId?: string
  onSelect: (id: string) => void
  showLabels: boolean
  /** The id of a faction to highlight. */
  highlight?: string
  /** The story as of one event. */
  cursor?: StoryCursor
  /** The people a search names: they and their chords stand out, the rest fade. None while there is no query. */
  search?: Set<string>
  className?: string
}) {
  const t = useT()
  const [hover, setHover] = useState<string>()
  const layout = useMemo(() => buildChord(graph, R), [graph])
  // The names start past the outermost ring, and the drawing makes room for them.
  const labelR = ARC_IN + ARC_W + layout.rings * RING_STEP + 8
  const S = labelR + LABEL_ROOM
  const factionsOf = useMemo(() => new Map(graph.nodes.map(n => [n.id, new Set(factionsHeld(n.factions, cursor))])), [graph, cursor])
  // The faction arcs under the seats and the bands outside them; at the cursor, each seat's memberships as they stand then.
  const rings = useMemo(() => {
    if (!cursor) return { arcs: layout.arcs.map(a => ({ ...a, ended: false })), bands: layout.bands }
    const all = chordBands(layout.nodes, layout.slot, graph, f => phaseAt(f, cursor.order, cursor.at))
    return { arcs: all.filter(b => b.ring === 0), bands: all.filter(b => b.ring > 0) }
  }, [layout, graph, cursor])
  const edgesAt = useMemo(() => (cursor ? new Map<GraphEdge, EdgeAt>(graph.edges.map(e => [e, edgeAt(e, cursor.order, cursor.at)])) : undefined), [graph, cursor])
  // At the cursor, a chord shows when its relation has started and both ends are in the story.
  const statusOf = (id: string) => cursor?.status.get(id)?.kind
  const chords = useMemo(() => layout.chords.filter(c => !edgesAt || (edgesAt.get(c.edge)?.phase !== 'future' && cursor?.status.get(c.a.id)?.kind !== 'unseen' && cursor?.status.get(c.b.id)?.kind !== 'unseen')), [layout, edgesAt, cursor])
  const ended = (e: GraphEdge) => (edgesAt ? edgesAt.get(e)?.phase === 'ended' : e.ended)
  const labelOf = (e: GraphEdge) => edgeLabelText(edgesAt?.get(e) ?? e)

  if (!graph.nodes.length || !graph.edges.length) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon"><CircleDashedIcon /></EmptyMedia>
          <EmptyTitle>{t.noRelations}</EmptyTitle>
          <EmptyDescription>{t.noRelationsHint}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  // The character in focus: the hovered one, else the selected one.
  const focus = hover ?? selectedId
  const touches = (c: Chord, id: string) => c.a.id === id || c.b.id === id
  const neighbours = new Set<string>()
  if (focus) for (const c of chords) if (touches(c, focus)) neighbours.add(c.a.id === focus ? c.b.id : c.a.id)
  const inFaction = (id: string) => !highlight || (factionsOf.get(id)?.has(highlight) ?? false)
  // A node is lit when it is in focus or next to it; with no focus, when a search names it; else when its faction is highlighted.
  const nodeLit = (id: string) => (focus ? id === focus || neighbours.has(id) : search ? search.has(id) : inFaction(id))
  const chordLit = (c: Chord) => (focus ? touches(c, focus) : search ? search.has(c.a.id) || search.has(c.b.id) : inFaction(c.a.id) && inFaction(c.b.id))
  const anyFocus = Boolean(focus || search || highlight)
  const keyActivates = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() }
  }

  return (
    <div className={cn('flex h-full w-full items-center justify-center overflow-hidden p-2 select-none', className)}>
      <svg viewBox={`${-S} ${-S} ${2 * S} ${2 * S}`} className="max-h-full max-w-full" style={{ aspectRatio: '1' }} role="img" aria-label={t.chordView}>
        <defs>
          <marker id="chord-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0 0 L8 4 L0 8 Z" className="fill-ring" />
          </marker>
        </defs>
        {/* The faction arcs, just outside the seats, and the further memberships stacked outside them. */}
        {rings.arcs.map((a, i) => (
          <path key={i} d={arcPath(a.start, a.end, ARC_IN, ARC_IN + ARC_W)} fill={a.color} className={cn('transition-opacity', a.ended && 'opacity-35', highlight && highlight !== a.id && 'opacity-25')}>
            <title>{a.ended ? `${t.former} ${a.name}` : a.name}</title>
          </path>
        ))}
        {rings.bands.map((b, i) => {
          const inner = ARC_IN + b.ring * RING_STEP
          return (
            <path key={i} d={arcPath(b.start, b.end, inner, inner + ARC_W - 2)} fill={b.color} className={cn('transition-opacity', b.ended ? 'opacity-35' : 'opacity-85', highlight && highlight !== b.id && 'opacity-15')}>
              <title>{b.ended ? `${t.former} ${b.name}` : b.name}</title>
            </path>
          )
        })}
        {/* The chords, lit ones last so they draw on top. */}
        {[...chords].sort((p, q) => Number(chordLit(p)) - Number(chordLit(q))).map(c => {
          const e = c.edge
          const lit = chordLit(c)
          return (
            <path
              key={`${e.from}-${e.to}`}
              d={chordPath(c)}
              fill="none"
              className={cn('stroke-ring transition-opacity', anyFocus ? (lit ? 'opacity-90' : 'opacity-10') : 'opacity-45', ended(e) && 'opacity-30')}
              strokeWidth={lit ? 2 : 1.5}
              strokeLinecap="round"
              strokeDasharray={ended(e) ? '2 5' : (edgesAt?.get(e)?.tone ?? e.tone) === 'hostile' ? '5 5' : undefined}
              markerEnd={e.mutual ? undefined : 'url(#chord-arrow)'}
            >
              <title>{`${c.a.name} ${e.mutual ? '↔' : '→'} ${c.b.name}: ${labelOf(e)}`}</title>
            </path>
          )
        })}
        {/* The relation written on each lit chord. */}
        {showLabels && focus && chords.filter(chordLit).map(c => {
          const m = chordMiddle(c)
          return (
            <text key={`${c.edge.from}-${c.edge.to}`} x={m.x} y={m.y} textAnchor="middle" dominantBaseline="central" className="pointer-events-none fill-foreground text-[11px] [paint-order:stroke] [stroke:var(--card)] [stroke-width:4px] [stroke-linejoin:round]">
              {labelOf(c.edge)}
            </text>
          )
        })}
        {/* The seats and names. A name on the left half reads inward, so it is not upside down. */}
        {layout.nodes.map(n => {
          const deg = (n.angle * 180) / Math.PI
          const left = n.angle > Math.PI
          const label = polar(labelR, n.angle)
          const lit = nodeLit(n.id)
          const status = statusOf(n.id)
          const gone = status === 'dead' || status === 'left'
          return (
            <g
              key={n.id}
              role="button"
              tabIndex={0}
              aria-pressed={n.id === selectedId}
              aria-label={status && status !== 'present' ? `${n.name} · ${t.status[status]}` : n.name}
              style={personColor(laneIndex, n.id) as CSSProperties}
              className={cn('cursor-pointer outline-none transition-opacity', anyFocus && !lit && 'opacity-30', status === 'unseen' && 'opacity-20')}
              onPointerEnter={() => setHover(n.id)}
              onPointerLeave={() => setHover(h => (h === n.id ? undefined : h))}
              onFocus={() => setHover(n.id)}
              onBlur={() => setHover(h => (h === n.id ? undefined : h))}
              onClick={() => onSelect(n.id)}
              onKeyDown={keyActivates(() => onSelect(n.id))}
            >
              {n.id === selectedId && <circle cx={n.x} cy={n.y} r={n.main ? 11 : 9} className="fill-(--c)/15 stroke-(--c)/50" strokeWidth={2} />}
              {search?.has(n.id) && <circle cx={n.x} cy={n.y} r={n.main ? 10 : 8.5} fill="none" className="stroke-primary" strokeWidth={2} />}
              <NodeDot cx={n.x} cy={n.y} r={n.main ? 6 : 4.5} main={n.main} status={status} />
              <text
                transform={`translate(${label.x} ${label.y}) rotate(${left ? deg + 90 : deg - 90})`}
                textAnchor={left ? 'end' : 'start'}
                dominantBaseline="central"
                className={cn('text-xs', n.main ? 'fill-foreground font-medium' : 'fill-foreground/80', gone && 'fill-muted-foreground', (n.id === focus) && 'fill-primary font-semibold')}
              >
                {status === 'dead' ? `${n.name} †` : n.name}
              </text>
              {/* A wider target around the name, so the pointer finds it. */}
              <rect
                transform={`translate(${polar(labelR - 6, n.angle).x} ${polar(labelR - 6, n.angle).y}) rotate(${deg - 90})`}
                x={0} y={-9} width={LABEL_ROOM} height={18} fill="transparent"
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}
