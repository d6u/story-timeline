import { createContext, use, useEffect, useState, type ReactNode } from 'react'
import { useMediaQuery } from '@/hooks/use-media-query'

export type Theme = 'light' | 'dark' | 'system'

/** Read by the inline script in index.html too, so the first paint has the right theme. */
export const THEME_KEY = 'story-timeline-theme'

interface ThemeState {
  theme: Theme
  /** The theme in effect after resolving "system". */
  resolved: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeState | null>(null)

function storedTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(storedTheme)
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
  }, [resolved])

  const setTheme = (next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // Storage can be blocked; the choice then lasts for this page only.
    }
  }

  return <ThemeContext value={{ theme, resolved, setTheme }}>{children}</ThemeContext>
}

export function useTheme(): ThemeState {
  const state = use(ThemeContext)
  if (!state) throw new Error('useTheme needs a ThemeProvider')
  return state
}
