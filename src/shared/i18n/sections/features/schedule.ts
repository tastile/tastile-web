import type { Locale } from "@/shared/stores/locale-store";

export const schedule = {
  en: {
    panels: {
      schedule: {
        projects: "Projects",
        loadingProjects: "Loading projects…",
      },
    },
  },
  ja: {
    panels: {
      schedule: {
        projects: "プロジェクト",
        loadingProjects: "プロジェクトを読み込み中…",
      },
    },
  },
  "zh-CN": {},
  ko: {},
  es: {},
} satisfies Record<Locale, Record<string, unknown>>;
