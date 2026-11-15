import { RefreshCwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useT } from '../i18n'

/**
 * Fetches the project again from the API. The icon turns while a fetch is in flight, and the
 * button turns red when the last fetch failed; the view and the data shown stay as they are.
 * `phone` is the larger touch size of the phone header.
 */
export function RefreshButton({ onRefresh, refreshing, failed, phone = false }: { onRefresh: () => void; refreshing: boolean; failed: boolean; phone?: boolean }) {
  const t = useT()
  const label = refreshing ? t.refreshing : failed ? t.refreshFailed : t.refresh
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={phone ? 'ghost' : 'outline'}
          size={phone ? 'icon-lg' : 'icon-sm'}
          aria-label={label}
          aria-busy={refreshing}
          onClick={onRefresh}
          className={cn(phone ? 'size-11 rounded-xl' : 'size-8', failed && !refreshing && 'text-destructive')}
        >
          <RefreshCwIcon className={cn(phone && 'size-[18px]', refreshing && 'animate-spin')} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}
