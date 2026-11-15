import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useT } from '../i18n'
import { useTheme, type Theme } from './theme-provider'

const THEMES = [
  ['light', 'light', SunIcon],
  ['dark', 'dark', MoonIcon],
  ['system', 'system', MonitorIcon],
] as const

/** Desktop: three toggles. Phone (`cycle`): one button that steps light → dark → system. */
export function ThemeToggle({ cycle = false }: { cycle?: boolean }) {
  const { theme, setTheme } = useTheme()
  const t = useT()
  if (cycle) {
    const at = THEMES.findIndex(([value]) => value === theme)
    const [, label, Icon] = THEMES[at < 0 ? 0 : at]
    const next = THEMES[(at + 1) % THEMES.length][0]
    return (
      <Button variant="ghost" size="icon-lg" aria-label={`${t.theme}: ${t[label]}`} onClick={() => setTheme(next)} className="size-11 rounded-xl"><Icon className="size-[18px]" /></Button>
    )
  }
  return (
    <ToggleGroup type="single" variant="outline" size="sm" aria-label={t.theme} value={theme} onValueChange={value => value && setTheme(value as Theme)}>
      {THEMES.map(([value, label, Icon]) => (
        <Tooltip key={value}>
          {/* A wrapper, so the tooltip's data-state does not replace the item's "on" state. */}
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <ToggleGroupItem value={value} aria-label={t[label]}><Icon /></ToggleGroupItem>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t[label]}</TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  )
}
