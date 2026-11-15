import { briefFileName, storyBrief } from '../brief/build'
import type { Causality, LinkKind } from '../causality/build'
import type { StoryCursor } from '../cursor/state'
import type { Insight, InsightFilter } from '../insights/build'
import type { ProjectData, StoryEvent } from '../data/types'
import type { Dictionary } from '../i18n'
import type { Forces, Graph, GraphOptions } from '../relations/graph'
import { emptyFilter, type Filter, type Mode, type Section, type Timeline } from '../timeline/build'
import type { Selection } from './DetailPanel'
import type { LaneIndex } from './people'
import type { ProjectOption } from './ProjectPicker'

/** The timeline, the force-directed relation graph, the relations on a ring, the links between events, or the findings. */
export type View = 'timeline' | 'graph' | 'chord' | 'causal' | 'insights'

/**
 * The selection as the data knows it. A URL names an event or a character by its key, the app's
 * identity. An old link may name it by its import id instead; when no row has that key, a row with
 * that id is found and the selection becomes its key. A selection that names nothing, for example
 * after a refetch removed it, is none.
 */
export function resolveSelection(data: ProjectData, selection?: Selection): Selection | undefined {
  if (!selection) return undefined
  const key = keyFor(selection.kind === 'event' ? data.events : data.characters, selection.id)
  if (key === undefined) return undefined
  return key === selection.id ? selection : { kind: selection.kind, id: key }
}

/** The key a URL value names: a key stays, an id of an old link becomes its row's key, and anything else is none. */
function keyFor(rows: { key: string; id?: string }[], value: string): string | undefined {
  return (rows.find(r => r.key === value) ?? rows.find(r => r.id === value))?.key
}

/** The cursor's event key as the data knows it: a key stays, an event id becomes its key, and anything else is none. */
export function resolveAt(data: ProjectData, at?: string): string | undefined {
  if (at === undefined) return undefined
  return keyFor(data.events, at)
}

/**
 * The timeline filter with its people as the data knows them: an id of an old link becomes the
 * key, and a person the data no longer has, for example after a refetch, drops out. An unchanged
 * filter is returned as is.
 */
export function resolveFilter(data: ProjectData, filter: Filter): Filter {
  const who = [...new Set(filter.who.flatMap(value => keyFor(data.characters, value) ?? []))]
  return who.length === filter.who.length && who.every((key, i) => key === filter.who[i]) ? filter : { ...filter, who }
}

/** The insights filter's person as the data knows it; one the data no longer has is cleared. An unchanged filter is returned as is. */
export function resolveInsightFilter(data: ProjectData, filter: InsightFilter): InsightFilter {
  if (filter.who === undefined) return filter
  const who = keyFor(data.characters, filter.who)
  if (who === filter.who) return filter
  return who ? { ...filter, who } : { category: filter.category }
}

/** What the phone's 人物 tab shows: its own list of people, the graph, or the ring. */
export type PeopleMode = 'list' | 'graph' | 'chord'

/**
 * The mode the 人物 tab opens in. A tap on the tab opens the list, the tab's own page; otherwise
 * the view, as the URL names it, picks the drawing, so `view=graph` opens the graph.
 */
export function initialPeopleMode(view: View, fromTab: boolean): PeopleMode {
  if (view === 'chord') return 'chord'
  return view === 'graph' && !fromTab ? 'graph' : 'list'
}

