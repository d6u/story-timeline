import { useState } from 'react'
import { SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Filter, Mode, Section, Timeline } from '../timeline/build'
import { emptyFilter } from '../timeline/build'
import { cn } from '@/lib/utils'
import { useT } from '../i18n'
import { personColor, type LaneIndex } from './people'

const KINDS = [['coreOnly', 'coreOnly'], ['hideWorld', 'hideWorld']] as const

/** One row of a list: full-bleed hover, text aligned with the section label. */
const ROW = 'h-7 w-full justify-start rounded-md px-2 text-sm'
const COUNT = 'ml-auto font-mono text-[11px] text-muted-foreground'
/** The chosen side of a two-way choice reads at a glance: the other side is muted, the chosen one is solid. */
const SEG_ON = '*:font-normal *:text-muted-foreground *:data-[state=on]:bg-foreground *:data-[state=on]:font-medium *:data-[state=on]:text-background *:data-[state=on]:hover:bg-foreground/90 *:data-[state=on]:hover:text-background'
/** A two-way choice that fills the panel width. */
const SPLIT = `w-full *:flex-1 *:px-0 ${SEG_ON}`
/** The phone's larger targets. */
const PHONE_SEG = `w-full *:h-10 *:flex-1 *:px-0 *:text-sm ${SEG_ON}`

