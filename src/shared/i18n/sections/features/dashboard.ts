import type { Locale } from "@/shared/stores/locale-store";

export const dashboard = {
  en: {
    dashboard: {
      sidePanelTitle: "Side panel",
      sidePanelOpenAria: "Open side panel",
    },
  },
  ja: {
    dashboard: {
      sidePanelTitle: "サイドパネル",
      sidePanelOpenAria: "サイドパネルを開く",
    },
  },
  "zh-CN": {
    dashboard: {
      sidePanelTitle: "侧边面板",
      sidePanelOpenAria: "打开侧边面板",
    },
  },
  ko: {
    dashboard: {
      sidePanelTitle: "측면 패널",
      sidePanelOpenAria: "측면 패널 열기",
    },
  },
  es: {
    dashboard: {
      sidePanelTitle: "Panel lateral",
      sidePanelOpenAria: "Abrir panel lateral",
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;
