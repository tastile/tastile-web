import type { Locale } from "@/shared/stores/locale-store";

// Root layout, error boundary, and a11y helper copy. Lives alongside the
// other system bundles (`auth`, `legal`, `notFound`) so cross-cutting UI
// strings share one Tier-6 source of truth.
export const app = {
  en: {
    app: {
      metadata: {
        title: "Tastile — Execution Control",
        description: "Stop managing tasks. Start controlling execution.",
      },
      error: {
        heading: "Something went wrong",
        tryAgain: "Try again",
      },
    },
    a11y: {
      skipToMain: "Skip to main",
    },
  },
  ja: {
    app: {
      metadata: {
        title: "Tastile — 実行制御",
        description: "タスクを管理するのはやめ、実行を制御しよう。",
      },
      error: {
        heading: "問題が発生しました",
        tryAgain: "再試行",
      },
    },
    a11y: {
      skipToMain: "メインコンテンツへスキップ",
    },
  },
  "zh-CN": {
    app: {
      metadata: {
        title: "Tastile — 执行控制",
        description: "不再管理任务，开始控制执行。",
      },
      error: {
        heading: "出现问题",
        tryAgain: "重试",
      },
    },
    a11y: {
      skipToMain: "跳到主要内容",
    },
  },
  ko: {
    app: {
      metadata: {
        title: "Tastile — 실행 제어",
        description: "작업을 관리하는 대신 실행을 제어하세요.",
      },
      error: {
        heading: "문제가 발생했습니다",
        tryAgain: "재시도",
      },
    },
    a11y: {
      skipToMain: "본문으로 건너뛰기",
    },
  },
  es: {
    app: {
      metadata: {
        title: "Tastile — Control de ejecución",
        description: "Deja de gestionar tareas. Empieza a controlar la ejecución.",
      },
      error: {
        heading: "Algo salió mal",
        tryAgain: "Reintentar",
      },
    },
    a11y: {
      skipToMain: "Saltar al contenido principal",
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;