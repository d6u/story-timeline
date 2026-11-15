const relationWords = [
  ['family', ['父亲', '母亲', '养父', '养母', '哥哥', '弟弟', '姐姐', '妹妹', '兄长', '儿子', '女儿', '丈夫', '妻子', '祖父', '祖母']],
  ['love', ['恋人', '爱人', '伴侣', '未婚夫', '未婚妻', '前任']],
  ['friend', ['朋友', '旧友', '好友', '同学', '同伴', '室友']],
  ['work', ['上级', '下属', '参谋', '副手', '助手', '右臂', '忠臣', '搭档', '同事', '同伙', '师父', '徒弟', '老师', '学生']],
  ['hostile', ['敌人', '仇人', '对手', '刺客', '监视者']],
] as const
export const wordColors: Record<string, string> = {
  family: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  love: 'border-pink-500/40 bg-pink-500/10 text-pink-700 dark:text-pink-300',
  friend: 'border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-300',
  work: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  hostile: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
  // Link kinds, by `linkKind` in causality/build.ts; `same` is the confidence badge's colour.
  cause: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  setup: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  same: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  reveal: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  echo: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  neutral: 'border-border bg-muted text-muted-foreground',
  other: 'border-border bg-muted text-muted-foreground',
}

/** A relation tone as the web app groups relations. `neutral` is the 其他 (other) group. */
export type Tone = 'family' | 'love' | 'friend' | 'work' | 'hostile' | 'neutral'
export const TONES: Tone[] = ['family', 'love', 'friend', 'work', 'hostile', 'neutral']
/** A tone the author stored (`character_relations.tone`). `other` is none of the named tones. */
export type StoredTone = Exclude<Tone, 'neutral'> | 'other'

/**
 * The tone of a relation: the one place that decides it. A tone the author stored wins, and
 * `other` stops the guess. Without it, the relation word decides by its prefix.
 */
export function relationTone(word: string, stored?: StoredTone | null): Tone {
  if (stored) return stored === 'other' ? 'neutral' : stored
  return relationWords.find(([, words]) => words.some(prefix => word.startsWith(prefix)))?.[0] ?? 'neutral'
}
