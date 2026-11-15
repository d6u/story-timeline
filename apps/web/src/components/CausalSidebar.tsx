import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'
import { useT } from '../i18n'
import type { ProjectData } from '../data/types'
import { kindCounts, LINK_KINDS, type Causality, type LinkKind } from '../causality/build'
import { KIND_COLOR } from './CausalGraph'

/** How many events the ranking lists. */
const TOP = 15
const ROW = 'h-7 w-full justify-start gap-2 rounded-md px-2 text-sm font-normal'

/** The left island of the causality view: the link kinds to draw, and the events that lead to the most others. */
export function CausalSidebar({ data, causal, kinds, onKinds, selectedId, onSelect }: {
  data: ProjectData
  causal: Causality
  kinds: Set<LinkKind>
  onKinds: (kinds: Set<LinkKind>) => void
  selectedId?: string
  onSelect: (id: string) => void
}) {
  const t = useT()
  const counts = kindCounts(data)
  const toggle = (kind: LinkKind, on: boolean) => {
    const next = new Set(kinds)
    if (on) next.add(kind)
    else next.delete(kind)
    onKinds(next)
  }
  const ranked = causal.nodes.filter(n => n.reach > 0).sort((a, b) => b.reach - a.reach || a.order - b.order).slice(0, TOP)

  return (
    <FieldGroup className="gap-6 p-4 [&_[data-slot=field-legend]]:mb-0 [&_[data-slot=field-set]]:gap-2">
      <FieldSet>
        <FieldLegend variant="label">{t.linkKinds}</FieldLegend>
        <FieldGroup className="gap-2.5">
          {LINK_KINDS.filter(kind => counts.has(kind)).map(kind => (
            <Field key={kind} orientation="horizontal">
              <Checkbox id={`kind-${kind}`} checked={kinds.has(kind)} onCheckedChange={value => toggle(kind, value === true)} />
              <FieldLabel htmlFor={`kind-${kind}`} className="flex-1 gap-2 font-normal">
                <i className="h-0.5 w-3.5 shrink-0 rounded-full" style={{ background: KIND_COLOR[kind] }} />
                {t.linkKind[kind]}
              </FieldLabel>
              <span className="font-mono text-[11px] text-muted-foreground">{counts.get(kind)}</span>
            </Field>
          ))}
        </FieldGroup>
      </FieldSet>

      {ranked.length > 0 && (
        <FieldSet className="min-w-0">
          <FieldLegend variant="label">{t.consequential}</FieldLegend>
          <div className="-mx-2 flex flex-col">
            {ranked.map(n => (
              <Button key={n.id} variant="ghost" size="sm" aria-pressed={n.id === selectedId} title={`${n.title} · ${t.reach(n.reach)}`} onClick={() => onSelect(n.id)} className={cn(ROW, 'aria-pressed:bg-muted')}>
                <span className={cn('h-3 w-[3px] shrink-0 rounded-full', n.core ? 'bg-story' : 'bg-transparent')} />
                <span className="min-w-0 truncate">{n.title}</span>
                <span className="ml-auto font-mono text-[11px] text-muted-foreground">{n.reach}</span>
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
