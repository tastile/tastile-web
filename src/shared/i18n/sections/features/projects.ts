import type { Locale } from "@/shared/stores/locale-store";

export const projects = {
  en: {
    panels: {
      projects: {
        projects: "Projects",
        loadingProjects: "Loading projects…",
        allProjects: "All Projects",
        personal: "Personal",
        personalDescription: "Tiles owned by your personal scope",
        personalLocked: "Personal scope cannot be renamed or deleted",
      },
    },
  },
  ja: {
    panels: {
      projects: {
        projects: "プロジェクト",
        loadingProjects: "プロジェクトを読み込み中…",
        allProjects: "すべてのプロジェクト",
        personal: "パーソナル",
        personalDescription: "パーソナルスコープに所有されているタイル",
        personalLocked: "パーソナルスコープは名前変更・削除できません",
      },
    },
  },
  "zh-CN": {
    panels: {
      projects: {
        projects: "项目",
        loadingProjects: "正在加载项目…",
        allProjects: "全部项目",
        personal: "个人",
        personalDescription: "归属于个人范围的卡片",
        personalLocked: "个人范围不可重命名或删除",
      },
    },
  },
  ko: {
    panels: {
      projects: {
        projects: "프로젝트",
        loadingProjects: "프로젝트 불러오는 중…",
        allProjects: "모든 프로젝트",
        personal: "개인",
        personalDescription: "개인 범위에 속한 타일",
        personalLocked: "개인 범위는 이름 변경 또는 삭제할 수 없습니다",
      },
    },
  },
  es: {
    panels: {
      projects: {
        projects: "Proyectos",
        loadingProjects: "Cargando proyectos…",
        allProjects: "Todos los proyectos",
        personal: "Personal",
        personalDescription: "Tarjetas propiedad de tu ámbito personal",
        personalLocked: "El ámbito personal no se puede renombrar ni eliminar",
      },
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;
