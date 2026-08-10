import type { Locale } from "@/shared/stores/locale-store";

export const header = {
  en: {
    header: {
      active: "Active",
      menu: "Menu",
      notifications: "Notifications",
      sync: {
        in_progress: "sync in progress",
        error: "sync error",
        delta: "sync",
        idle: "sync idle",
      },
    },
  },
  ja: {
    header: {
      active: "実行中",
      menu: "メニュー",
      notifications: "通知",
      sync: {
        in_progress: "同期中",
        error: "同期エラー",
        delta: "同期",
        idle: "同期待機",
      },
    },
  },
  "zh-CN": {},
  ko: {},
  es: {},
} satisfies Record<Locale, Record<string, unknown>>;
