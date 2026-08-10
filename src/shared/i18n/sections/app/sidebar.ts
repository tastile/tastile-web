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
  "zh-CN": {
    sidebar: {
      context: "上下文",
      nextUp: "下一步",
      timeline: "时间线",
      close: "关闭",
    },
  },
  ko: {
    sidebar: {
      context: "컨텍스트",
      nextUp: "다음 작업",
      timeline: "타임라인",
      close: "닫기",
    },
  },
  es: {
    sidebar: {
      context: "Contexto",
      nextUp: "A continuación",
      timeline: "Línea de tiempo",
      close: "Cerrar",
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;
