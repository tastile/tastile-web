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
  "zh-CN": {
    panels: {
      projects: {
        projects: "项目",
        loadingProjects: "正在加载项目…",
        allProjects: "全部项目",
      },
    },
  },
  ko: {
    panels: {
      projects: {
        projects: "프로젝트",
        loadingProjects: "프로젝트 불러오는 중…",
        allProjects: "모든 프로젝트",
      },
    },
  },
  es: {
    panels: {
      projects: {
        projects: "Proyectos",
        loadingProjects: "Cargando proyectos…",
        allProjects: "Todos los proyectos",
      },
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;
