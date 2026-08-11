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
  "zh-CN": {
    dashboard: {
      sidePanelDetailsTitle: "详情",
      sidePanelOpenAria: "打开侧边面板",
    },
  },
  ko: {
    dashboard: {
      sidePanelDetailsTitle: "세부 정보",
      sidePanelOpenAria: "측면 패널 열기",
    },
  },
  es: {
    dashboard: {
      sidePanelDetailsTitle: "Detalles",
      sidePanelOpenAria: "Abrir panel lateral",
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;
