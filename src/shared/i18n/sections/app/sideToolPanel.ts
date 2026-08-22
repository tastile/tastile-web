import type { Locale } from "@/shared/stores/locale-store";

export const sideToolPanel = {
  en: {
    sideToolPanel: {
      ariaLabel: "Detail panel",
    },
  },
  ja: {
    sideToolPanel: {
      ariaLabel: "詳細パネル",
    },
  },
  "zh-CN": {
    sideToolPanel: {
      ariaLabel: "详情面板",
    },
  },
  ko: {
    sideToolPanel: {
      ariaLabel: "상세 패널",
    },
  },
  es: {
    sideToolPanel: {
      ariaLabel: "Panel de detalle",
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;
