import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { applyThemeMode } from '@/lib/theme-mode'

export type Theme = 'light' | 'gray' | 'dark'

interface ThemeStore {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => {
        set({ theme })
        applyTheme(theme)
      },
    }),
    {
      name: 'tastile-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.theme)
        }
      },
    }
  )
)

function applyTheme(theme: Theme) {
  const mode = theme === 'light' ? 'light' : theme === 'gray' ? 'dark-gray' : 'dark-black'
  applyThemeMode(mode)
}
