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
  "zh-CN": {
    panels: {
      schedule: {
        projects: "项目",
        loadingProjects: "正在加载项目…",
      },
    },
  },
  ko: {
    panels: {
      schedule: {
        projects: "프로젝트",
        loadingProjects: "프로젝트 불러오는 중…",
      },
    },
  },
  es: {
    panels: {
      schedule: {
        projects: "Proyectos",
        loadingProjects: "Cargando proyectos…",
      },
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;