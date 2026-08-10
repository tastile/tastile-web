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
  "zh-CN": {},
  ko: {},
  es: {},
} satisfies Record<Locale, Record<string, unknown>>;
