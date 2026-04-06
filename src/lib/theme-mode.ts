export type ThemeMode = 'light' | 'dark-gray' | 'dark-black'

export const THEME_MODE_STORAGE_KEY = 'theme-mode'

export function resolveThemeMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const stored = window.localStorage.getItem(THEME_MODE_STORAGE_KEY)
  if (stored === 'light' || stored === 'dark-gray' || stored === 'dark-black') {
    return stored
  }

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark-gray' : 'light'
}

export function applyThemeMode(mode: ThemeMode) {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  root.classList.remove('dark', 'theme-dark-gray', 'theme-dark-black', 'theme-light', 'theme-gray', 'theme-dark')

  if (mode === 'dark-gray') {
    root.classList.add('dark', 'theme-dark-gray')
  }

  if (mode === 'dark-black') {
    root.classList.add('dark', 'theme-dark-black')
  }

  window.localStorage.setItem(THEME_MODE_STORAGE_KEY, mode)
}
