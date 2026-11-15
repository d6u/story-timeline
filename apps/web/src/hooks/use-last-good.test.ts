import { expect, it } from 'vitest'
import { keep } from './use-last-good'

it('keeps the shown object when a refetch brings the same data', () => {
  const first = keep(undefined, { a: 1 }, 'p')!
  const again = keep(first, { a: 1 }, 'p')
  expect(again).toBe(first)
  const changed = keep(first, { a: 2 }, 'p')!
  expect(changed).not.toBe(first)
  expect(changed.value).toEqual({ a: 2 })
})

it('keeps the last value while a refetch is in flight or failed, but only for its own scope', () => {
  const first = keep(undefined, { a: 1 }, 'p')
  expect(keep(first, undefined, 'p')).toBe(first)
  expect(keep(first, undefined, 'q')).toBeUndefined()
  expect(keep(first, { a: 1 }, 'q')?.scope).toBe('q')
})
