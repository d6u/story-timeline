import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useLang, type Lang } from '../i18n'

const LANGS: [Lang, string, string][] = [['zh', '中文', 'zh-CN'], ['en', 'EN', 'en']]

/** Desktop: a 中文 / EN segment. Phone (`pill`): one button that names the other language. */
export function LangToggle({ pill = false }: { pill?: boolean }) {
  const { lang, t, setLang } = useLang()
  if (pill) {
    const other = LANGS.find(([code]) => code !== lang)!
    return (
      <Button variant="outline" size="sm" aria-label={t.switchLanguage} lang={other[2]} onClick={() => setLang(other[0])} className="h-8 rounded-full px-3 text-xs font-semibold tracking-wide">
        {other[1]}
      </Button>
    )
  }
  return (
    <ToggleGroup type="single" variant="outline" size="sm" aria-label={t.language} value={lang} onValueChange={value => value && setLang(value as Lang)}>
      {LANGS.map(([code, label, tag]) => <ToggleGroupItem key={code} value={code} lang={tag} className="px-2.5 whitespace-nowrap">{label}</ToggleGroupItem>)}
    </ToggleGroup>
  )
}
