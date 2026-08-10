import type { Locale } from "@/shared/stores/locale-store";

export const activityBar = {
  en: {
    activityBar: {
      ariaLabel: "Activity bar",
      sidebarControl: "Sidebar control",
      sidebar: "Sidebar",
      expanded: "Expanded",
      collapsed: "Collapsed",
      expandOnHover: "Expand on hover",
    },
  },
  ja: {
    activityBar: {
      ariaLabel: "アクティビティバー",
      sidebarControl: "サイドバー操作",
      sidebar: "サイドバー",
      expanded: "常に展開",
      collapsed: "常に折りたたむ",
      expandOnHover: "ホバーで展開",
    },
  },
  "zh-CN": {
    activityBar: {
      ariaLabel: "活动栏",
      sidebarControl: "侧边栏控制",
      sidebar: "侧边栏",
      expanded: "始终展开",
      collapsed: "始终折叠",
      expandOnHover: "悬停展开",
    },
  },
  ko: {
    activityBar: {
      ariaLabel: "활동 표시줄",
      sidebarControl: "사이드바 제어",
      sidebar: "사이드바",
      expanded: "항상 확장",
      collapsed: "항상 축소",
      expandOnHover: "호버 시 확장",
    },
  },
  es: {
    activityBar: {
      ariaLabel: "Barra de actividad",
      sidebarControl: "Control de la barra lateral",
      sidebar: "Barra lateral",
      expanded: "Siempre expandida",
      collapsed: "Siempre contraída",
      expandOnHover: "Expandir al pasar el cursor",
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;
