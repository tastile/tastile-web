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
  "zh-CN": {
    tasks: {
      subtitle: "管理和查看你的可执行项",
    },
    panels: {
      tasks: {
        search: "搜索",
        searchPlaceholder: "搜索任务…",
        timeRange: "时间范围",
        days: "天",
        weeks: "周",
        months: "个月",
        minDuration: "最短时长",
        minUnit: "分钟",
        minutes: "分钟",
        priorityFilter: "优先级筛选",
        highPriorityOnly: "仅高优先级",
        excludeLowPriority: "排除低优先级",
        resetToDefaults: "恢复默认",
      },
    },
  },
  ko: {
    tasks: {
      subtitle: "실행 가능한 항목을 관리하고 확인하세요",
    },
    panels: {
      tasks: {
        search: "검색",
        searchPlaceholder: "작업 검색…",
        timeRange: "시간 범위",
        days: "일",
        weeks: "주",
        months: "개월",
        minDuration: "최소 소요 시간",
        minUnit: "분",
        minutes: "분",
        priorityFilter: "우선순위 필터",
        highPriorityOnly: "높은 우선순위만",
        excludeLowPriority: "낮은 우선순위 제외",
        resetToDefaults: "기본값으로 재설정",
      },
    },
  },
  es: {
    tasks: {
      subtitle: "Gestiona y consulta tus elementos accionables",
    },
    panels: {
      tasks: {
        search: "Buscar",
        searchPlaceholder: "Buscar tareas…",
        timeRange: "Rango de tiempo",
        days: "días",
        weeks: "semanas",
        months: "meses",
        minDuration: "Duración mínima",
        minUnit: "min",
        minutes: "minutos",
        priorityFilter: "Filtro de prioridad",
        highPriorityOnly: "Solo alta prioridad",
        excludeLowPriority: "Excluir baja prioridad",
        resetToDefaults: "Restablecer valores",
      },
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;
