import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Locale =
  | "en"
  | "ja"
  | "de"
  | "es"
  | "pt-BR"
  | "fr"
  | "ko"
  | "zh-CN";

export const SUPPORTED_LOCALES: readonly Locale[] = [
  "en",
  "ja",
  "de",
  "es",
  "pt-BR",
  "fr",
  "ko",
  "zh-CN",
] as const;

export const DEFAULT_LOCALE: Locale = "ja";

export const FALLBACK_LOCALE: Locale = "en";

interface LocaleStore {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleStore>()(
  persist(
    (set) => ({
      locale: DEFAULT_LOCALE,
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: "tastile-locale",
    },
  ),
);
