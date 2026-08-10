import type { Locale } from "@/shared/stores/locale-store";

export const timeline = {
  en: {
    timeline: {
      today: "Today",
      week: "Week",
      month: "Month",
      custom: "Custom",
    },
    miniCalendar: {
      prevMonth: "Previous month",
      nextMonth: "Next month",
    },
  },
  ja: {
    timeline: {
      today: "今日",
      week: "今週",
      month: "今月",
      custom: "カスタム",
    },
    miniCalendar: {
      prevMonth: "前の月",
      nextMonth: "次の月",
    },
  },
  "zh-CN": {
    timeline: {
      today: "今天",
      week: "本周",
      month: "本月",
      custom: "自定义",
    },
    miniCalendar: {
      prevMonth: "上个月",
      nextMonth: "下个月",
    },
  },
  ko: {
    timeline: {
      today: "오늘",
      week: "이번 주",
      month: "이번 달",
      custom: "사용자 지정",
    },
    miniCalendar: {
      prevMonth: "이전 달",
      nextMonth: "다음 달",
    },
  },
  es: {
    timeline: {
      today: "Hoy",
      week: "Semana",
      month: "Mes",
      custom: "Personalizado",
    },
    miniCalendar: {
      prevMonth: "Mes anterior",
      nextMonth: "Mes siguiente",
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;
