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
  "zh-CN": {
    execution: {
      runningLabel: "执行中",
      breakLabel: "休息中",
      notStartedLabel: "未开始",
      remainingLabel: "剩余",
      prompt: {
        startTile: "开始卡片",
        endTile: "结束卡片",
        endBreak: "结束休息",
        defer30: "30 分钟",
        defer1h: "1 小时",
        defer2h: "2 小时",
        deferTomorrow: "明天",
        deferNextWeek: "下周",
      },
    },
  },
  ko: {
    execution: {
      runningLabel: "실행 중",
      breakLabel: "휴식 중",
      notStartedLabel: "시작 전",
      remainingLabel: "남음",
      prompt: {
        startTile: "타일 시작",
        endTile: "타일 종료",
        endBreak: "휴식 종료",
        defer30: "30분",
        defer1h: "1시간",
        defer2h: "2시간",
        deferTomorrow: "내일",
        deferNextWeek: "다음 주",
      },
    },
  },
  es: {
    execution: {
      runningLabel: "En ejecución",
      breakLabel: "En pausa",
      notStartedLabel: "Sin iniciar",
      remainingLabel: "Restante",
      prompt: {
        startTile: "Iniciar tarjeta",
        endTile: "Finalizar tarjeta",
        endBreak: "Terminar pausa",
        defer30: "30 min",
        defer1h: "1 hora",
        defer2h: "2 horas",
        deferTomorrow: "Mañana",
        deferNextWeek: "Próxima semana",
      },
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;