export function Sidebar({ timeline, laneIndex, filter, onFilter, mode, onMode, sections, shown, phone = false }: {
  timeline: Timeline
  laneIndex: LaneIndex
  filter: Filter
  onFilter: (update: (filter: Filter) => Filter) => void
  mode: Mode
  onMode: (mode: Mode) => void
  sections: Section[]
  shown: number
  /** Phone drawer: people as chips, larger controls, no jump list and no key hints. */
  phone?: boolean
}) {
  const t = useT()
  const [allPeople, setAllPeople] = useState(false)
  const set = (patch: Partial<Filter>) => onFilter(f => ({ ...f, ...patch }))
  const toggleWho = (id: string) =>
    onFilter(f => ({ ...f, who: f.who.includes(id) ? f.who.filter(x => x !== id) : [...f.who, id] }))
  const counts = new Map<string, number>()
  for (const entry of timeline.entries) for (const id of entry.event.character_ids) counts.set(id, (counts.get(id) ?? 0) + 1)
  const changed = JSON.stringify(filter) !== JSON.stringify(emptyFilter)
  // Lanes first in lane order, then everyone else by how often they appear.
  const laneIds = new Set(timeline.lanes.map(c => c.key))
  const others = timeline.characters
    .filter(c => !laneIds.has(c.key))
    .sort((a, b) => (counts.get(b.key) ?? 0) - (counts.get(a.key) ?? 0) || a.name.localeCompare(b.name, 'zh'))
  const jump = (key: string) => document.getElementById(`sec-${key}`)?.scrollIntoView({ block: 'start' })
  // The phone shows the lanes and any selected person; the rest fold behind "more".
  const phonePeople = allPeople ? [...timeline.lanes, ...others] : [...timeline.lanes, ...others.filter(c => filter.who.includes(c.key))]
  const hidden = others.length - others.filter(c => filter.who.includes(c.key)).length

  return (
    <FieldGroup className={cn('gap-6 p-4 [&_[data-slot=field-legend]]:mb-0 [&_[data-slot=field-set]]:gap-2', phone && 'gap-5 px-5 pt-2 pb-6')}>
      <Field className="gap-2">
        <FieldLabel htmlFor="search" className={cn(phone && 'sr-only')}>{t.search}</FieldLabel>
        <div className="relative">
          <SearchIcon className={cn('pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground', phone && 'left-3')} />
          <Input id="search" type="search" className={cn('pl-8', phone && 'h-11 rounded-xl bg-muted pl-9 text-[15px]')} value={filter.query} placeholder={t.searchPh} onChange={e => set({ query: e.target.value })} />
        </div>
      </Field>

      <FieldSet>
        <FieldLegend variant="label">{t.order}</FieldLegend>
        <ToggleGroup type="single" variant="outline" size="sm" className={phone ? PHONE_SEG : SPLIT} value={mode} onValueChange={value => value && onMode(value as Mode)}>
          <ToggleGroupItem value="time">{t.byTime}</ToggleGroupItem>
          <ToggleGroupItem value="act">{t.byAct}</ToggleGroupItem>
        </ToggleGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend variant="label">{t.people}</FieldLegend>
        {phone ? (
          <div className="flex flex-wrap gap-2">
            {phonePeople.map(c => (
              <Toggle
                key={c.key}
                variant="outline"
                pressed={filter.who.includes(c.key)}
                onPressedChange={() => toggleWho(c.key)}
                style={personColor(laneIndex, c.key)}
                className="h-9 gap-1.5 rounded-full bg-card px-3 text-[13px] font-normal data-[state=on]:border-(--c)/50 data-[state=on]:bg-(--c)/15 data-[state=on]:text-person"
              >
                <span className="size-2 shrink-0 rounded-full bg-(--c)" />
                {c.name}
                <span className="font-mono text-[11px] opacity-75">{counts.get(c.key) ?? 0}</span>
              </Toggle>
            ))}
            {hidden > 0 && (
              <Button variant="outline" size="sm" onClick={() => setAllPeople(v => !v)} className="h-9 rounded-full bg-card px-3 text-[13px] font-normal text-muted-foreground">
                {allPeople ? t.less : t.more(hidden)}
              </Button>
            )}
          </div>
        ) : (
          <div className="-mx-2 flex flex-col">
            {[...timeline.lanes, ...others].map(c => (
              <Toggle
                key={c.key}
                size="sm"
                pressed={filter.who.includes(c.key)}
                onPressedChange={() => toggleWho(c.key)}
                style={personColor(laneIndex, c.key)}
                className={cn(ROW, 'gap-2 data-[state=on]:bg-(--c)/15 data-[state=on]:text-person')}
              >
                <span className="size-2 shrink-0 rounded-full bg-(--c)" />
                <span className="truncate">{c.name}</span>
                <span className={COUNT}>{counts.get(c.key) ?? 0}</span>
              </Toggle>
            ))}
          </div>
        )}
        {filter.who.length > 1 && (
          <ToggleGroup type="single" variant="outline" size="sm" className={cn(phone ? PHONE_SEG : SPLIT, phone && 'mt-1')} value={filter.match} onValueChange={value => value && set({ match: value as Filter['match'] })}>
            <ToggleGroupItem value="all">{t.matchAll}</ToggleGroupItem>
            <ToggleGroupItem value="any">{t.matchAny}</ToggleGroupItem>
          </ToggleGroup>
        )}
      </FieldSet>

      <FieldSet>
        <FieldLegend variant="label">{t.kinds}</FieldLegend>
        <FieldGroup className={cn('gap-2.5', phone && 'gap-0')}>
          {KINDS.map(([key, label]) => (
            <Field key={key} orientation="horizontal" className={cn(phone && 'h-11 gap-3')}>
              <Checkbox id={`kind-${key}`} aria-label={t[label]} checked={filter[key]} onCheckedChange={value => set({ [key]: value === true })} className={cn(phone && 'size-5 rounded-md')} />
              <FieldLabel htmlFor={`kind-${key}`} className={cn('font-normal', phone && 'text-[15px]')}>{t[label]}</FieldLabel>
            </Field>
          ))}
        </FieldGroup>
      </FieldSet>

      {!phone && (
        <FieldSet>
          <FieldLegend variant="label">{t.jump}</FieldLegend>
          <nav className="-mx-2 flex flex-col">
            {sections.map(s => (
              <Button key={s.key} variant="ghost" size="sm" className={cn(ROW, 'font-normal')} onClick={() => jump(s.key)}>
                <span className="truncate">{s.label}</span>
                <span className={COUNT}>{s.groups.reduce((n, g) => n + g.entries.length, 0)}</span>
              </Button>
            ))}
          </nav>
        </FieldSet>
      )}

      {!phone && (
        <div className="mt-auto flex flex-col gap-2 pt-2 text-xs text-muted-foreground">
          <div className="flex h-5 items-center justify-between">
            <span>{t.showing} <span className="font-mono">{shown} / {timeline.entries.length}</span></span>
            {changed && <Button variant="link" size="xs" className="h-auto px-0" onClick={() => onFilter(() => emptyFilter)}>{t.clearFilter}</Button>}
          </div>
          <div className="flex h-5 items-center gap-1.5"><Kbd>J</Kbd><Kbd>K</Kbd><span>{t.stepHint}</span></div>
          <div className="flex h-5 items-center gap-1.5"><Kbd>Esc</Kbd><span>{t.closeHint}</span></div>
        </div>
      )}
    </FieldGroup>
  )
}
