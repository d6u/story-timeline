import { useEffect, useState, type ReactNode } from 'react'
import { CheckIcon, ClipboardCopyIcon, ClipboardXIcon, DownloadIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useT } from '../i18n'

/** How long the note under the buttons stays, in ms. A failure stays longer, as it asks the user to act. */
const SHOWN = { copied: 1500, downloaded: 1500, failed: 6000 }

type State = 'idle' | keyof typeof SHOWN

/**
 * Copies text to the clipboard: the Clipboard API where the page may use it, else the older
 * `execCommand('copy')` on a hidden text area. Resolves to false when neither works, for example
 * on an insecure origin or when the user denied the clipboard.
 */
export async function copyText(text: string, doc: Document = document, clipboard: Pick<Clipboard, 'writeText'> | undefined = navigator.clipboard): Promise<boolean> {
  try {
    if (clipboard) {
      await clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the old way.
  }
  const area = doc.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  doc.body.append(area)
  try {
    area.select()
    return doc.execCommand('copy')
  } catch {
    return false
  } finally {
    area.remove()
  }
}

/** Saves text as a Markdown file through a temporary link. */
function downloadText(text: string, file: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = file
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Buttons for a Markdown brief: copy it to the clipboard and, with `file`, download it as that
 * file. `brief` runs on click, so the text is built only when it is needed. A short note under the
 * buttons says it worked, or why not; the note also shows on touch screens, where a tooltip does not.
 */
export function CopyBrief({ label, brief, file, downloadLabel, variant = 'outline', className }: {
  label: string
  brief: () => string
  /** The file name for the download button; without it there is no download button. */
  file?: string
  downloadLabel?: string
  variant?: 'outline' | 'ghost'
  className?: string
}) {
  const t = useT()
  const [state, setState] = useState<State>('idle')
  useEffect(() => {
    if (state === 'idle') return
    const timer = setTimeout(() => setState('idle'), SHOWN[state])
    return () => clearTimeout(timer)
  }, [state])

  const copy = async () => setState((await copyText(brief())) ? 'copied' : 'failed')
  const download = () => {
    downloadText(brief(), file!)
    setState('downloaded')
  }
  const note = state === 'copied' ? t.copied : state === 'downloaded' ? t.downloaded : state === 'failed' ? t.copyFailed : ''
  return (
    <span className="relative flex shrink-0 items-center gap-1">
      <BriefButton label={label} variant={variant} className={className} onClick={copy}>
        {state === 'copied' ? <CheckIcon /> : state === 'failed' ? <ClipboardXIcon /> : <ClipboardCopyIcon />}
      </BriefButton>
      {file && (
        <BriefButton label={downloadLabel ?? t.downloadBrief} variant={variant} className={className} onClick={download}>
          {state === 'downloaded' ? <CheckIcon /> : <DownloadIcon />}
        </BriefButton>
      )}
      <span
        aria-live="polite"
        className={cn(state !== 'idle' && 'absolute top-full right-0 z-20 mt-1 max-w-64 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-sm', state === 'failed' && 'text-destructive')}
      >
        {note}
      </span>
    </span>
  )
}

function BriefButton({ label, variant, className, onClick, children }: { label: string; variant: 'outline' | 'ghost'; className?: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant={variant} size="icon-sm" aria-label={label} onClick={onClick} className={cn('size-8 rounded-lg', className)}>{children}</Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}
