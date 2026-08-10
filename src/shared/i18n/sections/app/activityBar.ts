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
  "zh-CN": {},
  ko: {},
  es: {},
} satisfies Record<Locale, Record<string, unknown>>;
