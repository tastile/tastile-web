import type { Locale } from "@/shared/stores/locale-store";

export const projects = {
  en: {
    panels: {
      projects: {
        projects: "Projects",
        loadingProjects: "Loading projects…",
        allProjects: "All Projects",
      },
    },
  },
  ja: {
    panels: {
      projects: {
        projects: "プロジェクト",
        loadingProjects: "プロジェクトを読み込み中…",
        allProjects: "すべてのプロジェクト",
      },
    },
  },
  "zh-CN": {},
  ko: {},
  es: {},
} satisfies Record<Locale, Record<string, unknown>>;
