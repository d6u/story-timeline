import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useT } from '../i18n'

export interface ProjectOption {
  id: string
  name: string
}

/** Desktop: the STORY TIMELINE mark and a select. Phone (`title`): the name as a serif title with a subtitle line. */
export function ProjectPicker({ projects, value, onChange, subtitle }: {
  projects: ProjectOption[]
  value: string
  onChange: (id: string) => void
  subtitle?: string
}) {
  const t = useT()
  const title = subtitle !== undefined
  const name = projects.find(p => p.id === value)?.name
  return (
    <div className={cn('flex min-w-0 items-center gap-3', title && 'gap-0')}>
      {/* The mark gives way below 1280px, so the views and the tools keep their room. */}
      {!title && <p className="font-mono text-[11px] tracking-[0.12em] whitespace-nowrap text-muted-foreground max-xl:hidden">STORY TIMELINE</p>}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          aria-label={title ? t.switchProject : t.project}
          title={name}
          size="sm"
          // A long name ends in an ellipsis; the whole name is the tooltip.
          className={cn(title ? '' : 'max-w-56 min-w-40 max-xl:min-w-24 *:data-[slot=select-value]:block *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:truncate', title && 'h-11 min-w-0 rounded-xl border-0 bg-transparent px-2 shadow-none dark:bg-transparent *:data-[slot=select-value]:flex-col *:data-[slot=select-value]:items-start *:data-[slot=select-value]:gap-0')}
        >
          {title ? (
            <SelectValue placeholder={t.pickProject}>
              <span className="font-heading text-[17px] leading-tight font-bold tracking-wide">{name ?? t.pickProject}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{subtitle}</span>
            </SelectValue>
          ) : <SelectValue placeholder={t.pickProject} />}
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}
