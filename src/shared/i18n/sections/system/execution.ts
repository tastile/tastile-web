import type { Locale } from "@/shared/stores/locale-store";

export const execution = {
  en: {
    execution: {
      runningLabel: "Running",
      breakLabel: "On break",
      notStartedLabel: "Not started",
      remainingLabel: "Remaining",
      prompt: {
        startTile: "Start tile",
        endTile: "End tile",
        endBreak: "End break",
        defer30: "30 min",
        defer1h: "1 hour",
        defer2h: "2 hours",
        deferTomorrow: "Tomorrow",
        deferNextWeek: "Next week",
      },
    },
  },
  ja: {
    execution: {
      runningLabel: "実行中",
      breakLabel: "休憩中",
      notStartedLabel: "未実行",
      remainingLabel: "残り",
      prompt: {
        startTile: "タスクを開始",
        endTile: "タスクを終了",
        endBreak: "休憩終了",
        defer30: "30分",
        defer1h: "1時間",
        defer2h: "2時間",
        deferTomorrow: "明日",
        deferNextWeek: "来週",
      },
    },
  },
  "zh-CN": {},
  ko: {},
  es: {},
} satisfies Record<Locale, Record<string, unknown>>;
