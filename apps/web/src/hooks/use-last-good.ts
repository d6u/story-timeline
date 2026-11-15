import { useMemo, useRef } from 'react'

/** The last good value of a query result, and the scope (for example the project) it belongs to. */
export interface Kept<T> {
  scope: string
  json: string
  value: T
}

/**
 * The value to show after a fetch. A new value that equals the kept one (by its JSON) gives back
 * the kept object, so a refetch that changes nothing changes nothing downstream either. With no
 * new value (a fetch in flight or failed) the kept value of the same scope stays; a value kept for
 * another scope is never shown.
 */
export function keep<T>(kept: Kept<T> | undefined, next: T | undefined, scope: string): Kept<T> | undefined {
  if (next === undefined) return kept?.scope === scope ? kept : undefined
  const json = JSON.stringify(next)
  if (kept?.scope === scope && kept.json === json) return kept
  return { scope, json, value: next }
}

/** `keep` as a hook: the value to show for `next` in `scope`. */
export function useLastGood<T>(next: T | undefined, scope: string): T | undefined {
  const kept = useRef<Kept<T> | undefined>(undefined)
  return useMemo(() => {
    kept.current = keep(kept.current, next, scope)
    return kept.current?.value
  }, [next, scope])
}
