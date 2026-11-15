import { RotateCcwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useT } from '../i18n'
import { defaultForces, FORCE_MAX, FORCE_MIN, type Forces } from '../relations/graph'

const KEYS: (keyof Forces)[] = ['repel', 'distance', 'cluster']

/** Three sliders for the layout forces, each a multiple of its default, and a button back to the defaults. */
export function ForceControls({ forces, onForces, className }: { forces: Forces; onForces: (forces: Forces) => void; className?: string }) {
  const t = useT()
  const labels: Record<keyof Forces, string> = { repel: t.forceRepel, distance: t.forceDistance, cluster: t.forceCluster }
  const isDefault = KEYS.every(k => forces[k] === defaultForces[k])
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {KEYS.map(key => (
        <label key={key} className="flex flex-col gap-1 text-sm">
          <span className="flex items-baseline justify-between">
            <span>{labels[key]}</span>
            <span className="font-mono text-[11px] text-muted-foreground">{forces[key].toFixed(1)}×</span>
          </span>
          <input
            type="range"
            min={FORCE_MIN}
            max={FORCE_MAX}
            step={0.1}
            value={forces[key]}
            aria-label={labels[key]}
            aria-valuetext={`${forces[key].toFixed(1)}×`}
            onChange={e => onForces({ ...forces, [key]: Number(e.target.value) })}
            onDoubleClick={() => onForces({ ...forces, [key]: defaultForces[key] })}
            className="h-5 w-full cursor-pointer accent-primary"
          />
        </label>
      ))}
      <Button variant="ghost" size="sm" disabled={isDefault} onClick={() => onForces(defaultForces)} className="h-7 justify-start gap-1.5 px-1.5 text-xs font-normal text-muted-foreground">
        <RotateCcwIcon className="size-3" />{t.forceDefaults}
      </Button>
    </div>
  )
}
