import type { Locale } from "@/shared/stores/locale-store";

export const sidebar = {
  en: {
    sidebar: {
      context: "Context",
      nextUp: "Next Up",
      timeline: "Timeline",
      close: "Close",
    },
  },
  ja: {
    sidebar: {
      context: "コンテキスト",
      nextUp: "次のタスク",
      timeline: "タイムライン",
      close: "閉じる",
    },
  },
  "zh-CN": {},
  ko: {},
  es: {},
} satisfies Record<Locale, Record<string, unknown>>;
