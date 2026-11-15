import { expect, it } from 'vitest'
import { relationTone } from './relations.ts'

it.each([['父亲梁德顺', 'family'], ['未婚妻', 'love'], ['旧友多年', 'friend'], ['忠臣', 'work'], ['监视者', 'hostile'], ['陌生人', 'neutral']])('colors relation prefix %s', (word, tone) => expect(relationTone(word)).toBe(tone))

it.each([
  ['阿尔法', 'hostile', 'hostile'], ['父亲', 'work', 'work'], ['敌人', 'love', 'love'], ['父亲', 'other', 'neutral'], ['陌生人', 'family', 'family'],
] as const)('a stored tone wins over the word: %s with %s is %s', (word, stored, tone) => expect(relationTone(word, stored)).toBe(tone))
it.each([['父亲', 'family'], ['敌人', 'hostile'], ['阿尔法', 'neutral']] as const)('without a stored tone the word decides: %s', (word, tone) => {
  expect(relationTone(word, null)).toBe(tone)
  expect(relationTone(word, undefined)).toBe(tone)
})
