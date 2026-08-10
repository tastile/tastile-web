import type { Locale } from "@/shared/stores/locale-store";

export const dashboard = {
  en: {
    dashboard: {
      sidePanelDetailsTitle: "Details",
      sidePanelOpenAria: "Open side panel",
    },
  },
  ja: {
    dashboard: {
      sidePanelDetailsTitle: "詳細",
      sidePanelOpenAria: "サイドパネルを開く",
    },
  },
  "zh-CN": {},
  ko: {},
  es: {},
} satisfies Record<Locale, Record<string, unknown>>;
