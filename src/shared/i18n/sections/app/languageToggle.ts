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
  "zh-CN": {
    languageToggle: {
      switchToEnglish: "切换到 English",
      switchToJapanese: "切换到 日本語",
    },
  },
  ko: {
    languageToggle: {
      switchToEnglish: "English로 전환",
      switchToJapanese: "日本語로 전환",
    },
  },
  es: {
    languageToggle: {
      switchToEnglish: "Cambiar a inglés",
      switchToJapanese: "Cambiar a japonés",
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;
