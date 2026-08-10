import type { Locale } from "@/shared/stores/locale-store";

export const nav = {
  en: {
    nav: {
      execute: "Execute",
      integrations: "Integrations",
      settings: "Settings",
      new: "New",
      timeline: "Timeline",
      tasks: "Tasks",
      projects: "Projects",
      schedule: "Schedule",
      preferences: "Preferences",
    },
  },
  ja: {
    nav: {
      execute: "実行",
      integrations: "連携",
      settings: "設定",
      new: "新規",
      timeline: "タイムライン",
      tasks: "タスク",
      projects: "プロジェクト",
      schedule: "スケジュール",
      preferences: "設定",
    },
  },
  "zh-CN": {
    nav: {
      execute: "执行",
      integrations: "集成",
      settings: "设置",
      new: "新建",
      timeline: "时间线",
      tasks: "任务",
      projects: "项目",
      schedule: "日程",
      preferences: "偏好",
    },
  },
  ko: {
    nav: {
      execute: "실행",
      integrations: "연동",
      settings: "설정",
      new: "새로 만들기",
      timeline: "타임라인",
      tasks: "작업",
      projects: "프로젝트",
      schedule: "일정",
      preferences: "환경설정",
    },
  },
  es: {
    nav: {
      execute: "Ejecutar",
      integrations: "Integraciones",
      settings: "Configuración",
      new: "Nuevo",
      timeline: "Línea de tiempo",
      tasks: "Tareas",
      projects: "Proyectos",
      schedule: "Agenda",
      preferences: "Preferencias",
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;
