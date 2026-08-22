import type { Locale } from "@/shared/stores/locale-store";

// Page-level metadata for the public marketing pages. Kept separate from
// the marketing bundle (which is WIP) so download/pricing can move
// independently. Falls through to English for non en/ja locales via the
// translations store.
export const metadata = {
  en: {
    metadata: {
      download: {
        title: "Download Tastile — Execution Control",
        description:
          "Download Tastile for Windows. Start controlling your execution today.",
      },
      pricing: {
        title: "Pricing — Tastile",
        description: "Simple, transparent pricing for Tastile.",
      },
      floatingSchedule: {
        requiredMinutes: "Required time: {minutes} min",
        availableWindow: "Available window: {title}",
      },
    },
  },
  ja: {
    metadata: {
      download: {
        title: "Tastileをダウンロード — 実行制御",
        description: "Windows向けTastileをダウンロード。今すぐ実行制御を始めましょう。",
      },
      pricing: {
        title: "料金 — Tastile",
        description: "Tastileのシンプルで透明な料金体系。",
      },
      floatingSchedule: {
        requiredMinutes: "所要時間: {minutes} 分",
        availableWindow: "配置可能な時間枠: {title}",
      },
    },
  },
  "zh-CN": {
    metadata: {
      download: {
        title: "Download Tastile — Execution Control",
        description:
          "Download Tastile for Windows. Start controlling your execution today.",
      },
      pricing: {
        title: "Pricing — Tastile",
        description: "Simple, transparent pricing for Tastile.",
      },
      floatingSchedule: {
        requiredMinutes: "Required time: {minutes} min",
        availableWindow: "Available window: {title}",
      },
    },
  },
  ko: {
    metadata: {
      download: {
        title: "Download Tastile — Execution Control",
        description:
          "Download Tastile for Windows. Start controlling your execution today.",
      },
      pricing: {
        title: "Pricing — Tastile",
        description: "Simple, transparent pricing for Tastile.",
      },
      floatingSchedule: {
        requiredMinutes: "Required time: {minutes} min",
        availableWindow: "Available window: {title}",
      },
    },
  },
  es: {
    metadata: {
      download: {
        title: "Download Tastile — Execution Control",
        description:
          "Download Tastile for Windows. Start controlling your execution today.",
      },
      pricing: {
        title: "Pricing — Tastile",
        description: "Simple, transparent pricing for Tastile.",
      },
      floatingSchedule: {
        requiredMinutes: "Required time: {minutes} min",
        availableWindow: "Available window: {title}",
      },
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;