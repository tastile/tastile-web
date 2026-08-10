import type { Locale } from "@/shared/stores/locale-store";

// Locale picker self-name labels for every locale. The legacy tree carries
// this at the top level under `language.<code>`. Kept in a dedicated section
// so the skeleton locales (zh-CN / ko / es) can populate these keys while
// every other section is an empty object.
export const language = {
  en: {
    language: {
      "zh-CN": "中文",
      en: "English",
      ja: "日本語",
      ko: "한국어",
      es: "Español",
    },
  },
  ja: {
    language: {
      "zh-CN": "中文",
      en: "English",
      ja: "日本語",
      ko: "한국어",
      es: "Español",
    },
  },
  "zh-CN": {
    language: {
      "zh-CN": "中文",
      en: "English",
      ja: "日本語",
      ko: "한국어",
      es: "Español",
    },
  },
  ko: {
    language: {
      "zh-CN": "中文",
      en: "English",
      ja: "日本語",
      ko: "한국어",
      es: "Español",
    },
  },
  es: {
    language: {
      "zh-CN": "中文",
      en: "English",
      ja: "日本語",
      ko: "한국어",
      es: "Español",
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;
