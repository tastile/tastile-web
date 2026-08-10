import type { Locale } from "@/shared/stores/locale-store";

export const languageToggle = {
  en: {
    languageToggle: {
      switchToEnglish: "Switch to English",
      switchToJapanese: "Switch to Japanese",
    },
  },
  ja: {
    languageToggle: {
      switchToEnglish: "Switch to English",
      switchToJapanese: "日本語に切替",
    },
  },
  "zh-CN": {},
  ko: {},
  es: {},
} satisfies Record<Locale, Record<string, unknown>>;
