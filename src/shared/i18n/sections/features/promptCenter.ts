import type { Locale } from "@/shared/stores/locale-store";

// Drift prompts on the dashboard (web#192). Keys are shared across locales.
export const promptCenter = {
  en: {
    promptCenter: {
      title: "Needs your decision",
      untitled: "Untitled",
      failed: "Couldn't complete that. Please try again.",
      more: "+{count} more",
      kind: {
        missedStart: "Not started at the planned time",
        staleActive: "Still running after its planned end",
        decisionRequired: "A decision is needed",
        startupRecovery: "Confirm when this stopped",
      },
      action: {
        startNow: "Start now",
        reschedule: "Reschedule",
        finish: "Finish",
        keepGoing: "Keep going",
        acknowledge: "OK",
        dismiss: "Dismiss",
      },
    },
  },
  ja: {
    promptCenter: {
      title: "確認が必要な予定",
      untitled: "(無題)",
      failed: "操作を完了できませんでした。もう一度お試しください。",
      more: "ほか {count} 件",
      kind: {
        missedStart: "予定の時刻に開始されていません",
        staleActive: "予定の終了を過ぎても実行中です",
        decisionRequired: "判断が必要です",
        startupRecovery: "停止した時刻を確認してください",
      },
      action: {
        startNow: "今から開始",
        reschedule: "再調整",
        finish: "終了",
        keepGoing: "続ける",
        acknowledge: "確認",
        dismiss: "スキップ",
      },
    },
  },
  "zh-CN": {
    promptCenter: {
      title: "需要你确认",
      untitled: "(无标题)",
      failed: "操作未能完成，请重试。",
      more: "另有 {count} 项",
      kind: {
        missedStart: "未在计划时间开始",
        staleActive: "已超过计划结束时间仍在进行",
        decisionRequired: "需要做出决定",
        startupRecovery: "请确认停止的时间",
      },
      action: {
        startNow: "立即开始",
        reschedule: "重新安排",
        finish: "结束",
        keepGoing: "继续",
        acknowledge: "确认",
        dismiss: "跳过",
      },
    },
  },
  ko: {
    promptCenter: {
      title: "확인이 필요한 일정",
      untitled: "(제목 없음)",
      failed: "작업을 완료하지 못했습니다. 다시 시도해 주세요.",
      more: "외 {count}건",
      kind: {
        missedStart: "예정된 시간에 시작되지 않았습니다",
        staleActive: "예정 종료 시간이 지났지만 진행 중입니다",
        decisionRequired: "결정이 필요합니다",
        startupRecovery: "중지된 시간을 확인해 주세요",
      },
      action: {
        startNow: "지금 시작",
        reschedule: "다시 배치",
        finish: "종료",
        keepGoing: "계속",
        acknowledge: "확인",
        dismiss: "건너뛰기",
      },
    },
  },
  es: {
    promptCenter: {
      title: "Requiere tu decisión",
      untitled: "Sin título",
      failed: "No se pudo completar. Inténtalo de nuevo.",
      more: "{count} más",
      kind: {
        missedStart: "No se inició a la hora prevista",
        staleActive: "Sigue en curso tras su fin previsto",
        decisionRequired: "Se necesita una decisión",
        startupRecovery: "Confirma cuándo se detuvo",
      },
      action: {
        startNow: "Empezar ahora",
        reschedule: "Reprogramar",
        finish: "Terminar",
        keepGoing: "Continuar",
        acknowledge: "Aceptar",
        dismiss: "Omitir",
      },
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;
