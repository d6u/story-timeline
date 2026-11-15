import { expect, it } from 'vitest'
import { copyText } from './CopyBrief'

/** Just enough of a document for the old copy path. */
function fakeDocument(copies: boolean | 'throws') {
  const log: string[] = []
  const doc = {
    body: { append: () => log.push('append') },
    createElement: () => ({ value: '', style: {}, setAttribute() {}, select: () => log.push('select'), remove: () => log.push('remove') }),
    execCommand: () => {
      if (copies === 'throws') throw new Error('no')
      return copies
    },
  }
  return { doc: doc as unknown as Document, log }
}

it('copies with the Clipboard API when it works', async () => {
  const written: string[] = []
  const { doc, log } = fakeDocument(false)
  expect(await copyText('brief', doc, { writeText: async text => { written.push(text) } })).toBe(true)
  expect(written).toEqual(['brief'])
  expect(log).toEqual([])
})
it('falls back to the old copy when the API is missing or rejects', async () => {
  expect(await copyText('brief', fakeDocument(true).doc, undefined)).toBe(true)
  const { doc, log } = fakeDocument(true)
  expect(await copyText('brief', doc, { writeText: () => Promise.reject(new Error('denied')) })).toBe(true)
  expect(log).toEqual(['append', 'select', 'remove'])
})
it('reports a failure when neither way copies', async () => {
  expect(await copyText('brief', fakeDocument(false).doc, undefined)).toBe(false)
  expect(await copyText('brief', fakeDocument('throws').doc, { writeText: () => Promise.reject(new Error('denied')) })).toBe(false)
})
