import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Locale = 'ja' | 'en'

interface LocaleStore {
  locale: Locale
  setLocale: (locale: Locale) => void
}

export const useLocaleStore = create<LocaleStore>()(
  persist(
    (set) => ({
      locale: 'ja',
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: 'tastile-locale',
    }
  )
)
