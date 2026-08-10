import type { Locale } from "@/shared/stores/locale-store";

export const tasks = {
  en: {
    tasks: {
      subtitle: "Manage and view your actionable items",
    },
    panels: {
      tasks: {
        search: "Search",
        searchPlaceholder: "Search tasks…",
        timeRange: "Time Range",
        days: "days",
        weeks: "weeks",
        months: "months",
        minDuration: "Min Duration",
        minUnit: "min",
        minutes: "minutes",
        priorityFilter: "Priority Filter",
        highPriorityOnly: "High Priority Only",
        excludeLowPriority: "Exclude Low Priority",
        resetToDefaults: "Reset to Defaults",
      },
    },
  },
  ja: {
    tasks: {
      subtitle: "実行可能なタスクを管理・確認できます",
    },
    panels: {
      tasks: {
        search: "検索",
        searchPlaceholder: "タスクを検索…",
        timeRange: "時間範囲",
        days: "日",
        weeks: "週",
        months: "ヶ月",
        minDuration: "最小所要時間",
        minUnit: "分",
        minutes: "分",
        priorityFilter: "優先度フィルター",
        highPriorityOnly: "高優先度のみ",
        excludeLowPriority: "低優先度を除外",
        resetToDefaults: "デフォルトに戻す",
      },
    },
  },
  "zh-CN": {},
  ko: {},
  es: {},
} satisfies Record<Locale, Record<string, unknown>>;
