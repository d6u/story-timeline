import type { CSSProperties } from 'react'
import { SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'
import { useT } from '../i18n'
import { drawnAt, factionMembers, factionsHeld, type StoryCursor } from '../cursor/state'
import type { ProjectData } from '../data/types'
import { labelMode, matchPeople, TONES, toneCounts, type Forces, type Graph, type GraphOptions, type Tone } from '../relations/graph'
import { ForceControls } from './ForceControls'
import { personColor, type LaneIndex } from './people'

const ROW = 'h-7 w-full justify-start gap-2 rounded-md px-2 text-sm font-normal'
const COUNT = 'ml-auto font-mono text-[11px] text-muted-foreground'

/**
 * The left island of the relations view: the people search, relation types, display options, the
 * people in the graph and the factions. The search narrows the list here and lights its matches in
 * the graph; Enter centres the graph on the first match.
 */
export function RelationsSidebar({ data, graph, laneIndex, options, onOptions, forces, onForces, highlight, onHighlight, selectedId, onSelect, cursor, query, onQuery, onFind }: {
  data: ProjectData
  graph: Graph
  laneIndex: LaneIndex
  options: GraphOptions
  onOptions: (update: (options: GraphOptions) => GraphOptions) => void
  /** The layout forces to offer sliders for; none on a view without a simulation. */
  forces?: Forces
  onForces: (forces: Forces) => void
  /** The faction whose members stand out. */
  highlight?: string
  onHighlight: (id?: string) => void
  selectedId?: string
  onSelect: (id: string) => void
  /** At a cursor, the factions count the members they have then. */
  cursor?: StoryCursor
  /** The people search, kept by the shell so the graph can light its matches. */
  query: string
  onQuery: (query: string) => void
  /** Centres the graph on a person, without selecting them. */
  onFind?: (id: string) => void
}) {
  const t = useT()
  const counts = toneCounts(data)
  const tones = TONES.filter(tone => counts.has(tone))
  const degree = new Map<string, number>()
  for (const e of graph.edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1)
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1)
  }
  const matches = matchPeople(graph.nodes, id => data.characters.find(c => c.key === id)?.metadata.aliases, query)
  const people = matches ? graph.nodes.filter(n => matches.has(n.id)) : graph.nodes
  // On a large graph the names show only around the person in focus; the option says so.
  const namesOnFocus = labelMode(true, drawnAt(graph, cursor).edgeCount) === 'focus'
  const toggleTone = (tone: Tone, on: boolean) => onOptions(o => {
    const next = new Set(o.tones)
    if (on) next.add(tone)
    else next.delete(tone)
    return { ...o, tones: next }
  })
  const members = factionMembers(graph.nodes, cursor)
  const DISPLAY = [['showMinor', t.showMinor]] as const
  // Highlighting a faction also brings its first member into view.
  const toggleFaction = (id: string) => {
    onHighlight(highlight === id ? undefined : id)
    if (highlight === id) return
    const first = graph.nodes.find(n => factionsHeld(n.factions, cursor).includes(id))
    if (first) document.querySelector(`[data-node="${CSS.escape(first.id)}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  return (
    <FieldGroup className="gap-6 p-4 [&_[data-slot=field-legend]]:mb-0 [&_[data-slot=field-set]]:gap-2">
      <Field className="gap-2">
        <FieldLabel htmlFor="search-people">{t.searchPeople}</FieldLabel>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="search-people"
            type="search"
            className="pl-8"
            value={query}
            placeholder={t.searchPeoplePh}
            aria-describedby={onFind ? 'search-people-hint' : undefined}
            onChange={e => onQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && people[0] && onFind) { e.preventDefault(); onFind(people[0].id) } }}
          />
          {onFind && <span id="search-people-hint" className="sr-only">{t.searchPeopleHint}</span>}
        </div>
      </Field>

      <FieldSet>
        <FieldLegend variant="label">{t.relKinds}</FieldLegend>
        <FieldGroup className="gap-2.5">
          {tones.map(tone => (
            <Field key={tone} orientation="horizontal">
              <Checkbox id={`tone-${tone}`} aria-label={t.tone[tone]} checked={options.tones.has(tone)} onCheckedChange={value => toggleTone(tone, value === true)} />
              <FieldLabel htmlFor={`tone-${tone}`} className="flex-1 font-normal">{t.tone[tone]}</FieldLabel>
              <span className="font-mono text-[11px] text-muted-foreground">{counts.get(tone)}</span>
            </Field>
          ))}
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend variant="label">{t.display}</FieldLegend>
        <FieldGroup className="gap-2.5">
          {DISPLAY.map(([key, label]) => (
            <Field key={key} orientation="horizontal">
              <Checkbox id={`opt-${key}`} aria-label={label} checked={options[key]} onCheckedChange={value => onOptions(o => ({ ...o, [key]: value === true }))} />
              <FieldLabel htmlFor={`opt-${key}`} className="font-normal">{label}</FieldLabel>
            </Field>
          ))}
          <Field orientation="horizontal">
            <Checkbox id="opt-labels" aria-label={t.showLabels} aria-describedby={namesOnFocus && options.labels ? 'opt-labels-hint' : undefined} checked={options.labels} onCheckedChange={value => onOptions(o => ({ ...o, labels: value === true }))} />
            <FieldContent>
              <FieldLabel htmlFor="opt-labels" className="font-normal">{t.showLabels}</FieldLabel>
              {namesOnFocus && options.labels && <FieldDescription id="opt-labels-hint" className="text-xs">{t.labelsOnFocus}</FieldDescription>}
            </FieldContent>
          </Field>
        </FieldGroup>
      </FieldSet>

      {forces && (
        <FieldSet>
          <FieldLegend variant="label">{t.layoutForces}</FieldLegend>
          <ForceControls forces={forces} onForces={onForces} />
        </FieldSet>
      )}

      <FieldSet>
        <FieldLegend variant="label">{t.people}</FieldLegend>
        <div className="-mx-2 flex flex-col">
          {people.map(n => (
            <Button key={n.id} variant="ghost" size="sm" aria-pressed={n.id === selectedId} style={personColor(laneIndex, n.id)} onClick={() => onSelect(n.id)} className={cn(ROW, 'aria-pressed:bg-(--c)/15 aria-pressed:text-person')}>
              <span className="size-2 shrink-0 rounded-full bg-(--c)" />
              <span className="truncate">{n.name}</span>
              <span className={COUNT}>{degree.get(n.id) ?? 0}</span>
            </Button>
          ))}
        </div>
      </FieldSet>

      {graph.factions.length > 0 && (
        <FieldSet>
          <FieldLegend variant="label">{t.highlightFaction}</FieldLegend>
          <div className="-mx-2 flex flex-col">
            {graph.factions.map(f => (
              <Button key={f.id} variant="ghost" size="sm" aria-pressed={highlight === f.id} style={{ '--f': f.color } as CSSProperties} onClick={() => toggleFaction(f.id)} className={cn(ROW, 'aria-pressed:bg-(--f)/15', !members.has(f.id) && 'text-muted-foreground')}>
                <span className={cn('size-2 shrink-0 rounded-xs bg-(--f)', !members.has(f.id) && 'opacity-40')} />
                <span className="truncate">{f.name}</span>
                <span className={COUNT}>{members.get(f.id) ?? 0}</span>
              </Button>
            ))}
          </div>
        </FieldSet>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-2 text-xs text-muted-foreground">
        <div className="flex h-5 items-center gap-1.5"><Kbd>F</Kbd><span>{t.fit}</span></div>
        <div className="flex h-5 items-center gap-1.5"><Kbd>Esc</Kbd><span>{t.closeHint}</span></div>
      </div>
    </FieldGroup>
  )
}