/** Everything a shell (desktop or phone) needs; App owns the state and the URL. */
export interface ShellState {
  projects: ProjectOption[]
  project: string
  onProject: (id: string) => void
  view: View
  onView: (view: View) => void
  data: ProjectData
  timeline: Timeline
  laneIndex: LaneIndex
  filter: Filter
  onFilter: (update: (filter: Filter) => Filter) => void
  mode: Mode
  onMode: (mode: Mode) => void
  sections: Section[]
  visible: number
  selection?: Selection
  /** The last selection, kept while a sheet animates closed. */
  lastSelection?: Selection
  select: (selection: Selection, scroll?: boolean) => void
  clearSelection: () => void
  step: (delta: number) => void
  collapsed: Set<string>
  onCollapsed: (collapsed: Set<string>) => void
  /** Switches to the timeline filtered to one person. */
  onOnly: (id: string) => void
  graph: Graph
  graphOptions: GraphOptions
  /** The faction whose members stand out in the graph. */
  highlight?: string
  onHighlight: (id?: string) => void
  onGraphOptions: (update: (options: GraphOptions) => GraphOptions) => void
  /** How hard the layout forces act. */
  forces: Forces
  onForces: (forces: Forces) => void
  /** Number of relations in the project, for the header. */
  relationCount: number
  factionCount: number
  /** The events and their links of the shown kinds, laid out. */
  causal: Causality
  causalKinds: Set<LinkKind>
  onCausalKinds: (kinds: Set<LinkKind>) => void
  /** A chain of event keys the causality graph lights, while the selection is on it; none lights the selection's causes and effects. */
  trail?: string[]
  /** Sets the chain to light (the insights' longest chain), or clears it. */
  onTrail: (ids?: string[]) => void
  /** The events in story order, for the scrubber. */
  storyEvents: StoryEvent[]
  /** The story as of one event; none shows the whole story. */
  cursor?: StoryCursor
  /** Sets the cursor to an event key, or clears it. */
  onCursor: (key?: string) => void
  /** Moves the cursor `delta` events through the story. */
  stepCursor: (delta: number) => void
  /** The findings and data gaps of the story as of the cursor (of the whole story without one), and what the insights view shows of them. */
  insights: Insight[]
  /** The story the insights are built from: as of the cursor, or the whole project. */
  insightData: ProjectData
  insightFilter: InsightFilter
  onInsightFilter: (filter: InsightFilter) => void
  /** Fetches the project again from the API, keeping everything the user set. */
  onRefresh: () => void
  /** A fetch is in flight. */
  refreshing: boolean
  /** The last fetch failed; the data shown is the last that loaded. */
  refreshFailed: boolean
}

/**
 * The props of the views both shells show, built once from the shell state: the timeline, the
 * story scrubber and its brief button, the relation graph (without its zoom), the ring, and the
 * causality graph (without its zoom). Each shell adds its own layout props, such as `phone` or `compact`.
 */
export function viewProps(s: ShellState, t: Dictionary) {
  const selectedEvent = s.selection?.kind === 'event' ? s.selection.id : undefined
  const selectedCharacter = s.selection?.kind === 'character' ? s.selection.id : undefined
  const onEvent = (id: string) => s.select({ kind: 'event', id })
  const onCharacter = (id: string) => s.select({ kind: 'character', id })
  const people = { graph: s.graph, laneIndex: s.laneIndex, selectedId: selectedCharacter, onSelect: onCharacter, showLabels: s.graphOptions.labels, highlight: s.highlight, cursor: s.cursor }
  return {
    selectedEvent,
    selectedCharacter,
    timeline: {
      sections: s.sections,
      lanes: s.timeline.lanes,
      laneIndex: s.laneIndex,
      who: s.filter.who,
      worldLane: s.timeline.world > 0,
      worldHidden: s.filter.hideWorld,
      selectedId: selectedEvent,
      selectedCharacterId: selectedCharacter,
      cursor: s.cursor,
      onSelect: onEvent,
      onCharacter,
      onWorld: () => s.onFilter(f => ({ ...f, hideWorld: !f.hideWorld })),
      onClear: () => s.onFilter(() => emptyFilter),
    },
    scrubber: { events: s.storyEvents, cursor: s.cursor, onCursor: s.onCursor, onStep: s.stepCursor },
    storyBrief: {
      label: t.copyBriefAsOf(t.copyStoryBrief, s.cursor?.event.title),
      brief: () => storyBrief(s.data, t, s.cursor),
      file: briefFileName(s.data.id, 'story', s.cursor ? `at-${s.cursor.event.key}` : ''),
      downloadLabel: t.copyBriefAsOf(t.downloadStoryBrief, s.cursor?.event.title),
    },
    chordGraph: people,
    relationGraph: { ...people, onSelectEvent: onEvent, forces: s.forces },
    causalGraph: { causal: s.causal, selectedId: selectedEvent, onSelect: onEvent, cursor: s.cursor, trail: s.trail },
  }
}
