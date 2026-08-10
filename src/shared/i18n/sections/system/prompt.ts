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
  "zh-CN": {
    prompt: {
      actions: {
        startBreak: "开始休息",
        extend: "延长",
        endBreak: "结束休息",
        confirmContinue: "继续",
        confirmStopAt: "记录停止时间",
        confirmExecuted: "标记为已执行",
        confirmSkipped: "标记为已跳过",
      },
    },
  },
  ko: {
    prompt: {
      actions: {
        startBreak: "휴식 시작",
        extend: "연장",
        endBreak: "휴식 종료",
        confirmContinue: "계속",
        confirmStopAt: "중단 시각 기록",
        confirmExecuted: "실행됨으로 표시",
        confirmSkipped: "건너뜀으로 표시",
      },
    },
  },
  es: {
    prompt: {
      actions: {
        startBreak: "Iniciar pausa",
        extend: "Extender",
        endBreak: "Terminar pausa",
        confirmContinue: "Continuar",
        confirmStopAt: "Registrar hora de parada",
        confirmExecuted: "Marcar como ejecutado",
        confirmSkipped: "Marcar como omitido",
      },
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;
