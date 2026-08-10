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
  "zh-CN": {},
  ko: {},
  es: {},
} satisfies Record<Locale, Record<string, unknown>>;
