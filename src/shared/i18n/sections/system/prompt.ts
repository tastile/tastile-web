import type { Locale } from "@/shared/stores/locale-store";

export const prompt = {
  en: {
    prompt: {
      actions: {
        startBreak: "Start break",
        extend: "Extend",
        endBreak: "End break",
        confirmContinue: "Continue",
        confirmStopAt: "Record stop time",
        confirmExecuted: "Mark executed",
        confirmSkipped: "Mark skipped",
      },
    },
  },
  ja: {
    prompt: {
      actions: {
        startBreak: "休憩開始",
        extend: "延長",
        endBreak: "休憩終了",
        confirmContinue: "そのまま継続",
        confirmStopAt: "停止時刻を記録",
        confirmExecuted: "実行済みにする",
        confirmSkipped: "スキップ済みにする",
      },
    },
  },
  "zh-CN": {},
  ko: {},
  es: {},
} satisfies Record<Locale, Record<string, unknown>>;
