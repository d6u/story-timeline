import { useCallback, useState } from 'react'

/** State that survives a reload. Storage can be blocked; the value then lasts for this page only. */
export function useStored<T>(key: string, initial: T, parse: (raw: string) => T | undefined = raw => JSON.parse(raw)): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      const parsed = raw === null ? undefined : parse(raw)
      return parsed === undefined ? initial : parsed
    } catch {
      return initial
    }
  })
  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue(prev => {
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next
      try {
        localStorage.setItem(key, JSON.stringify(resolved))
      } catch {
        // Keep the in-memory value.
      }
      return resolved
    })
  }, [key])
  return [value, set]
}
