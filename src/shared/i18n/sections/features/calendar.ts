import type { Locale } from "@/shared/stores/locale-store";

export const calendar = {
  en: {
    panels: {
      calendar: {
        scale: "Scale",
        day: "Day",
        week: "Week",
        month: "Month",
        custom: "Custom",
        projects: "Projects",
        loadingProjects: "Loading projects…",
      },
    },
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  },
  ja: {
    panels: {
      calendar: {
        scale: "表示スケール",
        day: "日",
        week: "週",
        month: "月",
        custom: "カスタム",
        projects: "プロジェクト",
        loadingProjects: "プロジェクトを読み込み中…",
      },
    },
    weekdays: ["日", "月", "火", "水", "木", "金", "土"],
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  },
  "zh-CN": {},
  ko: {},
  es: {},
} satisfies Record<Locale, Record<string, unknown>>;
